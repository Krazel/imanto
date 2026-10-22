// BigInt masks cover all 36 cells without 32-bit aliasing.
import {probeLine,completedLines,COLORS,BASIC_PHYSICS,VIOLET_ROUND} from './engine.mjs';

const code=board=>board.map(p=>p?COLORS.indexOf(p.color)+1:0).join('');
const palette=round=>round>=VIOLET_ROUND?COLORS:COLORS.slice(0,3);
const rays=Array.from({length:36},(_,at)=>[[-1,0],[0,1],[1,0],[0,-1]].map(([dr,dc])=>{
  const out=[];for(let r=Math.floor(at/6)+dr,c=at%6+dc;r>=0&&r<6&&c>=0&&c<6;r+=dr,c+=dc)out.push(r*6+c);return out;
}));
function movableSpaces(board,cache){
  let mask=0n;board.forEach((p,i)=>{if(!p)mask|=1n<<BigInt(i);});
  if(cache.has(mask))return cache.get(mask);
  const key=mask;let changed=true;
  // Overestimate all cells that could ever become empty BEFORE a first clear.
  // Moving a tile needs an empty destination and a placement somewhere on the
  // opposite ray. Ignoring timing/blockers only adds possibilities, so cells
  // outside this closure are provably frozen (including occupied corners).
  while(changed){changed=false;for(let at=0;at<36;at++)if(!(mask&(1n<<BigInt(at)))){
    for(let dir=0;dir<4;dir++)if(rays[at][dir].length&&(mask&(1n<<BigInt(rays[at][dir][0])))&&rays[at][(dir+2)%4].some(i=>mask&(1n<<BigInt(i)))){mask|=1n<<BigInt(at);changed=true;break;}
  }}
  cache.set(key,mask);return mask;
}
function canStillAlign(board,holes,physics,cache){
  if(physics.sideways)return true;
  const movable=movableSpaces(board,cache);
  // A straight pulse from outside a target line can either remove ONE wrong
  // tile or add ONE right tile. A pulse inside it only adds its placed tile.
  // Each wrong tile therefore needs a removal AND a later replacement.
  for(let n=0;n<6;n++)for(const axis of[0,1]){
    const counts=[0,0,0,0],fixed=new Set();let empty=0;
    for(let j=0;j<6;j++){const at=axis?j*6+n:n*6+j,p=board[at];if(p){const c=COLORS.indexOf(p.color);counts[c]++;if(!(movable&(1n<<BigInt(at))))fixed.add(c);}else empty++;}
    if(fixed.size>1)continue;
    const same=fixed.size?counts[[...fixed][0]]:Math.max(...counts);
    if(empty+2*(6-empty-same)<=holes)return true;
  }
  return false;
}
function promise(board,targets=null){
  let best=-Infinity;
  for(let n=0;n<6;n++)for(const axis of[0,1]){
    const counts=[0,0,0,0];let occupied=0;
    for(let j=0;j<6;j++){const p=board[axis?j*6+n:n*6+j];if(p){counts[COLORS.indexOf(p.color)]++;occupied++;}}
    const most=Math.max(...counts);best=Math.max(best,most*most*4-(occupied-most)*5);
    if(targets)for(const count of counts)targets.push(count*count*4-(occupied-count)*5);
  }
  return best;
}

