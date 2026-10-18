import test from 'node:test';
import assert from 'node:assert/strict';
import {installBoardPress} from '../web/board-press.mjs';
function surface(){const listeners=new Map();return {addEventListener:(type,fn)=>{if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},fire(type,values={}){const event={pointerId:1,pointerType:'touch',isPrimary:true,button:0,clientX:10,clientY:20,preventDefault(){this.prevented=true;},...values};for(const fn of listeners.get(type)||[])fn(event);return event;}};}
function setup(){
  const board=surface(),doc=surface(),win=surface(),hover=[],drops=[];let time=1000,allowed=true;
  const cells=Array.from({length:25},(_,at)=>({dataset:{at:String(at)},disabled:false,closest(){return this;}}));
  board.contains=cell=>cells.includes(cell);doc.hit=cells[0];doc.elementFromPoint=()=>doc.hit;
  const captures=new Set();board.setPointerCapture=id=>captures.add(id);board.hasPointerCapture=id=>captures.has(id);board.releasePointerCapture=id=>{captures.delete(id);board.fire('lostpointercapture',{pointerId:id});};
  const control=installBoardPress({board,document:doc,window:win,canStart:()=>allowed,onHover:at=>hover.push(at),onDrop:at=>drops.push(at),now:()=>time});
  const down=(at=0,extra={})=>{doc.hit=cells[at];return board.fire('pointerdown',{target:cells[at],...extra});};
  const move=(at,extra={})=>{doc.hit=at===null?null:cells[at];return board.fire('pointermove',extra);};
  const up=(at,extra={})=>{doc.hit=at===null?null:cells[at];return board.fire('pointerup',extra);};
  return {board,doc,win,cells,control,hover,drops,captures,down,move,up,advance:()=>time+=700,block:()=>allowed=false};
}
test('a stationary long press still places once on release and suppresses its compatibility click',()=>{
  const s=setup();s.down(2);s.advance();assert.deepEqual(s.drops,[]);assert.equal(s.control.suppressClick(),true);
  s.up(2);s.up(2);assert.deepEqual(s.drops,[2]);assert.equal(s.control.suppressClick(),true);assert.equal(s.captures.size,0);
  s.advance();assert.equal(s.control.suppressClick(),false);
});
test('sliding follows successive cells without spending a turn; final release chooses the actual endpoint',()=>{
  const s=setup();s.down(0);s.move(6);s.move(6);s.move(12);assert.deepEqual(s.hover,[0,6,12]);assert.deepEqual(s.drops,[]);
  s.up(18);assert.deepEqual(s.hover,[0,6,12,18,null]);assert.deepEqual(s.drops,[18]);
});
test('outside, occupied and foreign cells clear the preview and cannot accept a drop; re-entry can',()=>{
  const s=setup();s.cells[7].disabled=true;s.down();s.move(7);assert.equal(s.hover.at(-1),null);s.up(7);assert.deepEqual(s.drops,[]);
  s.down();s.move(null);s.move(3);s.up(3);assert.deepEqual(s.drops,[3]);
  s.down();s.up(null);assert.deepEqual(s.drops,[3]);
  s.down();s.doc.hit={dataset:{at:'4'},closest(){return this;}};s.board.fire('pointerup');assert.deepEqual(s.drops,[3]);
});
test('only the owning primary touch or pen can move or finish a press; mouse clicks remain unchanged',()=>{
  const s=setup();s.down(0,{pointerType:'mouse'});assert.equal(s.control.active(),false);assert.equal(s.control.suppressClick(),false);
  s.down(0,{isPrimary:false});assert.equal(s.control.active(),false);
  s.down(0,{pointerType:'pen',pointerId:4});s.down(3,{pointerId:5,isPrimary:false});s.move(8,{pointerId:5});s.up(8,{pointerId:5});assert.deepEqual(s.drops,[]);
  s.up(6,{pointerId:4});assert.deepEqual(s.drops,[6]);
});
test('cancel, lost capture, blur, hidden page, Escape and changed game state never place a block',()=>{
  for(const cancel of [s=>s.board.fire('pointercancel'),s=>s.board.fire('lostpointercapture'),s=>s.win.fire('blur'),s=>{s.doc.hidden=true;s.doc.fire('visibilitychange');},s=>s.doc.fire('keydown',{key:'Escape'}),s=>s.control.cancel()]){
    const s=setup();s.down();s.move(4);cancel(s);s.up(4);assert.deepEqual(s.drops,[]);assert.equal(s.control.active(),false);assert.equal(s.hover.at(-1),null);
  }
  const s=setup();s.down();s.block();s.up(4);assert.deepEqual(s.drops,[]);
});
