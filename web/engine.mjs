import {BASIC_PHYSICS,normalizePhysics,repelOnce,contactPairs} from './physics.mjs';
export {BASIC_PHYSICS,LAB_PHYSICS,normalizePhysics,repelOnce,contactPairs} from './physics.mjs';
export const SIZE=5;
export const COLORS=['coral','teal','honey','violet'];
export const VIOLET_ROUND=4;
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
export function createGame(random=Math.random){
  const state={version:6,board:Array(25).fill(null),tray:[],nextTray:[],round:1,score:0,turns:0,nextId:1,over:false,endReason:null};
  for(const[at,color]of[[2,'coral'],[6,'teal'],[8,'coral'],[16,'teal'],[18,'honey'],[22,'honey']])
    state.board[at]={id:state.nextId++,color};
  state.tray=drawHand(state,1,random);state.nextTray=drawHand(state,2,random);return state;
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
  const result=simulate(state.board,at,state.tray[option],physics);
  const next={...state,board:result.board,tray:clone(state.tray),nextTray:clone(state.nextTray),
    score:state.score+result.total,turns:state.turns+1,over:result.board.every(Boolean),endReason:result.board.every(Boolean)?'full':null};
  next.tray[option]=null;const newRound=next.tray.every(p=>p===null);
  if(newRound){next.round++;next.tray=next.nextTray;next.nextTray=drawHand(next,next.round+1,random);}
  return {state:next,newRound,...result};
}
function validState(s,schema=6){
  const old=schema<5,legacy=schema===1;
  const piece=p=>p&&Number.isSafeInteger(p.id)&&p.id>0&&COLORS.includes(p.color)&&
    (old?[-1,1].includes(p.pole):!Object.hasOwn(p,'pole'));
  if(!s||s.version!==schema||!Array.isArray(s.board)||s.board.length!==25||
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
  next.endReason=next.over?(next.board.every(Boolean)?'full':'no-lines'):null;return next;
}
