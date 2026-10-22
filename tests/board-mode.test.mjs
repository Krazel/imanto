import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoardMode} from '../web/board-mode.mjs';
import {createPersonalBest} from '../web/personal-best.mjs';
import {createGameTime} from '../web/game-time.mjs';
test('complete board modes isolate saved games, records and active timers',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const five=createBoardMode(),six=createBoardMode(6);
  for(const mode of [five,six]){
    const game=mode.createGame(()=>.3);storage.setItem(mode.saveKey,JSON.stringify(game));
    assert.equal(game.board.length,mode.size**2);assert.ok(mode.restoreGame(game));
    createPersonalBest(storage,mode.bestKey).update(mode.size*100);
    let now=0;const timer=createGameTime(storage,{key:mode.timeKey,now:()=>now});timer.sync(String(mode.size),true);now=mode.size*1000;timer.sync(String(mode.size),false);
  }
  assert.equal(five.restoreGame(JSON.parse(storage.getItem(six.saveKey))),null);
  assert.equal(createPersonalBest(storage,five.bestKey).get(),500);assert.equal(createPersonalBest(storage,six.bestKey).get(),600);
  assert.equal(createGameTime(storage,{key:five.timeKey}).elapsed(),5000);assert.equal(createGameTime(storage,{key:six.timeKey}).elapsed(),6000);
});
test('6×6 full mode clears lines, refills its hand, keeps combos and supports one removal',async()=>{
  const m=createBoardMode(6);let s=m.createGame(()=>.3);s.board=Array(36).fill(null);s.nextId=1;
  for(let at=12;at<17;at++)s.board[at]={id:s.nextId++,color:'coral'};
  s.tray=['coral','teal','honey'].map(color=>({id:s.nextId++,color}));s.nextTray=['teal','honey','coral'].map(color=>({id:s.nextId++,color}));
  s=m.playTurn(s,17,0,()=>.3).state;assert.equal(s.score,50);assert.equal(s.combo.count,1);
  s=m.playTurn(s,0,1,()=>.3).state;s=m.playTurn(s,35,2,()=>.3).state;
  assert.equal(s.round,2);assert.equal(s.tray.filter(Boolean).length,3);assert.ok(m.restoreGame(s));
  assert.equal(m.applyLineCheck(s,{unknown:true}),s,'An unfinished search never causes false game over');
  s={...s,over:true,endReason:'no-lines',gameId:'six-removal'};
  s=m.settleCreditRemoval(m.beginCreditRemoval(s),{ok:true,gameId:s.gameId,receipt:'qa'});
  s=m.removeForCredit(s,s.board.findIndex(Boolean));assert.equal(s.over,false);assert.equal(m.blockRemovalStatus(s),'used');assert.equal(m.reviveStatus(s),'used');
});
