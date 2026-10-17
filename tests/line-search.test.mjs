import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,playTurn,simulate,probeLine,isValidSave,restoreGame,COLORS,VIOLET_ROUND} from '../web/engine.mjs';
import {analyzeLines,checkLines,applyLineCheck} from '../web/line-search.mjs';
import {effectScene} from '../web/effect-demos.mjs';
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const holes=s=>s.board.flatMap((p,i)=>p?[]:[i]);
const palette=round=>round>=VIOLET_ROUND?COLORS:COLORS.slice(0,3);

test('a bad move on the observed board loses with SIX holes and no extra turns consumed',async()=>{
  const scene=effectScene('dead'),copy=structuredClone(scene.state);
  assert.equal(analyzeLines(scene.state).possible,true);
  const turn=playTurn(scene.state,scene.at,scene.option,()=>.5);
  const ended=applyLineCheck(turn.state,await checkLines(turn.state));
  assert.equal(holes(ended).length,6);assert.equal(ended.over,true);assert.equal(ended.endReason,'no-lines');
  assert.equal(ended.score,200);assert.equal(ended.turns,19);assert.equal(ended.tray.filter(Boolean).length,2);
  assert.ok(isValidSave(ended));assert.deepEqual(restoreGame(ended),ended);assert.deepEqual(scene.state,copy);
  assert.throws(()=>playTurn(ended,holes(ended)[0],0));
});

test('the observed board REALLY scores 50 after seven legal turns with the actual hand and forecast',()=>{
  const scene=effectScene('escape'),copy=structuredClone(scene.state);let s=scene.state;
  assert.equal(holes(s).length,7);assert.equal(analyzeLines(s).possible,true);
  for(const [n,step]of scene.moves.entries()){
    const option=s.tray.findIndex(p=>p?.color===step.color);assert.notEqual(option,-1);
    const r=playTurn(s,step.at,option,()=>.5);s=r.state;assert.equal(r.total,n===6?50:0);
    if(n===6)assert.deepEqual(r.frames.find(f=>f.kind==='clear').lines.map(l=>[l.axis,l.index]),[['column',1]]);
    else assert.equal(analyzeLines(s).possible,true);
  }
  assert.equal(s.score,250);assert.equal(s.turns,25);assert.deepEqual(scene.state,copy);
});

test('three repeated ideal colors are NOT a legal hand and cannot falsely keep a trapped board alive',()=>{
  const s=createGame(()=>.2);s.round=6;s.board=Array(25).fill(null);
  const layout=['honey','coral','coral','coral','coral','teal','coral','teal','honey','coral','honey',null,'teal','coral','teal','teal',null,'honey','violet','teal','honey',null,'honey','teal','teal'];
  layout.forEach((color,i)=>{if(color)s.board[i]={id:s.nextId++,color};});
  let board=s.board,id=s.nextId,total=0;
  for(const at of[11,16,21]){const r=simulate(board,at,{id:id++,color:'coral'});board=r.board;total+=r.total;}
  assert.equal(total,50);assert.equal(analyzeLines(s).possible,false);assert.equal(brute(s),false);
});

test('returned paths respect remaining hand slots, distinct colors and violet unlock',()=>{
  for(const state of[createGame(()=>.2),effectScene('escape').state]){
    const report=analyzeLines(state);assert.equal(report.possible,true);
    let board=state.board,id=state.nextId,round=state.round,slots=state.tray.filter(Boolean).length,used=new Set(),score=0;
    for(const step of report.path){
      if(!slots){round++;slots=3;used=new Set();}
      assert.ok(palette(round).includes(step.color));assert.ok(!used.has(step.color));used.add(step.color);slots--;
      const r=simulate(board,step.at,{id:id++,color:step.color});board=r.board;score+=r.total;
    }
    assert.ok(score>0);
  }
});

