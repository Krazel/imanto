// Release defaults. These cannot be enabled by a URL, storage or native message.
export const ADS_CONFIG=Object.freeze({banner:true,interstitial:true,rewarded:true,bannerFreeGames:4,interstitialFreeGames:0,gamesPerInterstitial:2,longGameMs:600000});
export const ADS_SAVE_KEY='krazel-imanto-ad-cadence-v1';
export function createAdCadence(storage,{now=Date.now,config=ADS_CONFIG}={}){
  let saved;try{saved=JSON.parse(storage.getItem(ADS_SAVE_KEY));}catch{}
  const count=Number.isSafeInteger(saved?.count)&&saved.count>=0?saved.count:0;
  const data={count,completed:Number.isSafeInteger(saved?.completed)&&saved.completed>=count?saved.completed:count,lastGame:typeof saved?.lastGame==='string'?saved.lastGame:null,lastShown:Number.isFinite(saved?.lastShown)?saved.lastShown:0,longGamePending:saved?.longGamePending===true};
  const save=()=>{try{storage.setItem(ADS_SAVE_KEY,JSON.stringify(data));}catch{}};
  return {
    finish(gameId,playedMs=0){if(typeof gameId!=='string'||!gameId||data.lastGame===gameId)return false;data.lastGame=gameId;data.count++;data.completed++;data.longGamePending ||= Number.isFinite(playedMs)&&playedMs>=config.longGameMs;save();return true;},
    bannerAllowed:()=>config.banner===true&&data.completed>=config.bannerFreeGames,
    canPreload:()=>config.interstitial===true&&data.completed>=config.interstitialFreeGames,
    due(){return config.interstitial&&data.completed>config.interstitialFreeGames&&(data.count>=config.gamesPerInterstitial||data.longGamePending);},
    shown(){data.count=0;data.longGamePending=false;data.lastShown=now();save();},
    noteFullscreen(){data.lastShown=now();save();},
    snapshot:()=>({...data})
  };
}
export function createAds({config=ADS_CONFIG,provider=null,suppressAutomatic=()=>false}={}){
  let presenting=false,changingPrivacy=false;
  const enabled=kind=>config[kind]===true&&(!(kind==='banner'||kind==='interstitial')||!suppressAutomatic());
  return {
    enabled,
    supported:kind=>enabled(kind)&&!!provider,
    async privacy(){
      if(changingPrivacy||presenting||!['banner','interstitial','rewarded'].some(kind=>config[kind]===true)||!provider?.privacy)return false;
      changingPrivacy=true;
      try{await provider.banner?.(false);return (await provider.privacy())===true;}catch{return false;}finally{changingPrivacy=false;}
    },
    async privacyState(){try{return await provider?.privacyState?.()??null;}catch{return null;}},
    async ready(kind){if(!enabled(kind)||presenting||changingPrivacy||!provider)return false;try{return (await provider.ready(kind))===true&&!changingPrivacy;}catch{return false;}},
    async available(kind){if(!enabled(kind)||presenting||changingPrivacy||!provider?.available)return false;try{return (await provider.available(kind))===true&&!changingPrivacy;}catch{return false;}},
    async show(kind,onEarned=()=>{},onShown=()=>{}){
      if(!enabled(kind)||presenting||changingPrivacy||!provider)return {shown:false,earned:false};
      presenting=true;
      let didShow=false;const shown=()=>{if(!didShow){didShow=true;onShown();}};
      try{const r=await provider.show(kind,onEarned,shown);if(r?.shown===true)shown();return {shown:r?.shown===true,earned:kind==='rewarded'&&r?.shown===true&&r?.earned===true,...(r?.uncertain?{uncertain:true}:{})};}
      catch{return {shown:false,earned:false};}finally{presenting=false;}
    },
    async banner(visible){if(config.banner!==true||!provider||visible&&changingPrivacy)return false;try{return await provider.banner(visible===true&&enabled('banner'));}catch{return false;}}
  };
}
