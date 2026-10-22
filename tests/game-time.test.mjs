import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameTime,GAME_TIME_KEY} from '../web/game-time.mjs';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};};
test('played time persists over closure; background and pause do not count',()=>{
  const storage=memory();let now=0,c=createGameTime(storage,{now:()=>now});
  c.sync('game',true);now+=300000;c.sync('game',false);
  now+=999999;assert.equal(c.elapsed(),300000);
  c=createGameTime(storage,{now:()=>now});assert.equal(c.elapsed(),300000);
  c.sync('game',true);now+=299999;assert.equal(c.elapsed(),599999);
  now++;c.sync('game',false);assert.equal(c.elapsed(),600000);
  c.sync('new',true);assert.equal(c.elapsed(),0);
});
test('periodic checkpoints survive a forced termination without counting the closed interval',()=>{
  const storage=memory();let now=0,c=createGameTime(storage,{now:()=>now});
  c.sync('game',true);now=90000;c.sync('game',true);
  now=0;c=createGameTime(storage,{now:()=>now});assert.equal(c.elapsed(),90000);
  c.sync('game',true);now=2000;assert.equal(c.elapsed(),92000);
});
test('invalid timing data and blocked storage cannot break play',()=>{
  const storage=memory();storage.setItem(GAME_TIME_KEY,JSON.stringify({gameId:'game',elapsed:-1}));
  const clock=createGameTime(storage,{now:()=>0});assert.equal(clock.elapsed(),0);
  const blocked=createGameTime({getItem(){throw Error();},setItem(){throw Error();}},{now:()=>1});
  blocked.sync('game',true);assert.equal(blocked.elapsed(),0);
});
