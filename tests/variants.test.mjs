import test from 'node:test';
import assert from 'node:assert/strict';
import {VARIANTS,loadComparison,variantSaveKey} from '../web/variants.mjs';
import {repelOnce,normalizePhysics} from '../web/physics.mjs';
import {playTurn,isValidSave} from '../web/engine.mjs';
const p=id=>({id,color:'coral'});
const b=()=>Array(25).fill(null);
const at=(board,id)=>board.findIndex(p=>p?.id===id);
const storage=()=>{
  const data=new Map([['krazel-imanes-v5','main untouched'],['krazel-imanes-lab-v5','lab untouched']]);
  return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),data};
};
test('three versions remove exactly the requested mechanics',()=>{
  assert.deepEqual(Object.values(VARIANTS).map(v=>[v.sideways,v.transmit]),[[false,true],[true,false],[false,false]]);
  assert.equal(normalizePhysics({}).transmit,true,'existing original and saved lab keep transmission by default');
});
test('wall: only the version retaining sideways movement can escape',()=>{
  const board=b();board[7]=p(1);board[2]=p(2);
  for(const[id,rules]of Object.entries(VARIANTS)){
    const result=repelOnce(board,rules,{triggerId:1});
    assert.equal(at(result.board,1),7);
    assert.equal(at(result.board,2),id==='no-row'?3:2);
  }
});
test('occupied row: tail moves, immediate neighbor diverts, or nobody moves depending on variant',()=>{
  const board=b();board[10]=p(1);board[11]=p(2);board[12]=p(3);
  const straight=repelOnce(board,VARIANTS['no-turn'],{triggerId:1});
  assert.equal(at(straight.board,2),11);assert.equal(at(straight.board,3),13);
  const neighbor=repelOnce(board,VARIANTS['no-row'],{triggerId:1});
  assert.equal(at(neighbor.board,2),16);assert.equal(at(neighbor.board,3),12);
  const simple=repelOnce(board,VARIANTS.simple,{triggerId:1});assert.deepEqual(simple.board,board);
});
test('all three versions still move free direct neighbors together and leave diagonals still',()=>{
  const board=b();board[12]=p(1);board[7]=p(2);board[13]=p(3);board[18]=p(4);
  for(const rules of Object.values(VARIANTS)){
    const result=repelOnce(board,rules,{triggerId:1});
    assert.equal(at(result.board,1),12);assert.equal(at(result.board,2),2);
    assert.equal(at(result.board,3),14);assert.equal(at(result.board,4),18);
    assert.equal(result.frames.length,1);assert.equal(result.frames[0].moves.length,2);
  }
});
test('three initial saves clone one fresh common board, hand and forecast without touching main or lab',()=>{
  const s=storage();let calls=0;const random=()=>{calls++;return .25;};
  const copies=Object.keys(VARIANTS).map(id=>loadComparison(id,s,random));
  assert.equal(calls,6);assert.ok(copies.every(isValidSave));
  assert.deepEqual(copies[0],copies[1]);assert.deepEqual(copies[1],copies[2]);
  copies[0].board[2]=null;assert.ok(copies[1].board[2]);
  assert.equal(s.data.get('krazel-imanes-v5'),'main untouched');
  assert.equal(s.data.get('krazel-imanes-lab-v5'),'lab untouched');
});
test('playing and reloading one variant preserves its hand without advancing the other two',()=>{
  const s=storage(),baseline=loadComparison('simple',s,()=>.2);
  loadComparison('no-turn',s);loadComparison('no-row',s);
  const next=playTurn(baseline,0,0,()=>.1,VARIANTS.simple).state;
  s.setItem(variantSaveKey('simple'),JSON.stringify(next));
  assert.deepEqual(loadComparison('simple',s),next);assert.equal(next.tray[0],null);
  assert.deepEqual(loadComparison('no-turn',s),baseline);assert.deepEqual(loadComparison('no-row',s),baseline);
});
test('repeat common start resets only that version and restores its original forecast',()=>{
  const s=storage(),baseline=loadComparison('simple',s,()=>.2);
  const other=loadComparison('no-row',s);
  const next=playTurn(baseline,0,0,()=>.1,VARIANTS.simple).state;
  s.setItem(variantSaveKey('simple'),JSON.stringify(next));
  assert.deepEqual(loadComparison('simple',s,()=>.9,{restart:true}),baseline);
  assert.deepEqual(loadComparison('no-row',s),other);
});
test('blocked storage remains playable and unknown variant ids are rejected',()=>{
  const s={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};
  assert.ok(isValidSave(loadComparison('simple',s)));
  assert.throws(()=>loadComparison('missing',s));
});
