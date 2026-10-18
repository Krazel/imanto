export function createPersonalBest(storage){
  const key='imanto-best-v1';let best=0;
  try{const n=JSON.parse(storage.getItem(key));if(Number.isSafeInteger(n)&&n>0)best=n;}catch{}
  return {get:()=>best,update(score){
    if(Number.isSafeInteger(score)&&score>best){best=score;try{storage.setItem(key,JSON.stringify(best));}catch{}}
    return best;
  }};
}
