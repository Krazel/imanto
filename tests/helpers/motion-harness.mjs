import fs from 'node:fs';
import {createBoardMode} from '../../web/board-mode.mjs';
import {celebrationFor} from '../../web/celebration.mjs';

export function scene(size,kind){
  const mode=createBoardMode(size),state=mode.createGame(()=>.2),at=Math.floor(size/2)*size+Math.floor(size/2);
  state.board=Array(size*size).fill(null);state.over=false;state.endReason=null;
  const add=(index,color=state.tray[0].color)=>state.board[index]={id:state.nextId++,color};
  if(kind==='neighbor')add(at+1);
  if(kind==='line'||kind==='all'){
    const row=Math.floor(at/size);for(let col=0;col<size;col++)if(row*size+col!==at)add(row*size+col);
    if(kind==='line')add(0,'teal');
  }
  return {mode,state,at};
}

export function harness(source,{size=5,kind='neighbor',reduced=false,pacing={},clock={now:()=>performance.now(),setTimeout,clearTimeout,requestAnimationFrame:fn=>setTimeout(fn,16)},checkOverride}={}){
  const {mode,state,at}=scene(size,kind),events=[],start=clock.now(),record=(event,detail={})=>events.push({event,ms:clock.now()-start,...detail});
  const nodes=new Map();
  const element=()=>({children:[],dataset:{},style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},replaceChildren(){this.children=[];},setAttribute(key,value){if(key==='aria-busy')record('busy',{value});},offsetWidth:0});
  const $=key=>{if(!nodes.has(key))nodes.set(key,element());return nodes.get(key);};
  const piecesEl=element(),boardEl=element();
  let rendered=0,checkSync=0;
  const checkLines=(state,physics)=>{record('search-start');const before=clock.now();const result=checkOverride?checkOverride(state,physics):mode.checkLines(state,physics);checkSync=clock.now()-before;record('search-return',{syncMs:checkSync});return Promise.resolve(result).then(result=>{record('search-done');return result;});};
  const env={markMotion:()=>{},...pacing,mode,$,boardEl,piecesEl,state,selected:0,busy:false,editing:false,removingForRevive:false,experiment:null,menu:{open:false},help:{open:false},restartConfirm:{open:false},reduce:{matches:reduced},physics:mode.BASIC_PHYSICS,IS_LAB:false,IS_EFFECTS:false,IS_MAIN:false,demoSpeed:1,demoKind:null,lab:null,effectRoom:null,bonusTimer:0,statusTimer:0,status:element(),document:{documentElement:element()},
    renderBoard(board){rendered++;record('render',{number:rendered,ids:board.map(p=>p?.id||null)});piecesEl.children=board.filter(Boolean).map(p=>{const el=element();el.dataset.id=p.id;return el;});},
    celebration:{place(){record('contact');return 480;},finishPlacement(){record('spring-finish');},start(frame){record('clear');return celebrationFor(frame);},finish(options){record('finish',{options});},release(duration){record('release',{duration});}},
    playTurn(...args){record('engine-start');const result=mode.playTurn(...args);record('engine-done',{frames:result.frames.map(f=>f.kind)});return result;},
    checkLines,applyLineCheck:mode.applyLineCheck,audio:{play(id){record('sound',{id});}},haptics:{play(){},clear(){}},persist(){},clearPreview(){},setQuickBusy(){},renderTray(){},showScore(){},finishGuidance(){},openMenu(){record('menu');},idleMessage:()=>'',t:s=>s,
    setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout};
  const excerpt=source.slice(source.indexOf('const delay=ms=>'),source.indexOf('const trayDrag='));
  const runtime=new Function(...Object.keys(env),excerpt+'\nreturn {place,animate,getState:()=>state,isBusy:()=>busy};')(...Object.values(env));
  return {...runtime,at,events,record,get checkSync(){return checkSync;}};
}

export async function profile(sourcePath,outPath,pacing={}){
  const source=fs.readFileSync(sourcePath,'utf8'),runs=[];
  for(const size of [5,6])for(const kind of ['empty','neighbor','line','all']){
    const run=harness(source,{size,kind,pacing});await run.place(run.at);
    runs.push({size,kind,checkSyncMs:run.checkSync,events:run.events});
  }
  const report={environment:'Node real timers + actual app animate/place and real engine/search; simulated DOM. No browser paint/FPS claim.',at:new Date().toISOString(),source:sourcePath,runs};
  fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n');
  return runs.map(({size,kind,events,checkSyncMs})=>({size,kind,checkSyncMs:+checkSyncMs.toFixed(2),contactMs:+events.find(e=>e.event==='contact').ms.toFixed(2),moveMs:events.find(e=>e.event==='sound'&&e.id==='move')?.ms.toFixed(2)??null,unlockMs:+events.find(e=>e.event==='busy'&&e.value==='false').ms.toFixed(2)}));
}
