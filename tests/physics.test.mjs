import test from 'node:test';
import assert from 'node:assert/strict';
import {repelOnce,displacementOptions,contactPairs,BASIC_PHYSICS} from '../web/physics.mjs';
const p=(id,color='coral')=>({id,color});
const empty=()=>Array(25).fill(null);
const at=(board,id)=>board.findIndex(p=>p?.id===id);
test('all colors repel once while the placed source remains anchored',()=>{
  for(const color of['coral','teal','honey','violet']){
    const b=empty();b[11]=p(1);b[12]=p(2,color);
    const r=repelOnce(b,BASIC_PHYSICS,{triggerId:1});
    assert.equal(at(r.board,1),11);assert.equal(at(r.board,2),13);assert.equal(r.physicsMoves,1);
  }
});
test('diagonal and distant tiles do not react',()=>{
  for(const target of[8,14,16,18]){
    const b=empty();b[12]=p(1);b[target]=p(2);
    const r=repelOnce(b,BASIC_PHYSICS,{triggerId:1});
    assert.deepEqual(r.board,b);assert.equal(r.frames.length,0);
  }
});
test('four directions move in the same animation frame from the same board',()=>{
  const b=empty();b[12]=p(1);for(const i of[7,13,17,11])b[i]=p(i+10);
  const r=repelOnce(b,BASIC_PHYSICS,{triggerId:1});
  for(const[from,to]of[[7,2],[13,14],[17,22],[11,10]])assert.equal(at(r.board,from+10),to);
  assert.equal(r.physicsMoves,4);assert.equal(r.frames.length,1);assert.equal(r.frames[0].moves.length,4);
});
test('blocked row still transmits only to the outermost tile with an exit',()=>{
  const b=empty();b[10]=p(1);b[11]=p(2);b[12]=p(3);
  const r=repelOnce(b,BASIC_PHYSICS,{triggerId:1});
  assert.equal(at(r.board,1),10);assert.equal(at(r.board,2),11);assert.equal(at(r.board,3),13);
  assert.equal(r.physicsMoves,1);assert.deepEqual(r.frames[0].moves[0].via,[11,12]);
});
test('a displaced tile never emits to its new perpendicular neighbor',()=>{
  const b=empty();b[10]=p(1);b[11]=p(2);b[12]=p(3);b[8]=p(4);
  const r=repelOnce(b,BASIC_PHYSICS,{triggerId:1});
  assert.equal(at(r.board,3),13);assert.equal(at(r.board,4),8);assert.equal(r.physicsMoves,1);
});
test('wall turns right, or left when preferred or when right is blocked',()=>{
  const b=empty();b[7]=p(1);b[2]=p(2);
  assert.equal(at(repelOnce(b,{sideways:true},{triggerId:1}).board,2),3);
  assert.equal(at(repelOnce(b,{sideways:true,turn:'left'},{triggerId:1}).board,2),1);
  b[3]=p(3);assert.equal(displacementOptions(b,2,-1,0,{sideways:true})[0].to,1);
});
test('no exit means no movement; the source does not move as a substitute',()=>{
  const b=Array.from({length:25},(_,i)=>p(i+1));
  const r=repelOnce(b,BASIC_PHYSICS,{triggerId:13});
  assert.deepEqual(r.board,b);assert.equal(r.physicsMoves,0);
});
test('turning can be disabled without moving the source',()=>{
  const b=empty();b[7]=p(1);b[2]=p(2);
  assert.deepEqual(repelOnce(b,{sideways:false},{triggerId:1}).board,b);
});
test('stationary contacts do not start a second reaction elsewhere',()=>{
  const b=empty();b[0]=p(1);b[1]=p(2);b[24]=p(3);
  const r=repelOnce(b,BASIC_PHYSICS,{triggerId:3});
  assert.deepEqual(r.board,b);assert.equal(contactPairs(r.board).length,1);
});
test('simultaneous sideways destinations cannot overlap; an alternate free side is used',()=>{
  const b=empty();for(const i of[1,2,3,6,7,9,12,13,14,19])b[i]=p(i+1);
  const r=repelOnce(b,{sideways:true,turn:'left'},{triggerId:13});
  assert.equal(at(r.board,8),8);assert.equal(at(r.board,14),18);
  assert.equal(r.physicsMoves,2);assert.equal(r.frames.length,1);
  assert.equal(new Set(r.frames[0].moves.map(m=>m.to)).size,2);
});
test('400 randomized pulses conserve identities, use initially empty adjacent destinations and finish in one frame',()=>{
  let seed=42;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let n=0;n<400;n++){
    const b=empty();for(let i=0;i<25;i++)if(random()<.65)b[i]=p(i+1);
    const ids=b.filter(Boolean).map(p=>p.id);if(!ids.length)continue;
    const triggerId=ids[Math.floor(random()*ids.length)],copy=structuredClone(b);
    const r=repelOnce(b,BASIC_PHYSICS,{triggerId});
    assert.deepEqual(b,copy);assert.deepEqual(r.board.filter(Boolean).map(p=>p.id).sort((a,b)=>a-b),ids);
    assert.equal(at(r.board,triggerId),at(b,triggerId));assert.ok(r.physicsMoves<=4);assert.ok(r.frames.length<=1);
    for(const f of r.frames){
      assert.equal(new Set(f.moves.map(m=>m.to)).size,f.moves.length);
      for(const m of f.moves){
        assert.equal(b[m.to],null);assert.equal(b[m.from].id,m.id);
        assert.equal(Math.abs(Math.floor(m.to/5)-Math.floor(m.from/5))+Math.abs(m.to%5-m.from%5),1);
      }
    }
  }
});
