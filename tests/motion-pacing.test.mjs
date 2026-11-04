import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MOTION_PACING,moveDuration,settlePause,deferLineCheck} from '../web/motion-pacing.mjs';
import {createCelebration} from '../web/celebration.mjs';
import {harness} from './helpers/motion-harness.mjs';
const app=fs.readFileSync(new URL('../web/app.mjs',import.meta.url),'utf8');
function fakeClock(){
  let now=0,id=0;const jobs=new Map();
  const setTimeout=(fn,ms=0)=>{jobs.set(++id,{fn,at:now+ms});return id;};
  const clock={now:()=>now,setTimeout,clearTimeout:id=>jobs.delete(id),requestAnimationFrame:fn=>setTimeout(fn,16)};
  clock.tick=async ms=>{const target=now+ms;while(true){const next=[...jobs].filter(([,job])=>job.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;jobs.delete(next[0]);next[1].fn();for(let i=0;i<8;i++)await Promise.resolve();}now=target;for(let i=0;i<8;i++)await Promise.resolve();};
  return clock;
}
const pacing=clock=>({MOTION_PACING,moveDuration,settlePause,deferLineCheck:check=>deferLineCheck(check,{requestFrame:clock.requestAnimationFrame,setTimer:clock.setTimeout,clearTimer:clock.clearTimeout})});

test('move duration is stable in production; laboratory and full demonstrations remain explicit',()=>{
  assert.equal(moveDuration({labSpeed:40}),160);assert.equal(moveDuration({labSpeed:400}),160);
  assert.equal(moveDuration({laboratory:true,labSpeed:240}),240);
  assert.equal(settlePause({kind:'line',linger:190}),0);
  assert.equal(settlePause({kind:'combo',linger:350}),0);
  assert.equal(settlePause({kind:'all',linger:650}),650);
  assert.equal(settlePause({kind:'line',linger:190},{demonstration:true}),190);
});
for(const size of [5,6])test(`${size}x${size}: contact precedes search; repulsion starts at 60ms; second input cannot execute`,async()=>{
  const clock=fakeClock();let resolveSearch;
  const search=new Promise(resolve=>resolveSearch=resolve);
  const run=harness(app,{size,clock,pacing:pacing(clock),checkOverride:()=>search});
  const first=run.place(run.at),second=run.place(run.at-1);await second;
  assert.equal(run.isBusy(),true);assert.equal(run.events.filter(e=>e.event==='engine-start').length,1);
  assert.equal(run.events.find(e=>e.event==='contact').ms,0);assert.equal(run.events.some(e=>e.event==='search-start'),false);
  await clock.tick(16);assert.equal(run.events.find(e=>e.event==='search-start').ms,16);
  await clock.tick(44);assert.equal(run.events.find(e=>e.event==='sound'&&e.id==='move').ms,60);
  await clock.tick(160);assert.equal(run.isBusy(),true,'pending search still owns the turn');
  resolveSearch({possible:true});await first;
  assert.equal(run.isBusy(),false);assert.equal(run.getState().turns,1);
  assert.deepEqual(run.events.filter(e=>e.event==='engine-done')[0].frames,['place','move']);
  assert.deepEqual(run.events.findLast(e=>e.event==='finish').options,{keepPlacement:true,keepReleased:true});
});
test('reduced motion skips contact/move waits without allowing a second turn during line search',async()=>{
  const clock=fakeClock(),run=harness(app,{reduced:true,clock,pacing:pacing(clock),checkOverride:()=>({possible:true})});
  const done=run.place(run.at);await clock.tick(0);
  assert.equal(run.events.find(e=>e.event==='sound'&&e.id==='move').ms,0);assert.equal(run.isBusy(),true);
  await clock.tick(16);await done;assert.equal(run.isBusy(),false);
});
test('line tail releases without blocking; all-clear keeps its full celebration before unlock',async()=>{
  for(const [kind,readyAt] of [['line',940],['all',1470]]){
    const clock=fakeClock(),run=harness(app,{kind,clock,pacing:pacing(clock),checkOverride:()=>({possible:true})});
    const done=run.place(run.at);await clock.tick(readyAt-1);assert.equal(run.isBusy(),true);
    await clock.tick(1);await done;assert.equal(run.isBusy(),false);
    const tail=run.events.find(e=>e.event==='release');
    if(kind==='line')assert.equal(tail.duration,190);else assert.equal(tail,undefined);
    assert.equal(run.getState().score,50);
  }
});
test('deferred search runs once if a hidden frame never arrives, and propagates errors',async()=>{
  const clock=fakeClock();let lateFrame,calls=0;
  const promise=deferLineCheck(()=>{calls++;return 42;},{requestFrame:fn=>lateFrame=fn,setTimer:clock.setTimeout,clearTimer:clock.clearTimeout});
  await clock.tick(48);assert.equal(await promise,42);lateFrame();await clock.tick(0);assert.equal(calls,1);
  const failed=deferLineCheck(()=>{throw Error('search failed');},{requestFrame:null,setTimer:clock.setTimeout,clearTimer:clock.clearTimeout});
  const assertion=assert.rejects(failed,/search failed/);await clock.tick(0);await assertion;
});
test('placement keeps its full Spring after turn unlock; old completion cannot clean the next tile',()=>{
  const savedDocument=globalThis.document;
  class Element{
    constructor(){this.children=[];this.style={setProperty(){},getPropertyValue:()=>0};this.classes=new Set();this.classList={add:(...s)=>s.forEach(x=>this.classes.add(x)),remove:(...s)=>s.forEach(x=>this.classes.delete(x)),contains:s=>this.classes.has(s)};this.events=new Map();}
    set className(s){this.classes=new Set(s.split(' '));}setAttribute(){}append(el){el.parent=this;this.children.push(el);}remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}addEventListener(type,fn){this.events.set(type,fn);}removeEventListener(type){this.events.delete(type);}
    end(){this.events.get('animationend')?.({target:this,animationName:'spring-place'});}
  }
  globalThis.document={createElement:()=>new Element()};
  try{
    const board=new Element(),fx=createCelebration(board,new Element()),first=new Element(),second=new Element();
    fx.place(first);fx.finish({keepPlacement:true});assert.ok(first.classes.has('spring-placed'));
    fx.place(second);first.end();assert.ok(!first.classes.has('spring-placed'));assert.ok(second.classes.has('spring-placed'));
    const tail=new Element();tail.className='spring-mote';board.children[0].append(tail);
    fx.release(190);fx.finish({keepPlacement:true,keepReleased:true});assert.ok(board.children[0].children.includes(tail));
    fx.place(first);assert.ok(!board.children[0].children.includes(tail),'next placement cancels old released effects');
    fx.finish();assert.ok(!second.classes.has('spring-placed'));assert.equal(board.children[0].children.length,0);
    fx.place(first,0);assert.ok(!first.classes.has('spring-placed'));
  }finally{globalThis.document=savedDocument;}
});
test('approved Spring keyframes and reduced motion CSS remain byte-identical',()=>{
  const current=fs.readFileSync(new URL('../web/effects.css',import.meta.url),'utf8');
  const before=fs.readFileSync(new URL('./helpers/effects-before.css',import.meta.url),'utf8');
  const motion=css=>css.split(/\r?\n/).filter(line=>line.startsWith('@keyframes')||line.startsWith('@media(prefers-reduced-motion')).join('\n');
  assert.equal(motion(current),motion(before));
});
