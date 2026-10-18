import test from 'node:test';
import assert from 'node:assert/strict';
import {BASIC_PHYSICS,normalizePhysics} from '../web/physics.mjs';
import {playTurn,isValidSave,createGame} from '../web/engine.mjs';
import {DEMOS,effectScene} from '../web/effect-demos.mjs';
import {celebrationFor} from '../web/celebration.mjs';
import {loadMain,MAIN_SAVE_KEY} from '../web/main-save.mjs';
import {variantSaveKey} from '../web/variants.mjs';
const store=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),data};};
test('official defaults are the selected no-turn version and transmit to the row end',()=>{
  assert.equal(BASIC_PHYSICS.sideways,false);assert.equal(BASIC_PHYSICS.transmit,true);
  assert.equal(normalizePhysics({}).sideways,false);
});
test('every effect demonstration starts as a legal save and runs an actual placement',()=>{
  const expected={single:[50,1,0],double:[200,2,0],triple:[450,3,0],all:[200,2,1]};
  for(const kind of ['single','double','triple','all']){
    const scene=effectScene(kind),copy=structuredClone(scene.state);
    assert.ok(isValidSave(scene.state));assert.equal(scene.state.board[scene.at],null);
    const r=playTurn(scene.state,scene.at,scene.option,()=>.2);
    assert.deepEqual([r.total,r.maxSimultaneous,r.allClears],expected[kind]);
    assert.ok(isValidSave(r.state));assert.deepEqual(scene.state,copy);
    assert.equal(r.state.tray[0],null);
  }
});
test('double and triple combos keep their surviving pieces and never falsely report an empty board',()=>{
  for(const kind of['double','triple']){
    const s=effectScene(kind),r=playTurn(s.state,s.at,0);
    assert.ok(r.state.board.some(Boolean));assert.equal(r.allClears,0);
    assert.equal(r.frames.find(f=>f.kind==='clear').allClear,false);
  }
});
test('all-clear is based on removing all occupied cells, with unchanged line points',()=>{
  const s=effectScene('all'),r=playTurn(s.state,s.at,0),frame=r.frames.find(f=>f.kind==='clear');
  assert.equal(r.state.board.filter(Boolean).length,0);assert.equal(frame.allClear,true);
  assert.equal(frame.cleared.length,9);assert.equal(r.total,200);
  assert.equal(celebrationFor(frame).kind,'all');
});
test('celebration labels and timing distinguish normal line, double, triple and all-clear',()=>{
  const single=celebrationFor({lineCount:1,gain:50,allClear:false});
  const double=celebrationFor({lineCount:2,gain:200,allClear:false});
  const triple=celebrationFor({lineCount:3,gain:450,allClear:false});
  const all=celebrationFor({lineCount:2,gain:200,allClear:true});
  assert.equal(single.kind,'line');assert.equal(double.title,'¡Doble línea!');
  assert.equal(triple.title,'¡Triple línea!');assert.equal(all.title,'¡Tablero limpio!');
  assert.ok(all.charge>double.charge);assert.ok(all.linger>single.linger);
});
test('promoting no-turn copies its exact progress and leaves both historical saves intact',()=>{
  const storage=store(),chosen=createGame(()=>.2),old=createGame(()=>.5);
  chosen.score=750;chosen.round=8;chosen.tray[1]=null;old.score=50;
  storage.setItem(variantSaveKey('no-turn'),JSON.stringify(chosen));
  storage.setItem('krazel-imanes-v5',JSON.stringify(old));
  const before=[...storage.data],r=loadMain(storage);
  assert.deepEqual(r.state,chosen);assert.equal(r.source,variantSaveKey('no-turn'));
  for(const[k,v]of before)assert.equal(storage.getItem(k),v);
  assert.deepEqual(JSON.parse(storage.getItem(MAIN_SAVE_KEY)),chosen);
});
test('the canonical main save wins after promotion and old selected data cannot rewind it',()=>{
  const storage=store(),chosen=createGame(()=>.2),current=createGame(()=>.4);
  chosen.score=50;current.score=450;
  storage.setItem(variantSaveKey('no-turn'),JSON.stringify(chosen));
  storage.setItem(MAIN_SAVE_KEY,JSON.stringify(current));
  assert.deepEqual(loadMain(storage).state,current);
});
test('promotion falls back to legacy main if selected save is unavailable and works with blocked storage',()=>{
  const storage=store(),old=createGame(()=>.2);old.score=150;
  storage.setItem('krazel-imanes-v5',JSON.stringify(old));
  assert.deepEqual(loadMain(storage).state,old);
  assert.ok(isValidSave(loadMain({getItem:()=>{throw Error();},setItem:()=>{throw Error();}}).state));
});
