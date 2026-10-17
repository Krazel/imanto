import {t} from './i18n.mjs';
import {nativeAudioBridge} from './native-audio.mjs';
export const AUDIO_FILES={button:'audio/ui-wood.wav',place:'audio/place.ogg',move:'audio/move.ogg',line:'audio/line.ogg'};
export function normalizeAudioSettings(value={}){
  const volume=(n,fallback)=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(1,n)):fallback;
  return {effects:value?.effects!==false,music:value?.music===true,effectsVolume:volume(value?.effectsVolume,.7),musicVolume:volume(value?.musicVolume,.15)};
}
export function createAudio(){
  const KEY='imanto-audio-v1';let saved;try{saved=JSON.parse(localStorage.getItem(KEY));}catch{}
  let settings=normalizeAudioSettings(saved),unlocked=false;
  const native=nativeAudioBridge();
  const nativeSync=()=>native?.send('settings',{...settings,unlocked,visible:!document.hidden});
  const pools=new Map(),status=document.querySelector('#audio-status');
  const music=native?{volume:0,pause(){nativeSync();}}:document.createElement('audio');
  if(!native){music.id='background-music';music.src='audio/carefree.mp3';music.preload='none';music.loop=true;music.hidden=true;document.body.append(music);}
  const report=message=>{status.textContent=t(message);};
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{}nativeSync();}
  function sync(){
    document.querySelector('#sound-enabled').checked=settings.effects;document.querySelector('#music-enabled').checked=settings.music;
    document.querySelector('#sound-volume').value=settings.effectsVolume;document.querySelector('#music-volume').value=settings.musicVolume;music.volume=settings.musicVolume;
    for(const pool of pools.values())for(const sample of pool)sample.volume=settings.effectsVolume;
    nativeSync();
  }
  async function play(cue,{preview=false}={}){
    if(!settings.effects){if(preview)report('Efectos desactivados.');return false;}
    if(!unlocked||document.hidden||!AUDIO_FILES[cue])return false;
    if(native){native.send('effect',{cue});if(preview)report('Reproduciendo…');return true;}
    let pool=pools.get(cue);if(!pool){pool=Array.from({length:3},()=>{const audio=new Audio(AUDIO_FILES[cue]);audio.preload='auto';return audio;});pools.set(cue,pool);}
    const sample=pool.find(a=>a.paused||a.ended);if(!sample)return false;
    sample.volume=settings.effectsVolume;sample.currentTime=0;
    try{await sample.play();if(preview){report('Reproduciendo…');sample.onended=()=>report('Listo para escuchar.');}return true;}catch{if(preview)report('No se pudo reproducir el audio.');return false;}
  }
  async function startMusic(){
    if(!settings.music||document.hidden||!unlocked)return;
    if(native){nativeSync();return;}
    try{await music.play();}catch(error){if(error.name!=='AbortError'&&settings.music&&!document.hidden)report('No se pudo reproducir el audio.');}
  }
  function stopAll(){if(native)native.send('pause');else music.pause();for(const pool of pools.values())for(const sample of pool){sample.pause();sample.currentTime=0;}}
  document.addEventListener('pointerdown',()=>{unlocked=true;nativeSync();startMusic();},{once:true});
  document.addEventListener('keydown',()=>{unlocked=true;nativeSync();startMusic();},{once:true});
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(button&&!button.disabled&&!button.closest('#cells')&&!button.matches('[data-cue],#music-play,#music-stop'))play('button');
  });
  for(const button of document.querySelectorAll('[data-cue]'))button.addEventListener('click',()=>play(button.dataset.cue,{preview:true}));
  document.querySelector('#sound-enabled').addEventListener('change',event=>{settings.effects=event.target.checked;if(!settings.effects)for(const pool of pools.values())for(const sample of pool)sample.pause();persist();});
  document.querySelector('#music-enabled').addEventListener('change',event=>{unlocked=true;settings.music=event.target.checked;persist();if(settings.music)startMusic();else music.pause();});
  document.querySelector('#sound-volume').addEventListener('input',event=>{settings.effectsVolume=Number(event.target.value);sync();persist();});
  document.querySelector('#music-volume').addEventListener('input',event=>{settings.musicVolume=Number(event.target.value);sync();persist();});
  document.querySelector('#music-play').addEventListener('click',()=>{unlocked=true;settings.music=true;sync();persist();startMusic();});
  document.querySelector('#music-stop').addEventListener('click',()=>{settings.music=false;music.pause();sync();persist();report('Listo para escuchar.');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAll();else startMusic();});
  addEventListener('pagehide',stopAll);sync();
  return {play};
}
