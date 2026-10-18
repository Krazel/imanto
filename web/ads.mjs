// Release defaults. These cannot be enabled by a URL, storage or native message.
export const ADS_CONFIG=Object.freeze({banner:false,interstitial:false,rewarded:true,gamesPerInterstitial:3,minIntervalMs:180000});
export const ADS_SAVE_KEY='krazel-imanto-ad-cadence-v1';
export function createAdCadence(storage,{now=Date.now,config=ADS_CONFIG}={}){
  let saved;try{saved=JSON.parse(storage.getItem(ADS_SAVE_KEY));}catch{}
  const data={count:Number.isSafeInteger(saved?.count)&&saved.count>=0?saved.count:0,lastGame:typeof saved?.lastGame==='string'?saved.lastGame:null,lastShown:Number.isFinite(saved?.lastShown)?saved.lastShown:0};
  const save=()=>{try{storage.setItem(ADS_SAVE_KEY,JSON.stringify(data));}catch{}};
  return {
    finish(gameId){if(typeof gameId!=='string'||!gameId||data.lastGame===gameId)return false;data.lastGame=gameId;data.count++;save();return true;},
    due(){return config.interstitial&&data.count>=config.gamesPerInterstitial&&(!data.lastShown||now()-data.lastShown>=config.minIntervalMs);},
    shown(){data.count=0;data.lastShown=now();save();},
    noteFullscreen(){data.lastShown=now();save();},
    snapshot:()=>({...data})
  };
}
export function createAds({config=ADS_CONFIG,provider=null,suppressAutomatic=()=>false}={}){
  let presenting=false;
  const enabled=kind=>config[kind]===true&&(!(kind==='banner'||kind==='interstitial')||!suppressAutomatic());
  return {
    enabled,
    supported:kind=>enabled(kind)&&!!provider,
    async privacy(){if(!['banner','interstitial','rewarded'].some(enabled)||!provider?.privacy)return false;try{return await provider.privacy();}catch{return false;}},
    async ready(kind){if(!enabled(kind)||presenting||!provider)return false;try{return (await provider.ready(kind))===true;}catch{return false;}},
    async show(kind,onEarned=()=>{}){
      if(!enabled(kind)||presenting||!provider)return {shown:false,earned:false};
      presenting=true;
      try{const r=await provider.show(kind,onEarned);return {shown:r?.shown===true,earned:kind==='rewarded'&&r?.shown===true&&r?.earned===true,...(r?.uncertain?{uncertain:true}:{})};}
      catch{return {shown:false,earned:false};}finally{presenting=false;}
    },
    async banner(visible){if(config.banner!==true||!provider)return false;try{return await provider.banner(visible===true&&enabled('banner'));}catch{return false;}}
  };
}
