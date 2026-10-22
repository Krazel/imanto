import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,restoreGame,beginPaidRevive,settlePaidRevive,removeForRevive,beginRevive,blockRemovalStatus,reviveStatus} from '../web/engine.mjs';
test('paid revive earned before interruption survives until one chosen block is removed',()=>{
  const original={...createGame(),gameId:'paid',over:true,endReason:'no-lines'};
  let state=beginPaidRevive(original);assert.equal(restoreGame(state).revive,'pending');
  state=settlePaidRevive(state,{ok:true,gameId:'paid',receipt:'r'});state=restoreGame(state);assert.equal(state.revive,'earned');
  const result=removeForRevive(state,state.board.findIndex(Boolean));assert.equal(result.revive,'used');assert.equal(result.blockRemoval,'used');
  for(const key of ['score','turns','round','tray','nextTray'])assert.deepEqual(result[key],original[key]);
  assert.throws(()=>beginRevive({...result,over:true}));assert.throws(()=>beginPaidRevive({...result,over:true}));
});
test('0.17 credited helper migrates to its own allowance and does not grant another removal',()=>{
  const old={...createGame(),gameId:'legacy',removalSource:'credit',revive:'used'};
  const migrated=restoreGame(old);assert.equal(blockRemovalStatus(migrated),'used');assert.equal(reviveStatus(migrated),'used');assert.deepEqual(migrated.board,old.board);
});