// Before the first clear, every placement consumes exactly one empty cell.
// Exhausting this finite tree proves defeat; finding any clear proves survival.
// Consider every possible draw, independent of the actual hand/forecast colors,
// but respect remaining batch slots and three DISTINCT colors per future batch.
// IDs are irrelevant to geometry, so equivalent color boards share a memo key.
export function* searchLines(state,physics=BASIC_PHYSICS){
  const dead=new Set(),spaceCache=new Map();let visited=0,simulations=0;
  function ready(node){
    let {hand,round,slots}=node;
    if(!slots){round++;hand=palette(round);slots=3;}
    return {...node,hand,round,slots};
  }
  function consume(node,color){
    const hand=node.hand.slice();
    hand.splice(hand.indexOf(color),1);
    return {...node,hand,slots:node.slots-1};
  }
  const keyOf=node=>code(node.board)+'/'+node.hand.join(',')+'/'+Math.min(node.round,VIOLET_ROUND)+'/'+node.slots;
  const initial={board:state.board,hand:palette(state.round),round:state.round,slots:state.tray.filter(Boolean).length,path:[]};
  if(!completedLines(state.board).length&&!canStillAlign(state.board,state.board.filter(p=>!p).length,physics,spaceCache))return {possible:false,path:null,visited:1,simulations:0};
  // First look for a concrete saving sequence with a small, diverse frontier.
  // This is only a shortcut to SUCCESS. A pruned frontier can never prove loss.
  if(state.board.filter(p=>!p).length>6){
    let frontier=[initial];
    while(frontier.length){
      const branches=[],seen=new Set();
      for(const raw of frontier){
        const node=ready(raw),id=Math.max(0,...node.board.map(p=>p?.id||0))+1;
        for(const color of new Set(node.hand))for(let at=0;at<36;at++)if(!node.board[at]){
          const result=probeLine(node.board,at,{id,color},physics);simulations++;
          const path=[...node.path,{at,color}];
          if(result.lineCount)return {possible:true,path,visited,simulations};
          if(!canStillAlign(result.board,result.board.filter(p=>!p).length,physics,spaceCache)){yield;continue;}
          const targets=[],rank=promise(result.board,targets);
          const next={...consume(node,color),board:result.board,path,rank,targets},key=keyOf(next);
          if(!seen.has(key)){seen.add(key);branches.push(next);}yield;
        }
      }
      // Keep contenders for each line/color, so a crowded but blocked line
      // cannot monopolize the shortcut and hide another constructive route.
      const leaders=Array.from({length:48},()=>[]);
      for(const branch of branches)for(let target=0;target<48;target++){
        const group=leaders[target];
        if(!group[0]||branch.targets[target]>group[0].targets[target]){group.unshift(branch);group.length=Math.min(group.length,2);}
        else if(!group[1]||branch.targets[target]>group[1].targets[target])group[1]=branch;
      }
      branches.sort((a,b)=>b.rank-a.rank);frontier=[...new Set([...branches.slice(0,16),...leaders.flat()])];
    }
  }
  function* visit(board,hand,round,slots){
    visited++;
    if(completedLines(board).length)return [];
    const holes=board.flatMap((p,i)=>p?[]:[i]);
    if(!holes.length)return null;
    if(!canStillAlign(board,holes.length,physics,spaceCache))return null;
    ({hand,round,slots}=ready({hand,round,slots}));
    const key=keyOf({board,hand,round,slots});
    if(dead.has(key))return null;
    const branches=[],id=Math.max(0,...board.map(p=>p?.id||0))+1;
    for(const color of new Set(hand))for(const at of holes){
      // Use a fresh identity, without drawing or changing the real game.
      const result=probeLine(board,at,{id,color},physics);simulations++;
      if(result.lineCount)return [{at,color}];
      branches.push({board:result.board,at,color,rank:promise(result.board)});
      yield;
    }
    branches.sort((a,b)=>b.rank-a.rank);
    for(const branch of branches){
      const next=consume({hand,slots},branch.color);
      const path=yield* visit(branch.board,next.hand,round,next.slots);
      if(path)return [{at:branch.at,color:branch.color},...path];
    }
    dead.add(key);return null;
  }
  const path=yield* visit(initial.board,initial.hand,initial.round,initial.slots);
  return {possible:path!==null,path,visited,simulations};
}

export function analyzeLines(state,physics=BASIC_PHYSICS){
  const search=searchLines(state,physics);let step;do{step=search.next();}while(!step.done);return step.value;
}

export async function checkLines(state,physics=BASIC_PHYSICS){
  const search=searchLines(state,physics);
  while(true){
    const until=performance.now()+8;let step;
    do{step=search.next();if(step.done)return step.value;}while(performance.now()<until);
    await new Promise(resolve=>setTimeout(resolve,0));
  }
}

export function applyLineCheck(state,result){
  const over=!result.possible;
  return {...state,over,endReason:over?(state.board.every(Boolean)?'full':'no-lines'):null};
}
