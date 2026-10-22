// The offer is triggered by a displayed automatic ad, never by a failed load.
export function createFirstAdOffer(storage){
  const key='imanto-first-ad-offer-v1';
  let seen=false,pending=false;
  try{seen=storage.getItem(key)==='shown';}catch{}
  return {
    note(kind){if(!seen&&(kind==='banner'||kind==='interstitial'))pending=true;},
    ready({active=false,busy=false,hidden=false,dialogOpen=false}={}){return pending&&!seen&&!active&&!busy&&!hidden&&!dialogOpen;},
    shown(){seen=true;pending=false;try{storage.setItem(key,'shown');}catch{}},
  };
}
