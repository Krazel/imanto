export function createNativeSubscriptionProvider(host=globalThis){
  const bridge=host.webkit?.messageHandlers?.imantoSubscriptions;if(!bridge)return null;
  const pending=new Map();let sequence=0;
  host.addEventListener('imanto-subscription-result',event=>{
    const result=event.detail,request=pending.get(result?.requestId);if(!request)return;
    pending.delete(result.requestId);host.clearTimeout(request.timer);request.resolve(result);
  });
  function request(action,values={}){
    return new Promise((resolve,reject)=>{
      const requestId=`membership-${Date.now()}-${++sequence}`;
      const timer=host.setTimeout(()=>{pending.delete(requestId);reject(Error('Membership reply unavailable'));},120000);
      pending.set(requestId,{resolve,timer});
      try{bridge.postMessage({action,requestId,...values});}catch(error){host.clearTimeout(timer);pending.delete(requestId);reject(error);}
    });
  }
  return {status:()=>request('status'),purchase:productId=>request('purchase',{productId}),restore:()=>request('restore'),manage:()=>request('manage'),claim:(gameId,kind='remove')=>request('claim',{gameId,kind})};
}
