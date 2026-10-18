import test from 'node:test';
import assert from 'node:assert/strict';
import {readCombo,scoreCombo} from '../web/combo.mjs';
import {createGame,playTurn,restoreGame} from '../web/engine.mjs';
import {effectScene} from '../web/effect-demos.mjs';
import {createPersonalBest} from '../web/personal-best.mjs';
import {clearHaptic} from '../web/haptics.mjs';
import {celebrationFor} from '../web/celebration.mjs';
const lineFor=(state,option)=>{
  const s=structuredClone(state);s.board=Array(25).fill(null);
  for(const at of [10,11,13,14])s.board[at]={id:s.nextId++,color:s.tray[option].color};
  s.board[0]={id:s.nextId++,color:'violet'};
  return s;
};
test('consecutive clears in the same set grow the multiplier and total score exactly once per move',()=>{
  const scene=effectScene('single');let s=scene.state;
  for(const [option,multiplier] of [[0,1],[1,2],[2,3]]){
    const before=s.score,r=playTurn(lineFor(s,option),12,option,()=>.2);s=r.state;
    assert.equal(r.baseTotal,50);assert.equal(r.total,50*multiplier);assert.equal(s.score,before+r.total);
    assert.equal(s.combo.count,multiplier);assert.equal(s.combo.lastRound,1);
    assert.equal(r.frames.filter(f=>f.kind==='clear').reduce((n,f)=>n+f.gain,0),r.total);
  }
  assert.equal(s.round,2);assert.equal(s.score,300);
  const r=playTurn(lineFor(s,0),12,0,()=>.2);assert.equal(r.multiplier,4);assert.equal(r.state.combo.lastRound,2);
});
test('the current set AND next set remain available; expiry occurs only after the next set ends without a clear',()=>{
  let s=createGame(()=>.2);s.board=Array(25).fill(null);s.round=3;s.combo={count:2,lastRound:3};s.tray[0]=null;s.tray[1]=null;
  let r=playTurn(s,0,2,()=>.2);s=r.state;assert.equal(s.round,4);assert.equal(s.combo.count,2);
  s=playTurn(s,12,0,()=>.2).state;s=playTurn(s,24,1,()=>.2).state;
  assert.deepEqual(restoreGame(s).combo,{count:2,lastRound:3});
  const saved=structuredClone(s);
  r=playTurn(s,4,2,()=>.2);assert.equal(r.state.round,5);assert.deepEqual(r.state.combo,{count:0,lastRound:null});
  r=playTurn(lineFor(saved,2),12,2,()=>.2);assert.equal(r.multiplier,3);assert.equal(r.state.round,5);assert.deepEqual(r.state.combo,{count:3,lastRound:4});
});
test('a missed move does not grow or refresh the streak and a stale streak cannot earn a multiplier',()=>{
  assert.deepEqual(scoreCombo({count:3,lastRound:5},6,false),{count:3,lastRound:5});
  assert.deepEqual(scoreCombo({count:3,lastRound:5},7,true),{count:1,lastRound:7});
  assert.deepEqual(readCombo({count:2,lastRound:9},1),{count:0,lastRound:null});
  const scene=effectScene('single');delete scene.state.combo;
  const restored=restoreGame(scene.state);assert.deepEqual(restored.combo,{count:0,lastRound:null});
  for(const key of ['board','tray','nextTray','score','turns','round'])assert.deepEqual(restored[key],scene.state[key]);
});
test('simultaneous lines keep their base reward and apply one streak multiplier; feedback chooses the streak',()=>{
  const scene=effectScene('double');scene.state.combo={count:2,lastRound:1};
  const r=playTurn(scene.state,scene.at,scene.option,()=>.2),frame=r.frames.find(f=>f.kind==='clear');
  assert.equal(r.baseTotal,200);assert.equal(r.total,600);assert.equal(r.state.combo.count,3);
  assert.equal(celebrationFor(frame).title,'¡Combo ×3!');
  assert.equal(clearHaptic({lineCount:1,multiplier:2}),'combo');
  assert.equal(clearHaptic({lineCount:2,multiplier:3,allClear:true}),'allClear');
});
test('personal best persists monotonically, survives new games and works if storage is unavailable',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const best=createPersonalBest(storage);assert.equal(best.update(200),200);assert.equal(best.update(50),200);assert.equal(best.update(0),200);
  assert.equal(createPersonalBest(storage).get(),200);assert.equal(best.update(NaN),200);
  const blocked=createPersonalBest({getItem(){throw Error();},setItem(){throw Error();}});assert.equal(blocked.update(150),150);
});
