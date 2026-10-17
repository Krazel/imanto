const SIZE=5;
const clone=b=>b.map(p=>p?{...p}:null);
const inside=(r,c)=>r>=0&&c>=0&&r<SIZE&&c<SIZE;
export const DIRECTIONS=Object.freeze([[-1,0],[0,1],[1,0],[0,-1]]);
export const BASIC_PHYSICS=Object.freeze({sideways:false,transmit:true,turn:'right',speed:160});
export const LAB_PHYSICS=BASIC_PHYSICS;
export function normalizePhysics(value={}){
  return {sideways:typeof value.sideways==='boolean'?value.sideways:false,
    transmit:typeof value.transmit==='boolean'?value.transmit:true,
    turn:value.turn==='left'?'left':'right',
    speed:Math.max(40,Math.min(400,Math.round(Number(value.speed)||160)))};
}
export function contactPairs(board){
  const pairs=[];
  for(let i=0;i<25;i++)if(board[i])
    for(const j of[i%5<4?i+1:-1,i<20?i+5:-1])if(j>=0&&board[j])pairs.push([i,j]);
  return pairs;
}
const neighbor=(at,dr,dc)=>{
  const r=Math.floor(at/5)+dr,c=at%5+dc;
  return inside(r,c)?r*5+c:-1;
};
// Preserve the agreed row rule: transmit to the last tile with an exit,
// without sliding its predecessors into the cell it vacates.
export function displacementOptions(board,from,dr,dc,settings=BASIC_PHYSICS,via=[]){
  if(!board[from])return [];
  const options=normalizePhysics(settings),to=neighbor(from,dr,dc),path=[...via,from],moves=[];
  if(to>=0){
    if(!board[to])moves.push({from,to,id:board[from].id,path:[to],via:path,kind:'repel',sideways:false});
    else if(options.transmit)moves.push(...displacementOptions(board,to,dr,dc,options,path));
  }
  if(options.sideways){
    const right=[dc,-dr],left=[-dc,dr];
    for(const[r,c]of(options.turn==='right'?[right,left]:[left,right])){
      const side=neighbor(from,r,c);
      if(side>=0&&!board[side])moves.push({from,to:side,id:board[from].id,path:[side],via:path,kind:'repel',sideways:true});
    }
  }
  return moves;
}
export function repelOnce(input,settings=BASIC_PHYSICS,{triggerId=null,detail=true}={}){
  const board=detail?clone(input):input.slice(),origin=board.findIndex(p=>p?.id===triggerId),moves=[];
  if(origin<0)return {board,frames:[],physicsMoves:0,contacts:contactPairs(board)};
  const options=normalizePhysics(settings),destinations=new Set(),movingIds=new Set();
  // All directions inspect the SAME board. Reservations only resolve competing
  // destinations; a vacated source never becomes an extra escape in this pulse.
  for(const[dr,dc]of DIRECTIONS){
    const from=neighbor(origin,dr,dc);if(from<0||!board[from])continue;
    const move=displacementOptions(board,from,dr,dc,options).find(m=>
      m.id!==triggerId&&!movingIds.has(m.id)&&!destinations.has(m.to));
    if(!move)continue;
    moves.push({...move,source:origin,emitterId:triggerId});
    destinations.add(move.to);movingIds.add(move.id);
  }
  const moving=moves.map(m=>({...m,piece:board[m.from]}));
  for(const m of moving)board[m.from]=null;
  for(const m of moving)board[m.to]=m.piece;
  // Exactly one animation frame holds every movement. Moved pieces never emit.
  return {board,frames:detail&&moves.length?[{kind:'move',board:clone(board),moves}]:[],
    physicsMoves:moves.length,contacts:detail?contactPairs(board):[]};
}
