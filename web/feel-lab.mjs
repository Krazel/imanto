import {PLACEMENT_VARIANTS,createPlacementVariation} from './sound-variation.mjs';
// Standalone audition: no game imports, storage, score updates or selection writes.
const copy = {
  es: {
    back:'‹ Imanto', eyebrow:'IMANTO · LABORATORIO', title:'Tres formas de sentir Imanto',
    intro:'Coloca, completa una línea y compara. Tú eliges qué sensación encaja mejor.',
    soundOn:'Sonido activado',soundOff:'Sonido desactivado',volume:'Volumen',gesture:'El sonido empieza al pulsar una prueba.',
    proposal:'Son propuestas para comparar. Probarlas no cambia tu partida ni guarda una elección.',credits:'Sonidos y créditos',
    place:'Colocar',line:'Completar línea',sequence:'▶  Ver la secuencia',ready:'Pulsa una prueba para verla y escucharla.',
    placing:'La ficha encuentra su sitio…',placed:'Así se siente colocar.',clearing:'Una línea completa…',cleared:'Así se siente completar una línea.',
    loading:'Preparando sonido…',audioError:'No se ha podido reproducir el sonido. Puedes repetir la prueba.',muted:'Prueba sin sonido.',
    reduced:'Movimiento reducido según tu dispositivo.',
    wood:['Madera','Cálida y serena','Un contacto con peso. La línea se recoge con suavidad.'],
    light:['Luz','Ligera y precisa','Un toque limpio. Un destello recorre las cinco fichas.'],
    spring:['Elástico','Elegido · tono variable','Tu colocación favorita, con tonos sutiles al azar. La línea usa Acierto breve, tu sonido 5 elegido.'],
    sourceNote:'Grabaciones de la biblioteca de Studio, de Kenney, CC0. Elástico está elegido; su sonido de línea es Acierto breve (opción 5), elegido provisionalmente. Colocación con cinco versiones grabadas de tono ligeramente distinto, sin síntesis.',
    sources:['Madera · colocar: Madera; línea: bookFlip3.','Luz · colocar: Tocar una letra; línea: Palabra encontrada.','Elástico · colocar: bookPlace1 (±0,7 semitonos); línea: Sopa completada, Music Jingles.'],
  },
  en: {
    back:'‹ Imanto',eyebrow:'IMANTO · FEEL LAB',title:'Three ways to feel Imanto',
    intro:'Place a piece, complete a line and compare. Find the feeling that fits.',
    soundOn:'Sound on',soundOff:'Sound off',volume:'Volume',gesture:'Sound starts when you press a trial.',
    proposal:'These are proposals to compare. Trying them does not change your game or save a choice.',credits:'Sounds and credits',
    place:'Place',line:'Complete a line',sequence:'▶  Play the sequence',ready:'Press a trial to see and hear it.',
    placing:'The piece finds its place…',placed:'The feeling of placing.',clearing:'One complete line…',cleared:'The feeling of completing a line.',
    loading:'Preparing sound…',audioError:'The sound could not play. You can try the trial again.',muted:'Playing without sound.',
    reduced:'Reduced motion follows your device setting.',
    wood:['Wood','Warm and calm','A weighted touch. The line folds gently away.'],
    light:['Light','Light and precise','A crisp touch. A glint sweeps through all five pieces.'],
    spring:['Spring','Selected · varied pitch','Your chosen placement, with subtle random pitches. Quick success, your selected sound 5, for lines.'],
    sourceNote:'Recorded assets from the Studio library, by Kenney, CC0. Spring is selected; its line sound is Quick success (option 5), provisionally selected. Placement uses five prerecorded, slightly different pitches, without synthesis.',
    sources:['Wood · place: Madera; line: bookFlip3.','Light · place: Tocar una letra; line: Palabra encontrada.','Spring · place: bookPlace1 (±0.7 semitones); line: Sopa completada, Music Jingles.'],
  }
};
const options = [
  {kind:'wood',place:'tilt-ui',line:'quiet-bookflip3-wav'},
  {kind:'light',place:'sopa-letters',line:'sopa-word'},
  {kind:'spring',place:'place-spring',line:'sopa-word'},
];
const params = new URLSearchParams(location.search);
let lang = ['es','en'].includes(params.get('lang')) ? params.get('lang') : navigator.language?.startsWith('es') ? 'es' : 'en';
let soundEnabled = true, volume = .65, active = null, context = null, gain = null;
const nextPlacement=createPlacementVariation();
const buffers = new Map(), playing = new Set();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const cards = document.querySelector('#cards');
const audioStatus = document.querySelector('#audio-status');
const bufferPromises = new Map();
// Only decoded recordings are played. There are no oscillators or generated audio.
async function prepareAudio() {
  if (!soundEnabled || volume === 0) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('Recorded audio context unavailable');
  if (!context) { context = new AudioCtx(); gain = context.createGain();gain.gain.value=volume;gain.connect(context.destination); }
  await context.resume();
}
function loadSound(id) {
  if (buffers.has(id)) return Promise.resolve(buffers.get(id));
  if (!bufferPromises.has(id)) {
    bufferPromises.set(id,fetch(id.startsWith('place-spring-')?`./audio/${id}.wav`:`./audio/feel-lab/${id}.wav`).then(response=>{
      if(!response.ok)throw new Error('Missing recording');return response.arrayBuffer();
    }).then(bytes=>context.decodeAudioData(bytes)).then(buffer=>{buffers.set(id,buffer);return buffer;}).catch(error=>{bufferPromises.delete(id);throw error;}));
  }
  return bufferPromises.get(id);
}
function playSound(id) {
  if(id==='place-spring'){const variation=nextPlacement();id=PLACEMENT_VARIANTS[variation];if(active)active.card.dataset.lastPitch=String(variation);}
  if (!soundEnabled || !volume || !context || context.state !== 'running' || !buffers.has(id)) return;
  const source=context.createBufferSource();source.buffer=buffers.get(id);source.connect(gain);
  source.onended=()=>{playing.delete(source);source.disconnect();};playing.add(source);source.start();
}
function stopAudio(){for(const source of playing){try{source.stop();}catch{ /* Already ended. */ }}playing.clear();}
function wait(ms, signal) {
  return new Promise(resolve=>{
    if(signal.aborted)return resolve(false);
    const cancel=()=>{clearTimeout(timer);resolve(false);};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve(true);},ms);
    signal.addEventListener('abort',cancel,{once:true});
  });
}
function animate(run,element,keyframes,duration,delay=0,easing='ease-out') {
  if(run.signal.aborted)return;
  const animation=element.animate(keyframes,{duration,delay,easing,fill:'both'});
  run.animations.push(animation);return animation;
}
function tile(color=''){return `<span class="tile ${color}"></span>`;}
function render(){
  document.documentElement.lang=lang;document.title=`Imanto · ${lang==='es'?'Sensaciones':'Feel lab'}`;
  document.querySelectorAll('[data-text]').forEach(el=>el.textContent=copy[lang][el.dataset.text]);
  document.querySelectorAll('[data-lang]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.lang===lang)));
  document.querySelector('#volume').setAttribute('aria-label',copy[lang].volume);
  cards.innerHTML=options.map((option,index)=>{
    const text=copy[lang][option.kind];
    return `<article id="${option.kind}" class="card" data-kind="${option.kind}"><div class="card-head"><div class="label-row"><span class="number">0${index+1}</span><span class="character">${text[1]}</span></div><h2>${text[0]}</h2><p class="description">${text[2]}</p></div>
    <div class="scene" aria-hidden="true"><div class="board"><div class="grid">${Array.from({length:15},(_,i)=>`<div class="cell ${i===7?'target':''} ${i===1||i===13?'decor':''}">${i>=5&&i<=9?tile():i===1?tile('teal'):i===13?tile('amber'):''}</div>`).join('')}</div><div class="fx"></div></div><div class="tray">${tile()}</div><div class="reward">+50</div></div>
    <p class="scene-status" role="status" aria-live="polite">${copy[lang].ready}</p>
    <div class="controls"><button data-action="place" aria-pressed="false">${copy[lang].place}</button><button data-action="line" aria-pressed="false">${copy[lang].line}</button><button data-action="sequence" aria-pressed="false">${copy[lang].sequence}</button></div></article>`;
  }).join('');
  document.querySelector('#credits').innerHTML=`<p>${copy[lang].sourceNote}</p>${copy[lang].sources.map(s=>`<p>${s}</p>`).join('')}<p>Kenney: <a href="https://kenney.nl/assets/impact-sounds" target="_blank" rel="noreferrer">Impact Sounds</a> · <a href="https://kenney.nl/assets/rpg-audio" target="_blank" rel="noreferrer">RPG Audio</a> · <a href="https://kenney.nl/assets/interface-sounds" target="_blank" rel="noreferrer">Interface Sounds</a> · <a href="https://kenney.nl/assets/casino-audio" target="_blank" rel="noreferrer">Casino Audio</a> · <a href="https://kenney.nl/assets/music-jingles" target="_blank" rel="noreferrer">Music Jingles</a></p>`;
  updateSound();
}
function updateSound(){
  const button=document.querySelector('#sound');button.setAttribute('aria-pressed',String(soundEnabled));
  button.querySelector('[data-text]').textContent=copy[lang][soundEnabled?'soundOn':'soundOff'];
}
function cancelActive(){
  if(!active)return;
  const run=active;run.controller.abort();run.animations.forEach(a=>a.cancel());
  run.card.classList.remove('is-running');run.card.removeAttribute('aria-busy');
  run.card.querySelectorAll('[data-action]').forEach(b=>b.setAttribute('aria-pressed','false'));
  run.target.style.opacity='';run.tray.style.opacity='';
  run.card.querySelectorAll('.cell>.tile').forEach(el=>{el.style.opacity='';});
  run.fx.replaceChildren();run.status.textContent=copy[lang].ready;
  stopAudio();active=null;
}
function effect(run,cls,styles){const el=document.createElement('i');el.className=cls;Object.assign(el.style,styles);run.fx.append(el);return el;}
function localRect(el,relative){const r=el.getBoundingClientRect(),b=relative.getBoundingClientRect();return {x:r.left-b.left,y:r.top-b.top,w:r.width,h:r.height};}
async function placement(run){
  const {kind}=run.option;run.status.textContent=copy[lang].placing;
  const from=run.tray.getBoundingClientRect(),to=run.target.getBoundingClientRect();
  const dx=from.left+from.width/2-to.left-to.width/2,dy=from.top+from.height/2-to.top-to.height/2;
  run.tray.style.opacity='0';run.target.style.opacity='1';
  const duration=reduced.matches?140:kind==='wood'?240:kind==='light'?180:220;
  const frames=reduced.matches?[{opacity:0},{opacity:1}]:[
    {transform:`translate(${dx}px,${dy}px) scale(${from.width/to.width}) rotate(${kind==='spring'?-7:0}deg)`},
    {transform:'translate(0,0) scale(1) rotate(0deg)'}
  ];
  animate(run,run.target,frames,duration,0,kind==='light'?'cubic-bezier(.2,.65,.2,1)':'cubic-bezier(.45,0,.75,.5)');
  if(!await wait(duration,run.signal))return false;playSound(run.option.place);
  if(!reduced.matches){
    if(kind==='wood')animate(run,run.target,[{transform:'scale(1.07,.91)'},{transform:'translateY(-4px) scale(.98,1.03)',offset:.4},{transform:'none'}],260);
    if(kind==='spring')animate(run,run.target,[{transform:'scale(1.16,.79)'},{transform:'translateY(-7px) scale(.94,1.08)',offset:.3},{transform:'scale(1.06,.94)',offset:.6},{transform:'translateY(-2px) scale(.99,1.02)',offset:.8},{transform:'none'}],480);
    const r=localRect(run.target,run.fx);
    const halo=effect(run,'halo',{left:`${r.x-4}px`,top:`${r.y-4}px`,width:`${r.w+8}px`,height:`${r.h+8}px`,borderRadius:kind==='light'?'50%':'14px'});
    animate(run,halo,[{opacity:.65,transform:'scale(.8)'},{opacity:0,transform:`scale(${kind==='light'?1.65:1.3})`}],kind==='light'?360:410);
  }
  if(!await wait(reduced.matches?150:kind==='spring'?480:360,run.signal))return false;
  run.status.textContent=copy[lang].placed;return true;
}
async function line(run){
  const {kind}=run.option;run.status.textContent=copy[lang].clearing;
  run.target.style.opacity='1';run.tray.style.opacity='0';
  const pieces=[...run.card.querySelectorAll('.cell')].slice(5,10).map(c=>c.querySelector('.tile'));
  // Neutral anticipation keeps a line-only trial legible before it clears.
  if(!await wait(180,run.signal))return false;
  if(reduced.matches){
    playSound(run.option.line);pieces.forEach(p=>animate(run,p,[{opacity:1},{opacity:0}],220));
    if(!await wait(240,run.signal))return false;
  } else if(kind==='wood'){
    pieces.forEach(p=>animate(run,p,[{transform:'scale(1)'},{transform:'scale(1.035)',offset:.55},{transform:'scale(1)'}],220));
    if(!await wait(220,run.signal))return false;playSound(run.option.line);
    pieces.forEach((p,i)=>animate(run,p,[{opacity:1,transform:'translateY(0) scaleY(1)'},{opacity:.85,transform:'translateY(4px) scaleY(.84)',offset:.45},{opacity:0,transform:'translateY(12px) scaleY(.2)'}],360,i*45));
    const a=localRect(pieces[0],run.fx),z=localRect(pieces[4],run.fx);
    const arc=effect(run,'halo',{left:`${a.x}px`,top:`${a.y+a.h-7}px`,width:`${z.x+z.w-a.x}px`,height:'14px',borderTop:'none',borderLeft:'none',borderRight:'none',borderRadius:'50%'});
    animate(run,arc,[{opacity:0,transform:'scaleX(.65)'},{opacity:.55,offset:.3},{opacity:0,transform:'scaleX(1.03) translateY(8px)'}],600);
    if(!await wait(590,run.signal))return false;
  } else if(kind==='light'){
    playSound(run.option.line);const a=localRect(pieces[0],run.fx),z=localRect(pieces[4],run.fx);
    const beam=effect(run,'beam',{left:`${a.x}px`,top:`${a.y+a.h/2-2}px`,width:`${a.w*1.25}px`});
    animate(run,beam,[{opacity:0,transform:'translateX(-8px)'},{opacity:1,offset:.12},{opacity:1,offset:.8},{opacity:0,transform:`translateX(${z.x-a.x+8}px)`}],450);
    pieces.forEach((p,i)=>{
      animate(run,p,[{opacity:1,transform:'scale(1)',filter:'brightness(1)'},{opacity:1,transform:'scale(1.045)',filter:'brightness(1.25)',offset:.3},{opacity:0,transform:'scale(.25)',filter:'brightness(1.1)'}],240,i*70);
      const r=localRect(p,run.fx),spark=effect(run,'spark',{left:`${r.x+r.w/2-3}px`,top:`${r.y+r.h/2-3}px`,background:'#fff5cc',boxShadow:'0 0 9px #e6b550'});
      animate(run,spark,[{opacity:0,transform:'scale(.3)'},{opacity:1,offset:.25},{opacity:0,transform:'translateY(-14px) scale(.2)'}],480,i*70+100);
    });
    if(!await wait(680,run.signal))return false;
  } else {
    playSound(run.option.line);
    pieces.forEach((p,i)=>{
      const delay=Math.abs(i-2)*90,offset=(i-2)*2;
      animate(run,p,[{opacity:1,transform:'scale(1)'},{opacity:1,transform:'scale(1.1,.85)',offset:.2},{opacity:1,transform:`translate(${offset}px,-10px) scale(.92,1.07)`,offset:.46},{opacity:.9,transform:`translate(${offset}px,0) scale(1.05,.96)`,offset:.7},{opacity:0,transform:`translate(${offset}px,5px) scale(.15)`}],520,delay);
      const r=localRect(p,run.fx),spark=effect(run,'spark',{left:`${r.x+r.w/2-3}px`,top:`${r.y+r.h/2-3}px`});
      animate(run,spark,[{opacity:0,transform:'scale(.5)'},{opacity:.8,transform:`translate(${offset*2}px,-22px)`,offset:.45},{opacity:0,transform:`translate(${offset*3}px,4px) scale(.2)`}],480,delay+230);
    });
    if(!await wait(760,run.signal))return false;
  }
  const reward=run.card.querySelector('.reward');
  animate(run,reward,reduced.matches?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translate(-50%,10px) scale(.92)'},{opacity:1,transform:'translate(-50%,0) scale(1)'}],240);
  run.status.textContent=copy[lang].cleared;return true;
}
async function start(card,action){
  cancelActive();audioStatus.textContent='';
  const controller=new AbortController();const option=options.find(o=>o.kind===card.dataset.kind);
  const run={card,option,controller,signal:controller.signal,animations:[],target:card.querySelector('.target>.tile'),tray:card.querySelector('.tray>.tile'),fx:card.querySelector('.fx'),status:card.querySelector('.scene-status')};
  active=run;card.classList.add('is-running');card.setAttribute('aria-busy','true');
  card.querySelector(`[data-action="${action}"]`).setAttribute('aria-pressed','true');
  if(soundEnabled&&volume){
    run.status.textContent=copy[lang].loading;
    try{await prepareAudio();if(run.signal.aborted)return;await Promise.all([...(option.kind==='spring'?PLACEMENT_VARIANTS.map(loadSound):[loadSound(option.place)]),loadSound(option.line)]);}
    catch{if(!run.signal.aborted)audioStatus.textContent=copy[lang].audioError;}
  }
  if(run.signal.aborted)return;
  if(reduced.matches)audioStatus.textContent=copy[lang].reduced;
  let done=true;
  if(action!=='line')done=await placement(run);
  if(!done||run.signal.aborted)return;
  if(action==='sequence'&&!await wait(280,run.signal))return;
  if(action!=='place')done=await line(run);
  if(!done||run.signal.aborted)return;
  if(!await wait(1000,run.signal))return;
  if(active===run)cancelActive();
}
cards.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(button)void start(button.closest('.card'),button.dataset.action);});
document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>{cancelActive();lang=button.dataset.lang;audioStatus.textContent='';render();}));
document.querySelector('#sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;if(!soundEnabled)stopAudio();updateSound();});
document.querySelector('#volume').addEventListener('input',event=>{volume=Number(event.target.value)/100;if(gain)gain.gain.setValueAtTime(volume,context.currentTime);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelActive();stopAudio();void context?.suspend();}});
window.addEventListener('pagehide',()=>{cancelActive();stopAudio();void context?.suspend();});
reduced.addEventListener('change',()=>cancelActive());
render();
