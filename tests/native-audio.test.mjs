import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeAudioBridge} from '../web/native-audio.mjs';
test('only an actual native handler selects the native backend',()=>{
 assert.equal(nativeAudioBridge({}),null);
 assert.equal(nativeAudioBridge({webkit:{messageHandlers:{imantoAudio:{}}}}),null);
 const calls=[];const bridge=nativeAudioBridge({webkit:{messageHandlers:{imantoAudio:{postMessage:v=>calls.push(v)}}}});
 bridge.send('settings',{effects:false,music:true,musicVolume:.15});bridge.send('effect',{cue:'line'});
 assert.deepEqual(calls,[{kind:'settings',effects:false,music:true,musicVolume:.15},{kind:'effect',cue:'line'}]);
});
