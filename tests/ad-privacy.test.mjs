import test from 'node:test';
import assert from 'node:assert/strict';
import {createAds,ADS_CONFIG} from '../web/ads.mjs';
import {bindAdPrivacy} from '../web/ad-privacy.mjs';

test('privacy blocks loading and showing all formats while the choice is unresolved',async()=>{
  let settle,loads=0,shows=0;
  const ads=createAds({provider:{privacy:()=>new Promise(resolve=>settle=resolve),banner:()=>false,ready:()=>{loads++;return true;},available:()=>true,show:()=>{shows++;return {shown:true};}}});
  const changing=ads.privacy();await Promise.resolve();
  for(const kind of ['banner','interstitial','rewarded']){
    assert.equal(await ads.ready(kind),false);assert.equal(await ads.available(kind),false);
    assert.equal((await ads.show(kind)).shown,false);
  }
  assert.equal(await ads.banner(true),false);assert.equal(loads,0);assert.equal(shows,0);
  assert.equal(await ads.privacy(),false);
  settle(true);assert.equal(await changing,true);assert.equal(await ads.ready('rewarded'),true);
});

test('a subscriber can still change privacy even when every automatic ad is suppressed',async()=>{
  let called=0;
  const ads=createAds({config:{...ADS_CONFIG,rewarded:false},suppressAutomatic:()=>true,provider:{privacy:()=>{called++;return true;}}});
  assert.equal(await ads.privacy(),true);assert.equal(called,1);
});

function controls(){
  const listeners=new Map(),button={hidden:true,disabled:false,addEventListener:(event,fn)=>listeners.set('button-'+event,fn)};
  const host={addEventListener:(event,fn)=>listeners.set(event,fn)},status={hidden:true,textContent:''};
  return {button,status,host,click:()=>listeners.get('button-click')(),state:value=>listeners.get('imanto-ad-privacy-state')({detail:value})};
}
test('failed privacy changes show an error and never resume ads',async()=>{
  const c=controls();let resumed=0;
  const ui=bindAdPrivacy({...c,ads:{privacy:async()=>false,privacyState:async()=>({retry:true})},translate:x=>x,onResolved:async()=>resumed++});
  await ui.refresh();assert.equal(c.button.hidden,false);
  await c.click();assert.equal(c.status.hidden,false);assert.match(c.status.textContent,/Inténtalo/);assert.equal(resumed,0);
});
test('successful changes including refusal resync through the native gate and preserve required privacy access',async()=>{
  const c=controls();let resumed=0;
  bindAdPrivacy({...c,ads:{privacy:async()=>true,privacyState:async()=>({required:true,canRequestAds:false})},translate:x=>x,onResolved:async()=>resumed++});
  c.state({required:true,busy:true});assert.equal(c.button.disabled,true);
  await c.click();assert.equal(c.button.disabled,false);assert.equal(c.button.hidden,false);assert.equal(c.status.hidden,true);assert.equal(resumed,1);
});
test('a long native form can recover after a bridge timeout only when native permits ads',async()=>{
  const c=controls();let resumed=0;
  bindAdPrivacy({...c,ads:{privacyState:async()=>({required:true})},translate:x=>x,onResolved:async()=>resumed++});
  c.state({required:true,busy:true,canRequestAds:false});
  c.state({required:true,busy:false,canRequestAds:false});assert.equal(resumed,0);
  c.state({required:true,busy:true,canRequestAds:false});c.status.hidden=false;
  c.state({required:true,busy:false,canRequestAds:true});assert.equal(resumed,1);assert.equal(c.status.hidden,true);
});
