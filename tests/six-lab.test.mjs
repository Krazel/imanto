import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,completedLines,simulate,playTurn,restoreGame,COLORS,probeLine} from '../web/six-lab/engine.mjs';
import {contactPairs} from '../web/six-lab/physics.mjs';
import {analyzeLines} from '../web/six-lab/line-search.mjs';
import {createGame as normalGame} from '../web/engine.mjs';
const piece=(id,color='coral')=>({id,color});
test('6x6 trial saves cannot overwrite or restore 5x5 geometry',()=>{
  const s=createGame(()=>.3);assert.equal(s.board.length,36);assert.equal(s.tray.length,3);assert.ok(restoreGame(s));
  assert.equal(normalGame(()=>.3).board.length,25);assert.equal(restoreGame(normalGame(()=>.3)),null);
});
test('six required; last row and column can clear',()=>{
  const b=Array(36).fill(null);for(let i=30;i<35;i++)b[i]=piece(i+1);
  assert.equal(completedLines(b).length,0);const r=simulate(b,35,piece(99));assert.equal(r.total,50);assert.equal(r.board.filter(Boolean).length,0);
  const c=Array(36).fill(null);for(let i=5;i<35;i+=6)c[i]=piece(i+1);
  assert.equal(simulate(c,35,piece(99)).lineCount,1);
});
test('simultaneous crossing lines count twice and clear eleven distinct cells',()=>{
  const b=Array(36).fill(null);for(let i=0;i<6;i++){b[12+i]=piece(12+i);b[i*6+2]=piece(50+i);}b[14]=null;
  const r=simulate(b,14,piece(100));assert.equal(r.lineCount,2);assert.equal(r.total,200);assert.equal(r.frames.find(f=>f.kind==='clear').cleared.length,11);
});
test('six-wide boundaries never wrap; transmission moves last tile only',()=>{
  const b=Array(36).fill(null);b[31]=piece(1);b[32]=piece(2);
  const r=simulate(b,30,piece(9,'teal'));assert.equal(r.board[31].id,1);assert.equal(r.board[32],null);assert.equal(r.board[33].id,2);assert.equal(r.board[30].id,9);
  const c=Array(36).fill(null);c[5]=piece(1);c[6]=piece(2);assert.deepEqual(contactPairs(c),[]);
  assert.equal(simulate(c,11,piece(9,'teal')).board[6].id,2);
});
test('last-cell placement stays in state, consumes one option, and preserves input',()=>{
  const s=createGame(()=>.4);s.board=Array(36).fill(null);const copy=structuredClone(s);const r=playTurn(s,35,0,()=>.4);
  assert.equal(r.state.board[35].id,s.tray[0].id);assert.equal(r.state.tray[0],null);assert.deepEqual(s,copy);assert.ok(restoreGame(r.state));
});
test('search handles bit positions32–35 and finds winning last-cell placement',()=>{
  const s=createGame(()=>.2);s.board=Array(36).fill(null);for(let i=30;i<35;i++)s.board[i]=piece(s.nextId++);
  const result=analyzeLines(s);assert.equal(result.possible,true);let b=s.board,id=s.nextId;let lines=0;for(const step of result.path){const r=simulate(b,step.at,piece(id++,step.color));b=r.board;lines+=r.lineCount;}assert.ok(lines>0);
});
test('36-cell search agrees with exhaustive short trees across high and low holes',()=>{
  function brute(board,hand,slots){if(completedLines(board).length)return true;if(!slots){hand=COLORS;slots=3;}for(const color of hand)for(let at=0;at<36;at++)if(!board[at]){const r=probeLine(board,at,piece(1000+board.filter(Boolean).length,color));if(r.lineCount||brute(r.board,hand.filter(c=>c!==color),slots-1))return true;}return false;}
  for(let seed=0;seed<8;seed++){const s=createGame(()=>.2);s.round=5;s.board=Array.from({length:36},(_,i)=>piece(s.nextId++,COLORS[(i*7+Math.floor(i/6)+seed)%4]));for(const i of[seed,32,35])s.board[i]=null;assert.equal(analyzeLines(s).possible,brute(s.board,COLORS,3));}
});
