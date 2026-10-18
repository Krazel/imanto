import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,restoreGame,isValidSave,completedLines,beginRevive,settleRevive,removeForRevive} from '../web/engine.mjs';
import {analyzeLines} from '../web/line-search.mjs';
import {createAds,createAdCadence,ADS_CONFIG} from '../web/ads.mjs';
import {createNativeAdProvider} from '../web/native-ads.mjs';
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const ended=()=>{const s=createGame(rng(8));s.over=true;s.endReason='no-lines';return s;};

test('random openings vary count, colors and coordinates; remain playable, valid and scoreless',()=>{
  const counts=new Set(),positions=new Set(),colors=new Set();
  for(let seed=1;seed<=100;seed++){
    const s=createGame(rng(seed*7919));assert.ok(isValidSave(s));
    const n=s.board.filter(Boolean).length;assert.ok(n>=4&&n<=8);counts.add(n);
    positions.add(s.board.map(p=>p?'1':'0').join(''));colors.add(s.board.map(p=>p?.color??'-').join(','));
    assert.equal(s.score,0);assert.equal(s.turns,0);assert.equal(completedLines(s.board).length,0);
    assert.ok(analyzeLines(s).possible,`seed ${seed}`);
    assert.deepEqual(restoreGame(s),s);
  }
  assert.equal(counts.size,5);assert.ok(positions.size>90);assert.ok(colors.size>90);
});
test('opening bounds are configurable and invalid ranges fail rather than overfill the board',()=>{
  for(const value of [0,.99])assert.equal(createGame(()=>value,{min:7,max:7}).board.filter(Boolean).length,7);
  for(const opening of [{min:0},{min:8,max:4},{max:25},{min:2.5}])assert.throws(()=>createGame(rng(1),opening));
});
test('restoring an old fixed opening never rerolls the saved board, hand or forecast',()=>{
  const old=createGame(rng(3));delete old.revive;old.score=345;
  const next=restoreGame(old,()=>{throw Error('must not draw');});assert.deepEqual(next,old);
});
test('disabled formats prevent provider, network, banner and reward activity',async()=>{
  let calls=0;const provider={ready:()=>{calls++;return true;},show:()=>{calls++;return {shown:true,earned:true};},banner:()=>{calls++;return true;}};
  const ads=createAds({provider,config:{...ADS_CONFIG,banner:false,interstitial:false,rewarded:false}});
  for(const kind of ['banner','interstitial','rewarded']){assert.equal(ads.enabled(kind),false);assert.equal(await ads.ready(kind),false);assert.deepEqual(await ads.show(kind),{shown:false,earned:false});}
  assert.equal(await ads.banner(true),false);assert.equal(calls,0);
  assert.equal(createNativeAdProvider({}),null);
});
test('cadence survives closing after two completed games; third is due once enabled',()=>{
  const s=storage(),config={...ADS_CONFIG,interstitial:true};let c=createAdCadence(s,{config});
  c.finish('one');c.finish('two');assert.equal(c.due(),false);
  c=createAdCadence(s,{config});assert.equal(c.snapshot().count,2);c.finish('three');assert.equal(c.due(),true);
  assert.equal(c.finish('three'),false);assert.equal(c.snapshot().count,3);
  c.shown();assert.equal(createAdCadence(s,{config}).snapshot().count,0);
});
test('failed or unavailable ads leave cadence pending and no ads show merely by opening',()=>{
  const s=storage(),c=createAdCadence(s);for(let i=0;i<6;i++)c.finish(`g${i}`);
  assert.equal(c.due(),false);assert.equal(c.snapshot().count,6);
  const enabled=createAdCadence(s,{config:{...ADS_CONFIG,interstitial:true}});assert.equal(enabled.due(),true);
  assert.equal(enabled.snapshot().count,6);
});
test('minimum fullscreen interval persists independently from number of games',()=>{
  const s=storage(),config={...ADS_CONFIG,interstitial:true};let now=1000000;
  const c=createAdCadence(s,{config,now:()=>now});c.shown();for(let i=0;i<3;i++)c.finish(`g${i}`);
  assert.equal(c.due(),false);now+=180000;assert.equal(createAdCadence(s,{config,now:()=>now}).due(),true);
});
test('a rewarded fullscreen delays interstitials without erasing completed games',()=>{
  const s=storage(),config={...ADS_CONFIG,interstitial:true};let now=1000000;
  const c=createAdCadence(s,{config,now:()=>now});for(let i=0;i<3;i++)c.finish(`g${i}`);
  c.noteFullscreen();assert.equal(c.snapshot().count,3);assert.equal(c.due(),false);
  now+=180000;assert.equal(c.due(),true);
});
test('only a confirmed rewarded completion grants exactly one chosen-tile removal',()=>{
  const original=ended(),pending=beginRevive(original);assert.equal(original.revive,'available');
  const earned=settleRevive(pending,{shown:true,earned:true});assert.equal(earned.revive,'earned');
  const at=earned.board.findIndex(Boolean),copy=structuredClone(earned),revived=removeForRevive(earned,at);
  assert.equal(revived.board.filter(Boolean).length,copy.board.filter(Boolean).length-1);
  assert.equal(revived.board[at],null);assert.equal(revived.over,false);assert.equal(revived.revive,'used');
  for(const key of ['score','turns','round','tray','nextTray','combo'])assert.deepEqual(revived[key],copy[key]);
  assert.deepEqual(earned,copy);assert.ok(isValidSave(revived));
  assert.throws(()=>removeForRevive(revived,revived.board.findIndex(Boolean)));
  assert.throws(()=>beginRevive({...revived,over:true}));
});
test('no fill permits retry; cancellation after presentation consumes the single ad; uncertain callbacks fail closed',()=>{
  const pending=beginRevive(ended());
  assert.equal(settleRevive(pending,{shown:false}).revive,'available');
  assert.equal(settleRevive(pending,{shown:true,earned:false}).revive,'used');
  assert.equal(settleRevive(pending,{shown:false,earned:true}).revive,'available');
  assert.equal(settleRevive(pending,{uncertain:true}).revive,'used');
  assert.throws(()=>removeForRevive(pending,0));assert.throws(()=>beginRevive(createGame()));
});
test('reload after earned reward preserves selection; interruption or duplicate callback cannot give another ad',()=>{
  const pending=beginRevive(ended());assert.equal(restoreGame(pending).revive,'used');
  const earned=settleRevive(pending,{shown:true,earned:true});assert.equal(restoreGame(earned).revive,'earned');
  assert.deepEqual(settleRevive(earned,{shown:true,earned:true}),earned);
  const at=earned.board.findIndex(Boolean);const used=removeForRevive(earned,at);
  assert.equal(restoreGame(used).revive,'used');assert.equal(createGame().revive,'available');
});
test('fullscreen requests cannot overlap and errors cannot invent rewards',async()=>{
  let release;const provider={show:()=>new Promise(resolve=>release=resolve)};
  const ads=createAds({config:{...ADS_CONFIG,rewarded:true},provider});const first=ads.show('rewarded');
  assert.deepEqual(await ads.show('rewarded'),{shown:false,earned:false});release({shown:true,earned:false});
  assert.deepEqual(await first,{shown:true,earned:false});
  const broken=createAds({config:{...ADS_CONFIG,rewarded:true},provider:{show:()=>{throw Error();}}});
  assert.deepEqual(await broken.show('rewarded'),{shown:false,earned:false});
});
test('native reward progress is correlated to request and saved before dismissal',async()=>{
  let listener,message,earned=0;const host={addEventListener:(_,fn)=>listener=fn,webkit:{messageHandlers:{imantoAds:{postMessage:body=>message=body}}}};
  const provider=createNativeAdProvider(host),promise=provider.show('rewarded',()=>earned++);
  listener({detail:{requestId:'wrong',phase:'earned'}});assert.equal(earned,0);
  listener({detail:{requestId:message.requestId,phase:'earned'}});assert.equal(earned,1);
  listener({detail:{requestId:message.requestId,shown:true,earned:true}});assert.equal((await promise).earned,true);
});
