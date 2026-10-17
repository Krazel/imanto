import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,simulate,playTurn,resolveBoard,completedLines,linePoints,isValidSave,restoreGame} from '../web/engine.mjs';
const p=(id,color='coral')=>({id,color});
const board=()=>Array(25).fill(null);
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function emptyGame(seed=1){const s=createGame(rng(seed));s.board=board();return s;}
test('new game and each hand have color-only pieces and three different colors',()=>{
  for(let seed=1;seed<=30;seed++){
    const s=createGame(rng(seed));assert.ok(isValidSave(s));assert.equal(s.version,6);
    for(const hand of[s.tray,s.nextTray])assert.equal(new Set(hand.map(p=>p.color)).size,3);
    for(const piece of [...s.board,...s.tray,...s.nextTray].filter(Boolean))assert.deepEqual(Object.keys(piece).sort(),['color','id']);
  }
});
test('placement emits a one-cell repulsion from the new tile',()=>{
  const b=board();b[11]=p(1,'teal');
  const r=simulate(b,10,p(99));assert.equal(r.board[12].id,1);assert.equal(r.board[10].id,99);
  assert.equal(r.frames[0].kind,'place');assert.equal(r.physicsMoves,1);
});
test('two old tiles transmit only to the last, without a secondary perpendicular push',()=>{
  const b=board();b[11]=p(1,'teal');b[12]=p(2,'honey');b[8]=p(3,'violet');
  const r=simulate(b,10,p(99));
  assert.equal(r.board[11].id,1);assert.equal(r.board[13].id,2);assert.equal(r.board[8].id,3);
  assert.equal(r.physicsMoves,1);
});
test('mixed full row never clears, groups and diagonals do not score',()=>{
  const b=board();['coral','teal','honey','violet','coral'].forEach((c,i)=>b[i]=p(i+1,c));
  assert.deepEqual(completedLines(b),[]);assert.equal(resolveBoard(b).total,0);
  const diagonal=board();for(const i of[0,6,12,18,24])diagonal[i]=p(i+1);
  assert.equal(resolveBoard(diagonal).total,0);
});
test('a completed monochrome row clears before repulsion can break it',()=>{
  const b=board();for(let i=0;i<4;i++)b[i]=p(i+1);
  const copy=structuredClone(b),r=simulate(b,4,p(99));
  assert.equal(r.total,50);assert.equal(r.board.filter(Boolean).length,0);
  assert.equal(r.physicsMoves,0);assert.deepEqual(b,copy);
});
test('monochrome column and crossing lines score correctly without duplicate removals',()=>{
  const b=board();for(const i of[10,11,13,14,2,7,17,22])b[i]=p(i+1);
  const r=simulate(b,12,p(99)),f=r.frames.find(f=>f.kind==='clear');
  assert.equal(r.total,200);assert.equal(r.maxSimultaneous,2);assert.equal(f.cleared.length,9);
  const column=board();for(const i of[0,5,10,15])column[i]=p(i+1,'teal');
  assert.equal(simulate(column,20,p(99,'teal')).total,50);
});
test('three simultaneous lines give 450; clearing alone does not emit an artificial pulse',()=>{
  const b=board();for(let r=0;r<3;r++)for(let c=0;c<5;c++)b[r*5+c]=p(r*5+c+1,['coral','teal','honey'][r]);
  b[20]=p(99);b[21]=p(100,'honey');
  const result=resolveBoard(b);assert.equal(result.total,450);assert.equal(result.maxSimultaneous,3);
  assert.equal(result.physicsMoves,0);assert.equal(result.board[20].id,99);
  assert.ok(linePoints(3)>3*linePoints(1));
});
test('a single pulse completes a line without triggering additional movements',()=>{
  const b=board();for(const i of[0,1,2,4])b[i]=p(i+1,'teal');b[8]=p(50,'teal');
  const r=simulate(b,13,p(99));
  assert.equal(r.total,50);assert.equal(r.physicsMoves,1);assert.equal(r.board[13].id,99);
  assert.equal(r.board.filter(Boolean).length,1);assert.deepEqual(r.frames.map(f=>f.kind),['place','move','clear','settle']);
});
test('one simultaneous pulse completes two different monochrome rows for 200 points',()=>{
  const b=board();for(const i of[0,1,3,4])b[i]=p(i+1,'teal');
  for(const i of[20,21,23,24])b[i]=p(i+1,'honey');
  b[7]=p(50,'teal');b[17]=p(51,'honey');
  const r=simulate(b,12,p(99));assert.equal(r.total,200);assert.equal(r.maxSimultaneous,2);
  assert.equal(r.frames.filter(f=>f.kind==='move').length,1);
  assert.equal(r.frames.find(f=>f.kind==='move').moves.length,2);
  assert.equal(r.board[12].id,99);assert.equal(r.board.filter(Boolean).length,1);
});
test('a full mixed board loses after the pulse, while full monochrome lines clear first',()=>{
  const s=emptyGame();s.board=Array.from({length:25},(_,i)=>p(i+100,['coral','teal','honey'][(Math.floor(i/5)+i%5)%3]));
  s.board[24]=null;s.nextId=200;s.tray=[p(190),p(191,'teal'),p(192,'honey')];
  assert.equal(playTurn(s,24,0,rng(3)).state.over,true);
  for(let i=0;i<24;i++)s.board[i]=p(i+100);
  const r=playTurn(s,24,0,rng(4));assert.equal(r.total,5000);assert.equal(r.state.over,false);
});
test('invalid placement and spent options do not mutate or consume a turn',()=>{
  const s=emptyGame();s.board[0]=p(99);s.nextId=100;const copy=structuredClone(s);
  for(const at of[0,-1,25,1.2])assert.throws(()=>playTurn(s,at,0));assert.deepEqual(s,copy);
  const next=playTurn(s,6,0).state;assert.throws(()=>playTurn(next,12,0));
});
test('hands consume all three and promote the exact announced forecast',()=>{
  let s=emptyGame(8),original=structuredClone(s),calls=0;const random=()=>{calls++;return .3;};
  s=playTurn(s,0,1,random).state;assert.equal(s.tray[1],null);assert.equal(calls,0);
  s=playTurn(s,6,0,random).state;assert.equal(calls,0);
  const last=playTurn(s,12,2,random);assert.equal(last.newRound,true);assert.equal(last.state.round,2);
  assert.deepEqual(last.state.tray,original.nextTray);assert.equal(calls,3);
  assert.equal(new Set(last.state.nextTray.map(p=>p.color)).size,3);
});
test('v4 migration removes signs, preserves all positions, score, partial hand and forecast',()=>{
  const old=emptyGame(6);old.version=4;old.score=150;old.round=6;old.turns=15;
  old.board[6]=p(100,'coral');old.board[7]=p(101,'teal');old.nextId=102;old.tray[1]=null;
  for(const list of[old.board,old.tray,old.nextTray])for(const piece of list)if(piece)piece.pole=piece.id%2?1:-1;
  const copy=structuredClone(old),next=restoreGame(old,rng(8));assert.ok(isValidSave(next));
  for(const key of['score','round','turns'])assert.deepEqual(next[key],old[key]);
  for(const key of['board','tray','nextTray'])assert.deepEqual(next[key],old[key].map(p=>p?{id:p.id,color:p.color}:null));
  assert.deepEqual(old,copy);assert.deepEqual(restoreGame(next),next);
});
test('old same-color alternatives are preserved through migration rather than rerolled',()=>{
  const old=emptyGame();old.version=4;old.tray[0].color='teal';old.tray[1].color='teal';
  for(const list of[old.board,old.tray,old.nextTray])for(const p of list)if(p)p.pole=1;
  const next=restoreGame(old);assert.ok(isValidSave(next));
  assert.deepEqual(next.tray.map(p=>p.color),old.tray.map(p=>p.color));
});
test('legacy v1 receives a forecast without losing points or options',()=>{
  const s=emptyGame(2),old={version:1,board:s.board,tray:s.tray,score:230,turns:17,nextId:20,over:false};
  for(const p of old.tray)p.pole=-1;
  const next=restoreGame(old,rng(5));assert.ok(isValidSave(next));assert.equal(next.score,230);
  assert.equal(next.version,6);assert.equal(next.round,1);assert.equal(next.nextTray.length,3);
});
test('current partial saves roundtrip and invalid identities or stale symbols are rejected',()=>{
  let s=emptyGame(4);s=playTurn(s,0,0,rng(8)).state;
  assert.deepEqual(restoreGame(s),s);assert.equal(isValidSave({...s,score:NaN}),false);
  assert.equal(isValidSave({...s,nextTray:s.tray}),false);assert.equal(restoreGame({...s,nextId:1}),null);
  const stale=structuredClone(s);stale.tray.find(Boolean).pole=1;assert.equal(isValidSave(stale),false);
});
test('100 random games preserve valid saves and allow only one simultaneous pulse per turn',()=>{
  for(let seed=1;seed<=100;seed++){
    const random=rng(seed);let s=createGame(random);
    for(let n=0;n<100&&!s.over;n++){
      const empty=s.board.map((p,i)=>p?null:i).filter(i=>i!==null),options=s.tray.map((p,i)=>p?i:null).filter(i=>i!==null);
      const r=playTurn(s,empty[Math.floor(random()*empty.length)],options[Math.floor(random()*options.length)],random);s=r.state;
      assert.ok(isValidSave(s));assert.deepEqual(completedLines(s.board),[]);
      assert.ok(r.physicsMoves<=4);assert.ok(r.frames.filter(f=>f.kind==='move').length<=1);
      for(const f of r.frames){const ids=f.board.filter(Boolean).map(p=>p.id);assert.equal(new Set(ids).size,ids.length);}
    }
  }
});