test('every possible draw is considered regardless of actual hand and forecast color selection',()=>{
  for(const original of[effectScene('escape').state,playTurn(effectScene('dead').state,6,1).state]){
    const expected=analyzeLines(original);
    for(let n=0;n<8;n++){
      const s=structuredClone(original);
      s.tray=s.tray.map((p,i)=>p?{...p,color:COLORS[(n+i)%4]}:null);
      s.nextTray=s.nextTray.map((p,i)=>({...p,color:COLORS[(n+i+1)%4]}));
      assert.deepEqual(analyzeLines(s),expected);
    }
  }
});

test('v5 migration preserves points, positions, partial hand and forecast',()=>{
  const old=createGame(()=>.2);old.version=5;delete old.endReason;old.tray[1]=null;old.score=350;old.round=16;
  const next=restoreGame(old);assert.ok(isValidSave(next));assert.equal(next.version,6);
  for(const key of['board','tray','nextTray','score','round','turns'])assert.deepEqual(next[key],old[key]);
});

test('full board defeat remains valid and malformed end reasons are rejected',()=>{
  const s=createGame(()=>.2);s.board=Array.from({length:25},(_,i)=>({id:s.nextId++,color:COLORS[(Math.floor(i/5)+i%5)%4]}));
  const end=applyLineCheck(s,analyzeLines(s));assert.equal(end.over,true);assert.equal(end.endReason,'full');assert.ok(isValidSave(end));
  assert.equal(isValidSave({...end,endReason:null}),false);assert.equal(isValidSave({...end,endReason:'no-lines'}),false);
});

test('the lightweight probe agrees with the animated engine on 400 random placements',()=>{
  const random=rng(5);
  for(let n=0;n<400;n++){
    const s=createGame(random);s.board=s.board.map((_,i)=>random()<.7?{id:s.nextId++,color:COLORS[Math.floor(random()*4)]}:null);
    const empty=holes(s);if(!empty.length)continue;
    const at=empty[Math.floor(random()*empty.length)],piece={id:s.nextId++,color:COLORS[Math.floor(random()*4)]};
    const probe=probeLine(s.board,at,piece),actual=simulate(s.board,at,piece);
    assert.equal(probe.lineCount>0,actual.lineCount>0);if(!probe.lineCount)assert.deepEqual(probe.board,actual.board);
  }
});

// Independent oracle: simulate real colors over all legal batches; no memo,
// pruning, beam heuristic, symbolic pieces or lightweight probe.
function brute(state,pool=palette(state.round),slots=state.tray.filter(Boolean).length,round=state.round){
  if(!slots){round++;pool=palette(round);slots=3;}
  const id=Math.max(0,...state.board.map(p=>p?.id||0))+1;
  for(const at of holes(state))for(const color of pool){
    const r=simulate(state.board,at,{id,color});
    if(r.lineCount||brute({board:r.board},pool.filter(c=>c!==color),slots-1,round))return true;
  }
  return false;
}

test('exact search matches an exhaustive legal-batch oracle for 120 late boards',()=>{
  const random=rng(99);
  for(let n=0;n<120;n++){
    const s=createGame(random);s.round=6;s.board=Array.from({length:25},()=>({id:s.nextId++,color:COLORS[Math.floor(random()*4)]}));
    const count=1+n%3;for(let k=0;k<count;){const at=Math.floor(random()*25);if(s.board[at]){s.board[at]=null;k++;}}
    if(n%2){s.tray[0]=null;s.tray[1]=null;}
    assert.equal(analyzeLines(s).possible,brute(s),'board '+n);
  }
});

test('a falsely ended observed board is recovered without losing points, options or forecast',()=>{
  const s=effectScene('escape').state;s.over=true;s.endReason='no-lines';
  const restored=restoreGame(s),next=applyLineCheck(restored,analyzeLines(restored));
  assert.equal(next.over,false);assert.equal(next.endReason,null);assert.ok(isValidSave(next));
  for(const key of['board','score','turns','round','tray','nextTray','nextId'])assert.deepEqual(next[key],s[key]);
});

test('all combo demonstrations remain reachable scoring opportunities',()=>{
  for(const kind of['single','double','triple','all'])assert.equal(analyzeLines(effectScene(kind).state).possible,true);
});
