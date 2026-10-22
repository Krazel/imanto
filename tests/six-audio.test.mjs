import test from 'node:test';
import assert from 'node:assert/strict';
import {trialAudio} from '../web/six-lab/audio.mjs';
test('6×6 uses native recordings and respects existing audio mutes and trial mute',()=>{
  for(const effects of [true,false]){
    const messages=[],listeners={};
    const scope={localStorage:{getItem:key=>key==='imanto-audio-v1'?JSON.stringify({effects,music:false,effectsVolume:.4}):null},document:{hidden:false,addEventListener:(key,fn)=>listeners[key]=fn},addEventListener:(key,fn)=>listeners[key]=fn,webkit:{messageHandlers:{imantoAudio:{postMessage:m=>messages.push(m)}}},Audio:class{constructor(){throw Error('HTMLAudio cannot run in native trial');}}};
    const audio=trialAudio(scope);audio.mute(false);audio.play('place');audio.play('line');
    assert.equal(messages[0].music,false);assert.equal(messages[0].effectsVolume,.4);
    assert.equal(messages.filter(m=>m.kind==='effect').length,effects?2:0);
    audio.mute(true);const count=messages.length;audio.play('line');assert.equal(messages.length,count);
    listeners.pagehide();assert.equal(messages.at(-1).kind,'pause');
  }
});
