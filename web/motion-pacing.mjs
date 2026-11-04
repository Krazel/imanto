// Contact hands off to repulsion while the approved 480ms Spring keeps playing.
export const MOTION_PACING=Object.freeze({contact:60,move:160,placement:480});
const marks=['input','contact','move','search-start','search-done','ready'];
export function markMotion(name){
  const performance=globalThis.performance;if(!performance?.mark)return;
  if(name==='input')for(const phase of marks)performance.clearMarks(`imanto:motion:${phase}`);
  const key=`imanto:motion:${name}`;performance.clearMarks(key);performance.mark(key);
}
export function moveDuration({laboratory=false,labSpeed=160}={}){
  return laboratory?labSpeed:MOTION_PACING.move;
}
export function settlePause(celebration,{demonstration=false}={}){
  return demonstration||celebration.kind==='all'?celebration.linger:0;
}

// A frame callback followed by a task gives the new tile a render opportunity
// before the search's first synchronous slice. Fallback also handles hidden tabs.
export function deferLineCheck(check,{requestFrame=globalThis.requestAnimationFrame,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  const result=new Promise((resolve,reject)=>{
    let started=false,fallback;
    const start=()=>{if(started)return;started=true;clearTimer(fallback);try{resolve(check());}catch(error){reject(error);}};
    fallback=setTimer(start,48);
    if(requestFrame)requestFrame(()=>setTimer(start,0));else setTimer(start,0);
  });
  // Keep rejection observed during visual playback; await still propagates it.
  result.catch(()=>{});return result;
}
