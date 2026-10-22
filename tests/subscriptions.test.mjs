import test from 'node:test';
import assert from 'node:assert/strict';
import {SUBSCRIPTION_CONFIG,createSubscriptions} from '../web/subscriptions.mjs';
import {createNativeSubscriptionProvider} from '../web/native-subscriptions.mjs';
import {ADS_CONFIG,createAds} from '../web/ads.mjs';
import {createGame,beginCreditRemoval,settleCreditRemoval,removeForRevive,beginRevive,restoreGame,reviveStatus,isValidSave,blockRemovalStatus,removeForCredit,beginPaidRevive,settlePaidRevive} from '../web/engine.mjs';
import {newWallet,walletBalance,grantVerifiedCycle,revokeGrant,claimRemoval} from '../server/subscription-ledger.mjs';
// Arbitrary fixtures, NOT commercial levels or release configuration.
const config={enabled:true,plans:[{productId:'test.product'}]};
const status=(extra={})=>({resolved:true,available:true,active:true,balance:2,products:[{id:'test.product',name:'Fixture',price:'localized',monthlyRemovals:7}],...extra});
const grant=(wallet,transactionId='transaction',cycleId='billing-cycle',quota=7)=>grantVerifiedCycle(wallet,{transactionId,cycleId,quota});

test('disabled subscriptions make no purchase, restore, wallet or store request',async()=>{
  let calls=0;
  const provider=Object.fromEntries(['status','purchase','restore','manage','claim'].map(key=>[key,()=>{calls++;return status();}]));
  const membership=createSubscriptions({provider,config:{enabled:false,plans:[]}});
  await membership.refresh();await membership.purchase('test.product');await membership.restore();await membership.manage();await membership.claim('game');
  assert.equal(calls,0);assert.equal(membership.snapshot().balance,0);assert.equal(createNativeSubscriptionProvider({}),null);
});
test('entitlement suppresses automatic inventory while voluntary rewarded remains available',async()=>{
  let member=status(),shown=[],banners=[];
  const membership=createSubscriptions({config,provider:{status:async()=>member}});
  const ads=createAds({config:{...ADS_CONFIG,banner:true,interstitial:true,rewarded:true},suppressAutomatic:membership.suppressAutomaticAds,provider:{ready:()=>true,show:kind=>{shown.push(kind);return {shown:true,earned:true};},banner:value=>{banners.push(value);return value;}}});
  assert.equal(await ads.ready('interstitial'),false);await membership.refresh();
  assert.equal(await ads.ready('banner'),false);assert.equal(await ads.ready('interstitial'),false);assert.equal(await ads.ready('rewarded'),true);
  assert.deepEqual(await ads.show('interstitial'),{shown:false,earned:false});await ads.banner(true);assert.deepEqual(banners,[false]);
  await ads.show('rewarded');assert.deepEqual(shown,['rewarded']);
  member=status({active:false});await membership.refresh();assert.equal(await ads.ready('interstitial'),true);
});
test('membership failure fails closed for automatic ads without inventing credits',async()=>{
  const member=createSubscriptions({config,provider:{status:()=>{throw Error('offline');}}});
  assert.equal(member.suppressAutomaticAds(),true);await member.refresh();assert.equal(member.suppressAutomaticAds(),true);assert.equal(member.snapshot().balance,0);
});
test('catalogue uses native localized prices and rejects unconfigured products or malformed balances',async()=>{
  let result=status();const member=createSubscriptions({config,provider:{status:()=>result}});
  await member.refresh();assert.equal(member.snapshot().products[0].price,'localized');
  result=status({products:[{...result.products[0],id:'rogue'}]});await member.refresh();assert.deepEqual(member.snapshot().products,[]);
  result=status({balance:NaN});await member.refresh();assert.equal(member.snapshot().available,false);
});
test('cancelled and pending purchases do not grant a benefit; restore reads authority without adding credits',async()=>{
  let purchases=0,restores=0;const member=createSubscriptions({config,provider:{status:()=>status({active:false,balance:0}),purchase:()=>{purchases++;return {ok:false,reason:purchases===1?'cancelled':'pending'};},restore:()=>{restores++;return {ok:true};}}});
  await member.refresh();assert.equal((await member.purchase('rogue')).ok,false);assert.equal(purchases,0);
  assert.equal((await member.purchase('test.product')).reason,'cancelled');assert.equal((await member.purchase('test.product')).reason,'pending');
  await member.restore();await member.restore();assert.equal(restores,2);assert.equal(member.snapshot().balance,0);assert.equal(member.snapshot().active,false);
});
test('monthly removal requires defeat and shares the one-per-game limit',()=>{
  const original={...createGame(),gameId:'game',over:true,endReason:'no-lines'};
  const pending=beginCreditRemoval(original);assert.equal(blockRemovalStatus(pending),'pending');
  const earned=settleCreditRemoval(pending,{ok:true,gameId:'game',receipt:'receipt'});
  const at=earned.board.findIndex(Boolean),removed=removeForCredit(earned,at);
  assert.equal(removed.board.filter(Boolean).length,original.board.filter(Boolean).length-1);
  for(const field of ['score','turns','round','tray','nextTray','combo'])assert.deepEqual(removed[field],original[field]);
  assert.ok(isValidSave(removed));assert.throws(()=>beginCreditRemoval(removed));
  assert.throws(()=>beginRevive({...removed,over:true}));
  assert.throws(()=>beginCreditRemoval({...original,over:false}));
});

