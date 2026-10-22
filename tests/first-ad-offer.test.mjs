import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirstAdOffer} from '../web/first-ad-offer.mjs';
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};};
test('first automatic impression offers subscription once across reloads',()=>{
 const saved=storage(),offer=createFirstAdOffer(saved);
 assert.equal(offer.ready(),false);offer.note('rewarded');assert.equal(offer.ready(),false);
 offer.note('banner');assert.equal(offer.ready(),true);
 for(const flag of ['active','busy','hidden','dialogOpen'])assert.equal(offer.ready({[flag]:true}),false);
 offer.shown();assert.equal(offer.ready(),false);
 const again=createFirstAdOffer(saved);again.note('interstitial');assert.equal(again.ready(),false);
});
test('interstitial can be the first ad; failed loads never call note',()=>{
 const offer=createFirstAdOffer(storage());assert.equal(offer.ready(),false);
 offer.note('interstitial');assert.equal(offer.ready(),true);
});
