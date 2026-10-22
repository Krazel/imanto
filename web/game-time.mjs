// Persist played time, never the wall-clock timestamp: closed/background time cannot count.
export const GAME_TIME_KEY='imanto-game-time-v1';
export function createGameTime(storage,{now=()=>performance.now()}={}){
  let saved;try{saved=JSON.parse(storage.getItem(GAME_TIME_KEY));}catch{}
  let gameId=typeof saved?.gameId==='string'?saved.gameId:null;
  let elapsed=Number.isFinite(saved?.elapsed)&&saved.elapsed>=0?saved.elapsed:0;
  let started=null;
  const save=()=>{try{storage.setItem(GAME_TIME_KEY,JSON.stringify({gameId,elapsed}));}catch{}};
  function checkpoint(){const time=now();if(started!==null){elapsed+=Math.max(0,time-started);started=time;}save();return elapsed;}
  return {
    sync(id,playing){checkpoint();if(id!==gameId){gameId=id;elapsed=0;}started=playing?now():null;save();},
    elapsed:checkpoint,
  };
}