test('interrupted block claim stays pending on reload and only its correlated receipt authorizes removal',()=>{
  let state=restoreGame(beginCreditRemoval({...createGame(),gameId:'game',over:true,endReason:'no-lines'}));assert.equal(blockRemovalStatus(state),'pending');
  assert.equal(settleCreditRemoval(state,{ok:false}),state);assert.equal(settleCreditRemoval(state,{ok:true,gameId:'other',receipt:'x'}),state);
  state=settleCreditRemoval(state,{ok:true,gameId:'game',receipt:'x'});assert.equal(restoreGame(state).blockRemoval,'earned');
  const used=removeForCredit(state,state.board.findIndex(Boolean));assert.equal(restoreGame(used).blockRemoval,'used');assert.equal(used.revive,'used');
});

test('paid and video removals share the same one-per-game limit',()=>{
  const state={...createGame(),gameId:'game',revive:'used'};assert.throws(()=>beginCreditRemoval({...state,over:true}));
  assert.throws(()=>beginPaidRevive({...state,over:true}));assert.throws(()=>beginRevive({...state,over:true}));
});

test('empty daily allowance unlocks video; uncertain paid revive keeps its pending receipt for recovery',async()=>{
  let answer={ok:false,reason:'unavailable'};
  const member=createSubscriptions({config,provider:{status:()=>status({balance:0}),claim:()=>answer}});
  let state=beginPaidRevive({...createGame(),gameId:'game',over:true,endReason:'no-lines'});
  state=settlePaidRevive(state,await member.claim('game','revive'));assert.equal(state.revive,'pending');assert.equal(restoreGame(state).revive,'pending');
  answer={ok:false,reason:'no-balance',confirmed:true,gameId:'game'};
  state=settlePaidRevive(state,await member.claim('game','revive'));assert.equal(state.revive,'available');
  const video=beginRevive(state);assert.equal(video.reviveSource,'video');assert.equal(restoreGame(video).revive,'used');
});

