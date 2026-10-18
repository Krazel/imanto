import {BASIC_PHYSICS,normalizePhysics,repelOnce,contactPairs} from './physics.mjs';
import {readCombo,scoreCombo} from './combo.mjs';
export {BASIC_PHYSICS,LAB_PHYSICS,normalizePhysics,repelOnce,contactPairs} from './physics.mjs';
export const SIZE=5;
export const COLORS=['coral','teal','honey','violet'];
export const VIOLET_ROUND=4;
export const OPENING_TILES=Object.freeze({min:4,max:8});
const clone=b=>b.map(p=>p?{...p}:null);
export function drawPiece(state,others=[],random=Math.random,round=state.round||1){
  const palette=round>=VIOLET_ROUND?COLORS:COLORS.slice(0,3);
  const pool=palette.filter(color=>!others.some(p=>p.color===color));
  const color=pool[Math.min(pool.length-1,Math.max(0,Math.floor(random()*pool.length)))];
  return {id:state.nextId++,color};
}
export function drawHand(state,round,random=Math.random){
  const hand=[];for(let n=0;n<3;n++)hand.push(drawPiece(state,hand,random,round));return hand;
}
export function createGame(random=Math.random,opening={}){
  const min=opening.min??OPENING_TILES.min,max=opening.max??OPENING_TILES.max;
  if(!Number.isInteger(min)||!Number.isInteger(max)||min<1||max>8||min>max)throw Error('Invalid opening bounds (1–8 tiles)');
  const roll=n=>Math.min(n-1,Math.max(0,Math.floor(random()*n)));
  const state={version:6,board:Array(25).fill(null),tray:[],nextTray:[],round:1,score:0,turns:0,nextId:1,over:false,endReason:null,combo:{count:0,lastRound:null},revive:'available'};
  const count=min+roll(max-min+1),positions=Array.from({length:25},(_,i)=>i);
  for(let n=positions.length-1;n>0;n--){const j=roll(n+1);[positions[n],positions[j]]=[positions[j],positions[n]];}
  for(const at of positions.slice(0,count)){
    let color=roll(3);state.board[at]={id:state.nextId++,color:COLORS[color]};
    // An opening must not contain an already completed (unpaid) line.
    if(completedLines(state.board).length)state.board[at].color=COLORS[(color+1)%3];
  }
  state.tray=drawHand(state,1,random);state.nextTray=drawHand(state,2,random);return state;
}
export const reviveStatus=state=>state.revive??'available';
export const blockRemovalStatus=state=>state.blockRemoval??'available';
export function beginCreditRemoval(state){
  if(state.over||blockRemovalStatus(state)!=='available'||!state.gameId||!state.board.some(Boolean))throw Error('Removal unavailable');
  return {...state,blockRemoval:'pending'};
}
export function settleCreditRemoval(state,claim){
  if(blockRemovalStatus(state)!=='pending')return state;
  if(claim?.denied===true&&claim.gameId===state.gameId){
    return {...state,blockRemoval:'available'};
  }
  if(claim?.ok!==true||claim.gameId!==state.gameId||typeof claim.receipt!=='string'||!claim.receipt)return state;
  return {...state,blockRemoval:'earned',removalReceipt:claim.receipt};
}
export function removeForCredit(state,at){
  if(blockRemovalStatus(state)!=='earned'||!Number.isInteger(at)||!state.board[at])throw Error('Removal unavailable');
  const board=clone(state.board);board[at]=null;return {...state,board,over:false,endReason:null,blockRemoval:'used'};
}
export function beginPaidRevive(state){
  if(!state.over||reviveStatus(state)!=='available'||!state.gameId)throw Error('Revive unavailable');
  return {...state,revive:'pending',reviveSource:'paid'};
}
export function settlePaidRevive(state,claim){
  if(reviveStatus(state)!=='pending'||state.reviveSource!=='paid')return state;
  if(claim?.denied===true&&claim.gameId===state.gameId)return {...state,revive:'available',reviveSource:null};
  if(claim?.ok!==true||claim.gameId!==state.gameId||!claim.receipt)return state;
  return {...state,revive:'earned',reviveReceipt:claim.receipt};
}
export function beginRevive(state){
  if(!state.over||reviveStatus(state)!=='available')throw Error('Revive unavailable');
  return {...state,revive:'pending',reviveSource:'video'};
}
export function settleRevive(state,{shown=false,earned=false,uncertain=false}={}){
  if(reviveStatus(state)!=='pending')return state;
  return {...state,revive:uncertain?'used':shown?(earned?'earned':'used'):'available'};
}
export function removeForRevive(state,at){
  if(!state.over||reviveStatus(state)!=='earned'||!Number.isInteger(at)||!state.board[at])throw Error('Revive removal unavailable');
  const board=clone(state.board);board[at]=null;
  // No pulse, extra hand, points, turn or combo reward: remove exactly one tile.
  return {...state,board,over:false,endReason:null,revive:'used'};
}
export function completedLines(board){
  const lines=[];
  for(let n=0;n<SIZE;n++){
    const row=Array.from({length:SIZE},(_,c)=>n*SIZE+c),column=Array.from({length:SIZE},(_,r)=>r*SIZE+n);
    if(row.every(i=>board[i]&&board[i].color===board[row[0]]?.color))lines.push({axis:'row',index:n,cells:row});
    if(column.every(i=>board[i]&&board[i].color===board[column[0]]?.color))lines.push({axis:'column',index:n,cells:column});
  }
  return lines;
}
export const linePoints=count=>50*count*count;
export function resolveBoard(input,physics=BASIC_PHYSICS,{triggerId=null}={}){
  let total=0,lineCount=0,clearWaves=0,maxSimultaneous=0,allClears=0;
  function clear(board){
    const lines=completedLines(board),frames=[];
    if(lines.length){
      const cleared=[...new Set(lines.flatMap(line=>line.cells))],gain=linePoints(lines.length);
      const allClear=cleared.length===board.filter(Boolean).length;
      frames.push({kind:'clear',board:clone(board),cleared,lines,lineCount:lines.length,gain,allClear});
      board=clone(board);for(const i of cleared)board[i]=null;
      frames.push({kind:'settle',board:clone(board)});
      total+=gain;lineCount+=lines.length;clearWaves++;maxSimultaneous=Math.max(maxSimultaneous,lines.length);if(allClear)allClears++;
    }
    return {board,frames};
  }
  // Lines have priority, including a line completed by the placed magnet.
  // Only the placed tile emits; a cleared or moved tile never starts a pulse.
  const initial=clear(clone(input));
  const result=repelOnce(initial.board,normalizePhysics(physics),{triggerId});
  const final=clear(result.board);
  return {...result,board:final.board,contacts:contactPairs(final.board),frames:[...initial.frames,...result.frames,...final.frames],total,lineCount,clearWaves,maxSimultaneous,allClears};
}
export function simulate(board,at,piece,physics=BASIC_PHYSICS){
  if(!Number.isInteger(at)||at<0||at>=25||board[at])throw Error('Casilla no disponible');
  const next=clone(board);next[at]={id:piece.id,color:piece.color};
  const result=resolveBoard(next,physics,{triggerId:piece.id});
  return {...result,frames:[{kind:'place',board:clone(next),at},...result.frames]};
}
// Search stops at the first line, so it needs neither animation frames nor
// removal/scoring. Movement and line detection use the same game functions.
export function probeLine(board,at,piece,physics=BASIC_PHYSICS){
  const next=board.slice();next[at]=piece;
  const initial=completedLines(next).length;if(initial)return {board:next,lineCount:initial};
  const result=repelOnce(next,physics,{triggerId:piece.id,detail:false});
  return {board:result.board,lineCount:completedLines(result.board).length};
}
export function playTurn(state,at,option,random=Math.random,physics=BASIC_PHYSICS){
  if(state.over||!Number.isInteger(option)||option<0||option>=3||!state.tray[option])throw Error('Turno no disponible');
  const base=simulate(state.board,at,state.tray[option],physics);
  const combo=scoreCombo(state.combo,state.round,base.total>0),multiplier=base.total?combo.count:1;
  const result={...base,total:base.total*multiplier,baseTotal:base.total,multiplier,
    frames:base.frames.map(frame=>frame.kind==='clear'?{...frame,baseGain:frame.gain,gain:frame.gain*multiplier,multiplier}:frame)};
  const next={...state,board:result.board,tray:clone(state.tray),nextTray:clone(state.nextTray),
    score:state.score+result.total,turns:state.turns+1,over:result.board.every(Boolean),endReason:result.board.every(Boolean)?'full':null};
  next.tray[option]=null;const newRound=next.tray.every(p=>p===null);
  if(newRound){next.round++;next.tray=next.nextTray;next.nextTray=drawHand(next,next.round+1,random);}
  next.combo=readCombo(combo,next.round);
  return {state:next,newRound,...result};
}
function validState(s,schema=6){
  const old=schema<5,legacy=schema===1;
  const piece=p=>p&&Number.isSafeInteger(p.id)&&p.id>0&&COLORS.includes(p.color)&&
    (old?[-1,1].includes(p.pole):!Object.hasOwn(p,'pole'));
  if(!s||typeof s!=='object'||('revive' in s&&!['available','pending','earned','used'].includes(s.revive))||('blockRemoval' in s&&!['available','pending','earned','used'].includes(s.blockRemoval))||s.version!==schema||!Array.isArray(s.board)||s.board.length!==25||
    !s.board.every(p=>p===null||piece(p))||!Array.isArray(s.tray)||s.tray.length!==3||
    !s.tray.every(p=>piece(p)||(!legacy&&p===null))||!s.tray.some(Boolean)||
    !Number.isSafeInteger(s.score)||s.score<0||!Number.isSafeInteger(s.turns)||s.turns<0||
    !Number.isSafeInteger(s.nextId)||typeof s.over!=='boolean')return false;
  if(!legacy&&(!Number.isSafeInteger(s.round)||s.round<1||!Array.isArray(s.nextTray)||s.nextTray.length!==3||!s.nextTray.every(piece)))return false;
  const pieces=[...s.board.filter(Boolean),...s.tray.filter(Boolean),...(legacy?[]:s.nextTray)];
  if(new Set(pieces.map(p=>p.id)).size!==pieces.length||!pieces.every(p=>p.id<s.nextId))return false;
  if(schema>=4&&completedLines(s.board).length)return false;
  if(schema===6)return s.over?(s.endReason==='full'?s.board.every(Boolean):s.endReason==='no-lines'&&!s.board.every(Boolean)):s.endReason===null&&!s.board.every(Boolean);
  return schema===3?!s.over:s.over===s.board.every(Boolean);
}
export const isValidSave=s=>validState(s);
export function restoreGame(saved,random=Math.random){
  if(![6,5,4,3,2,1].some(v=>validState(saved,v)))return null;
  const strip=pieces=>pieces.map(p=>p?{id:p.id,color:p.color}:null);
  const next={...structuredClone(saved),version:6,board:strip(saved.board),tray:strip(saved.tray)};
  if(saved.version===1){next.round=1;next.nextTray=drawHand(next,2,random);}
  else next.nextTray=strip(saved.nextTray);
  // Migration removes symbols but emits no artificial pulse and preserves every
  // stored coordinate, option, point and forecast unless an old line must clear.
  const result=resolveBoard(next.board);next.board=result.board;next.score+=result.total;
  next.over=next.board.every(Boolean)||(saved.version===6&&saved.endReason==='no-lines');
  next.endReason=next.over?(next.board.every(Boolean)?'full':'no-lines'):null;
  next.combo=readCombo(next.combo,next.round);
  // An interrupted fullscreen must never offer a second ad on reopening.
  // An already earned reward survives until the player chooses a tile.
  if(next.removalSource==='credit'&&!next.blockRemoval){next.blockRemoval=next.revive;next.revive='available';delete next.removalSource;}
  if(next.revive==='pending'&&next.reviveSource!=='paid')next.revive='used';
  return next;
}
