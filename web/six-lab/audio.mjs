import {nativeAudioBridge} from '../native-audio.mjs';
import {normalizeAudioSettings} from '../audio.mjs';
import {PLACEMENT_VARIANTS,createPlacementVariation} from '../sound-variation.mjs';

// Reuse the game's preferences and native recordings; trial mute stays separate.
export function trialAudio(scope=globalThis){
  let saved;try{saved=JSON.parse(scope.localStorage.getItem('imanto-audio-v1'));}catch{}
  const settings=normalizeAudioSettings(saved),native=nativeAudioBridge(scope),samples=new Set(),pitch=createPlacementVariation();
  let muted=false,haptics=true;try{haptics=JSON.parse(scope.localStorage.getItem('imanto-haptics-v1'))!==false;}catch{}
  const tactile=scope.webkit?.messageHandlers?.imantoHaptics;
  const sync=()=>{
    native?.send('settings',{...settings,effects:settings.effects&&!muted,music:settings.music&&!muted,unlocked:true,visible:!scope.document.hidden});
    tactile?.postMessage({kind:'settings',enabled:haptics,visible:!scope.document.hidden});
  };
  const stop=()=>{native?.send('pause');for(const a of samples)a.pause();};
  scope.document.addEventListener('visibilitychange',()=>scope.document.hidden?stop():sync());
  scope.addEventListener('pagehide',stop);
  return {
    mute(value){muted=value;if(muted)for(const a of samples)a.pause();sync();},
    play(cue){
      if(scope.document.hidden)return;
      if(haptics&&scope.imantoCapabilities?.haptics)tactile?.postMessage({kind:'play',cue});
      if(muted||!settings.effects)return;
      const variation=cue==='place'?pitch():null;
      if(native){native.send('effect',{cue,...(variation===null?{}:{variation})});return;}
      const file=cue==='place'?`../audio/${PLACEMENT_VARIANTS[variation]}.wav`:'../audio/line-win.wav',a=new scope.Audio(file);
      a.volume=settings.effectsVolume;samples.add(a);a.onended=()=>samples.delete(a);void a.play().catch(()=>samples.delete(a));
    }
  };
}
