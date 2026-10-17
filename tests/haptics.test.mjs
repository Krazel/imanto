import test from 'node:test';
import assert from 'node:assert/strict';
import {createHaptics,clearHaptic} from '../web/haptics.mjs';
import {effectScene} from '../web/effect-demos.mjs';
import {playTurn} from '../web/engine.mjs';

function host({supported=true,saved=null,native=true}={}){
  const messages=[],events={},toggle={checked:true,addEventListener:(k,fn)=>events.change=fn},row={hidden:true};
  const values=new Map(saved===null?[]:[['imanto-haptics-v1',saved]]);
  const scope={document:{hidden:false,querySelector:s=>s==='#haptics-row'?row:toggle,addEventListener:(k,fn)=>events[k]=fn},imantoCapabilities:{haptics:supported},localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}};
  if(native)scope.webkit={messageHandlers:{imantoHaptics:{postMessage:v=>messages.push(v)}}};
  return {scope,messages,events,toggle,row,values};
}
test('real game clear batches select a single line, combo or all-clear cue',()=>{
  for(const [kind,cue] of [['single','line'],['double','combo'],['triple','combo'],['all','allClear']]){
    const scene=effectScene(kind),result=playTurn(scene.state,scene.at,scene.option);
    const frames=result.frames.filter(f=>f.kind==='clear');
    assert.equal(frames.length,1,kind);assert.equal(clearHaptic(frames[0]),cue,kind);
  }
  assert.equal(clearHaptic({lineCount:0}),null);
});
test('preparing does not vibrate; optional haptics persist and stop in the background',()=>{
  const h=host(),feedback=createHaptics(h.scope);
  assert.equal(h.row.hidden,false);
  feedback.prepare();assert.equal(h.messages.at(-1).kind,'prepare');
  feedback.play('place');feedback.clear({lineCount:3});
  assert.deepEqual(h.messages.filter(m=>m.kind==='play').map(m=>m.cue),['place','combo']);
  h.toggle.checked=false;h.events.change();
  assert.equal(h.values.get('imanto-haptics-v1'),'false');
  const count=h.messages.length;feedback.play('place');feedback.clear({lineCount:1});feedback.prepare();assert.equal(h.messages.length,count);
  h.toggle.checked=true;h.events.change();h.scope.document.hidden=true;h.events.visibilitychange();
  const hiddenCount=h.messages.length;feedback.play('line');assert.equal(h.messages.length,hiddenCount);
  h.scope.document.hidden=false;h.events.visibilitychange();feedback.clear({lineCount:2,allClear:true});
  assert.equal(h.messages.at(-1).cue,'allClear');
});
test('unsupported hardware/browser exposes no haptics setting or vibration fallback',()=>{
  for(const options of [{supported:false},{native:false}]){
    const h=host(options),feedback=createHaptics(h.scope);
    assert.equal(h.row.hidden,true);feedback.prepare();feedback.play('place');feedback.clear({lineCount:2});
    assert.equal(h.messages.some(m=>m.kind==='play'||m.kind==='prepare'),false);
  }
  const h=host({saved:'false'});createHaptics(h.scope);assert.equal(h.toggle.checked,false);
});
