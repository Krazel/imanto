import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,restoreGame,isValidSave,completedLines,beginRevive,settleRevive,removeForRevive} from '../web/engine.mjs';
import {analyzeLines} from '../web/line-search.mjs';
import {createAds,createAdCadence,ADS_CONFIG,ADS_SAVE_KEY} from '../web/ads.mjs';
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
test('first four games have no banner; first five have no interstitial; first is after sixth',()=>{
  const s=storage();let c=createAdCadence(s);
  assert.equal(c.bannerAllowed(),false);assert.equal(c.canPreload(),false);
  for(let i=1;i<=6;i++){
    assert.equal(c.finish(`g${i}`),true);assert.equal(c.finish(`g${i}`),false);
    c=createAdCadence(s);
    assert.equal(c.snapshot().completed,i);assert.equal(c.bannerAllowed(),i>=4);
    assert.equal(c.canPreload(),i>=5);assert.equal(c.due(),i>5);
  }
  c.shown();c=createAdCadence(s);assert.equal(c.snapshot().completed,6);assert.equal(c.snapshot().count,0);assert.equal(c.bannerAllowed(),true);
});
test('interstitial repeats after three more games and the cooldown survives reopening',()=>{
  const s=storage();let now=1000000,c=createAdCadence(s,{now:()=>now});
  for(let i=1;i<=6;i++)c.finish(`g${i}`);c.shown();
  for(let i=7;i<=9;i++){c.finish(`g${i}`);assert.equal(c.due(),false);}
  now+=180000;c=createAdCadence(s,{now:()=>now});assert.equal(c.due(),true);
  c.shown();assert.equal(c.snapshot().completed,9);assert.equal(c.due(),false);
});
test('old cadence migrates completed games and malformed or disabled state fails safely',()=>{
  const s=storage();s.setItem(ADS_SAVE_KEY,JSON.stringify({count:4,lastGame:'old'}));
  let c=createAdCadence(s);assert.equal(c.snapshot().completed,4);assert.equal(c.bannerAllowed(),true);assert.equal(c.due(),false);
  c.finish('five');c.finish('six');assert.equal(c.due(),true);
  c=createAdCadence(s,{config:{...ADS_CONFIG,banner:false,interstitial:false}});assert.equal(c.due(),false);assert.equal(c.bannerAllowed(),false);
  s.setItem(ADS_SAVE_KEY,JSON.stringify({count:-3,completed:'bad'}));assert.equal(createAdCadence(s).snapshot().completed,0);
});
test('failed or unavailable ads preserve the pending counter; a reward delays rather than erases it',()=>{
  const s=storage();let now=1000000;let c=createAdCadence(s,{now:()=>now});
  for(let i=0;i<6;i++)c.finish(`g${i}`);assert.equal(c.due(),true);
  c=createAdCadence(s,{now:()=>now});assert.equal(c.snapshot().count,6);assert.equal(c.due(),true);
  c.noteFullscreen();assert.equal(c.due(),false);assert.equal(c.snapshot().count,6);
  now+=180000;assert.equal(c.due(),true);
});
test('cached-only availability never initiates a load and absent inventory is skipped',async()=>{
  let loaded=0;const provider={available:()=>false,ready:()=>{loaded++;return true;}};
  const ads=createAds({provider});assert.equal(await ads.available('interstitial'),false);assert.equal(loaded,0);
  await ads.ready('interstitial');assert.equal(loaded,1);
});
test('presentation persists the cadence before dismissal and duplicate notifications cannot reset it twice',async()=>{
  const s=storage(),c=createAdCadence(s);for(let i=0;i<6;i++)c.finish(String(i));
  let dismiss,shown;const ads=createAds({provider:{show:(_kind,_earned,onShown)=>{shown=onShown;return new Promise(r=>dismiss=r);}}});
  let notifications=0;const pending=ads.show('interstitial',undefined,()=>{notifications++;c.shown();});
  shown();assert.equal(createAdCadence(s).snapshot().count,0);c.finish('seventh');shown();
  dismiss({shown:true});await pending;assert.equal(notifications,1);assert.equal(c.snapshot().count,1);
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

test('native shown and earned phases are correlated and delivered only once before final dismissal',async()=>{
  let listener,message,shown=0,earned=0;const host={addEventListener:(_,fn)=>listener=fn,webkit:{messageHandlers:{imantoAds:{postMessage:body=>message=body}}}};
  const provider=createNativeAdProvider(host),pending=provider.show('rewarded',()=>earned++,()=>shown++);
  listener({detail:{requestId:'wrong',phase:'shown'}});assert.equal(shown,0);
  for(let i=0;i<2;i++)for(const phase of ['shown','earned'])listener({detail:{requestId:message.requestId,phase}});
  assert.equal(shown,1);assert.equal(earned,1);
  listener({detail:{requestId:message.requestId,shown:true,earned:true}});assert.equal((await pending).earned,true);
});