test('claim response must match the requested game and can be recovered even with zero balance',async()=>{
  let result={ok:true,gameId:'other',receipt:'r'},claims=0;
  const member=createSubscriptions({config,provider:{status:()=>status({balance:0}),claim:()=>{claims++;return result;}}});
  await member.refresh();assert.equal((await member.claim('game')).ok,false);
  result={ok:true,gameId:'game',receipt:'r'};assert.equal((await member.claim('game')).ok,true);assert.equal(claims,2);
});
test('concurrent wallet requests cannot spend twice from the UI',async()=>{
  let resolve,calls=0;const member=createSubscriptions({config,provider:{status:()=>status(),claim:()=>{calls++;return new Promise(r=>resolve=r);}}});
  const first=member.claim('game');assert.equal((await member.claim('game')).ok,false);resolve({ok:true,gameId:'game',receipt:'r'});await first;assert.equal(calls,1);
});
test('wallet deduplicates renewals and grants full quantity only in a distinct server-verified billing cycle',()=>{
  let wallet=grant(newWallet());const same=grant(wallet);assert.equal(same,wallet);assert.equal(walletBalance(wallet),7);
  wallet=claimRemoval(wallet,'game','receipt').wallet;wallet=grant(wallet,'renewal','next-cycle');assert.equal(walletBalance(wallet),13);
  assert.equal(walletBalance(structuredClone(wallet)),13); // restart/restore is a read, never a grant
});
test('upgrading grants only the difference; downgrade/re-upgrade and out-of-order deliveries cannot mint twice',()=>{
  let wallet=grant(newWallet());wallet=claimRemoval(wallet,'game','r').wallet;
  wallet=grant(wallet,'upgrade','billing-cycle',11);assert.equal(walletBalance(wallet),10);
  wallet=grant(wallet,'downgrade','billing-cycle',3);wallet=grant(wallet,'upgrade-again','billing-cycle',11);assert.equal(walletBalance(wallet),10);
});
test('claim is idempotent across retries/devices and cannot make the wallet negative',()=>{
  let wallet=grant(newWallet(),'tx','cycle',1),first=claimRemoval(wallet,'game','receipt');wallet=first.wallet;
  const retry=claimRemoval(wallet,'game','another');assert.deepEqual(retry.claim,first.claim);assert.equal(retry.wallet,wallet);
  assert.equal(walletBalance(wallet),0);assert.equal(claimRemoval(wallet,'next','r').claim,null);
});
test('unused credits carry across billing cycles and membership expiration without a device clock refill',()=>{
  let wallet=grant(newWallet());wallet=grant(wallet,'next-tx','next-cycle',4);assert.equal(walletBalance(wallet),11);
  // There is deliberately no clock, month-change reset, subscription flag or expiry operation in the wallet.
  const saved=JSON.parse(JSON.stringify(wallet));assert.equal(walletBalance(saved),11);
});
test('refund revokes only the unspent grant, leaves unrelated credits and never restores the game allowance',()=>{
  let wallet=grant(newWallet(),'one','one-cycle',2);wallet=claimRemoval(wallet,'game','r').wallet;wallet=grant(wallet,'two','two-cycle',3);
  wallet=revokeGrant(wallet,'one');assert.equal(walletBalance(wallet),3);assert.ok(claimRemoval(wallet,'game','other').claim);assert.equal(walletBalance(wallet),3);
  assert.equal(walletBalance(revokeGrant(wallet,'one')),3);
});
test('wallet identifiers cannot collide with object prototype properties',()=>{
  let wallet=grant(newWallet(),'tx','__proto__',2);assert.equal(walletBalance(wallet),2);
  wallet=claimRemoval(wallet,'__proto__','r').wallet;assert.equal(walletBalance(wallet),1);
  assert.equal(claimRemoval(wallet,'__proto__','other').claim.receipt,'r');
});
test('native bridge correlates messages and never embeds undefined values',async()=>{
  const listeners={},sent=[];const host={webkit:{messageHandlers:{imantoSubscriptions:{postMessage:body=>sent.push(body)}}},addEventListener:(name,listener)=>listeners[name]=listener,setTimeout,clearTimeout};
  const provider=createNativeSubscriptionProvider(host),pending=provider.claim('game');
  assert.equal(sent[0].gameId,'game');assert.ok(Object.values(sent[0]).every(value=>value!==undefined));
  listeners['imanto-subscription-result']({detail:{requestId:'unknown',ok:true}});
  listeners['imanto-subscription-result']({detail:{requestId:sent[0].requestId,ok:true,gameId:'game',receipt:'r'}});
  assert.equal((await pending).receipt,'r');
});
test('unlimited entitlement needs an active verified subscription; expiry removes unlimited access',async()=>{
  let answer=status({balance:0,unlimited:true,products:[{id:'test.product',name:'Fixture',price:'localized',monthlyRemovals:0,unlimited:true}]});
  const membership=createSubscriptions({config,provider:{status:()=>answer}});
  await membership.refresh();assert.equal(membership.snapshot().unlimited,true);assert.equal(membership.snapshot().products.length,1);
  answer={...answer,active:false};await membership.refresh();assert.equal(membership.snapshot().unlimited,false);
});
test('unlimited claims need no credit, preserve banked credits and remain idempotent once per game',()=>{
  let wallet=grant(newWallet(),'tx','cycle',2);
  const first=claimRemoval(wallet,'game','r',{unlimited:true});wallet=first.wallet;
  assert.equal(walletBalance(wallet),2);assert.equal(first.claim.source,'unlimited');
  assert.deepEqual(claimRemoval(wallet,'game','other',{unlimited:true}).claim,first.claim);
  wallet=claimRemoval(wallet,'another-game','next',{unlimited:true}).wallet;assert.equal(walletBalance(wallet),2);
  wallet=claimRemoval(wallet,'after-expiry','finite').wallet;assert.equal(walletBalance(wallet),1);
  assert.equal(claimRemoval(newWallet(),'expired','no-credit').claim,null);
});

test('resolved free entitlement allows ads even when the purchase catalogue is unavailable',async()=>{
  let answer=status({available:false,active:false,products:[]});
  const member=createSubscriptions({config,provider:{status:()=>answer}});
  assert.equal(member.suppressAutomaticAds(),true);await member.refresh();assert.equal(member.suppressAutomaticAds(),false);
  answer=status({available:false,active:true,products:[]});await member.refresh();assert.equal(member.suppressAutomaticAds(),true);
  answer=status({resolved:false,active:false});await member.refresh();assert.equal(member.suppressAutomaticAds(),true);
});
