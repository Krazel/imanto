// Commercial choices approved 18/10/2026. EUR prices are preview-only: once
// purchases are enabled, show Apple's localized price, never this fallback.
import {MEMBERSHIP_PLANS} from './membership-catalog.mjs';
export const MONTHLY_PLAN_PREVIEW=MEMBERSHIP_PLANS;
// App Store product IDs and wallet are not configured; purchases remain OFF.
export const SUBSCRIPTION_CONFIG=Object.freeze({enabled:true,plans:MEMBERSHIP_PLANS});
const empty=()=>({available:false,active:false,unlimited:false,balance:0,revivesRemaining:0,unlimitedRevives:false,products:[]});
export function createSubscriptions({config=SUBSCRIPTION_CONFIG,provider=null}={}){
  let value=empty(),working=false;
  const enabled=()=>config.enabled===true&&!!provider;
  function accept(result){
    if(!result||typeof result.active!=='boolean'||!Number.isSafeInteger(result.balance)||result.balance<0)throw Error('Invalid membership response');
    value={available:result.available===true,active:result.active,unlimited:result.active&&result.unlimited===true,balance:result.balance,revivesRemaining:Number.isSafeInteger(result.revivesRemaining)&&result.revivesRemaining>0?result.revivesRemaining:0,unlimitedRevives:result.active&&result.unlimitedRevives===true,products:Array.isArray(result.products)?result.products.filter(p=>config.plans.some(plan=>plan.productId===p.id)&&typeof p.name==='string'&&typeof p.price==='string'&&(p.unlimited===true||Number.isSafeInteger(p.monthlyRemovals)&&p.monthlyRemovals>0)):[]};
    return snapshot();
  }
  const snapshot=()=>structuredClone(value);
  async function refresh(){if(!enabled())return snapshot();try{return accept(await provider.status());}catch{value=empty();return snapshot();}}
  async function action(kind,productId){
    if(!enabled()||working)return {ok:false,reason:'unavailable'};
    if(kind==='purchase'&&(!value.available||!value.products.some(p=>p.id===productId)))return {ok:false,reason:'unavailable'};
    working=true;
    try{const result=await provider[kind](productId);await refresh();return result??{ok:false};}catch{return {ok:false,reason:'unavailable'};}finally{working=false;}
  }
  return {
    enabled,snapshot,refresh,
    // While entitlement is being resolved, automatic inventory stays suppressed.
    suppressAutomaticAds:()=>config.enabled===true&&(!value.available||value.active),
    purchase:productId=>action('purchase',productId),restore:()=>action('restore'),manage:()=>action('manage'),
    async claim(gameId,kind='remove'){
      if(!enabled()||working||typeof gameId!=='string'||!gameId||gameId.length>100)return {ok:false};
      working=true;
      try{
        // Native/server wallet is idempotent by account+game, including retries after a lost reply.
        const result=await provider.claim(gameId,kind);
        if(result?.ok===false&&result.reason==='no-balance'&&result.confirmed===true&&result.gameId===gameId){await refresh();return {ok:false,denied:true,gameId};}
        if(result?.ok!==true||result.gameId!==gameId||typeof result.receipt!=='string'||!result.receipt)return {ok:false};
        await refresh();return {ok:true,gameId,receipt:result.receipt};
      }catch{return {ok:false};}finally{working=false;}
    }
  };
}
