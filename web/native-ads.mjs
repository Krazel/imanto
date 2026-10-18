// Only the packaged WKWebView has this handler; browsers fail closed.
export function createNativeAdProvider(host=globalThis){
  const handler=host.webkit?.messageHandlers?.imantoAds;
  if(!handler)return null;
  let sequence=0;const pending=new Map();
  host.addEventListener('imanto-ad-result',event=>{
    const result=event.detail,entry=pending.get(result?.requestId);if(!entry)return;
    if(result.phase==='earned'){entry.onEarned?.();return;}
    clearTimeout(entry.timer);pending.delete(result.requestId);entry.resolve(result);
  });
  const request=(action,kind,visible,onEarned)=>new Promise(resolve=>{
    const requestId=`ad-${Date.now()}-${++sequence}`;
    const timer=setTimeout(()=>{pending.delete(requestId);resolve({shown:false,earned:false,ready:false,uncertain:action==='show'});},action==='show'?180000:15000);
    pending.set(requestId,{resolve,timer,onEarned});
    try{handler.postMessage({action,kind,requestId,...(typeof visible==='boolean'?{visible}:{})});}catch{clearTimeout(timer);pending.delete(requestId);resolve({shown:false,earned:false,ready:false});}
  });
  return {ready:async kind=>(await request('ready',kind)).ready===true,show:(kind,onEarned)=>request('show',kind,undefined,onEarned),banner:async visible=>(await request('banner','banner',visible)).shown===true,privacy:async()=>(await request('privacy','privacy')).complete===true};
}
