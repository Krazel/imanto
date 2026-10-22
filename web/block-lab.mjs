import {PLACEMENT_VARIANTS,createPlacementVariation} from './sound-variation.mjs';
// An independent material preview. No game state, save or purchase APIs are used.
const finishes=['current','ceramic','glass','gummy','wood'];
const colors=['coral','teal','honey','violet'];
const palettes={
  original:{es:'Original',en:'Original',hex:['#f46b50','#278a91','#edb137','#927fb6'],esNames:['Coral','Turquesa','Miel','Violeta'],enNames:['Coral','Teal','Honey','Violet']},
  arcade:{es:'Arcade',en:'Arcade',hex:['#3556e5','#e9338b','#a2cf27','#f28a25'],esNames:['Azul eléctrico','Fucsia','Lima','Mandarina'],enNames:['Electric blue','Hot pink','Lime','Tangerine']},
  lagoon:{es:'Laguna',en:'Lagoon',hex:['#23476c','#39c2b3','#f29b7e','#b28bd9'],esNames:['Azul marino','Aguamarina','Melocotón','Lavanda'],enNames:['Navy','Aquamarine','Peach','Lavender']},
  garden:{es:'Jardín',en:'Garden',hex:['#743c79','#7a9e34','#e5a82b','#58addc'],esNames:['Ciruela','Oliva','Azafrán','Celeste'],enNames:['Plum','Olive','Saffron','Sky blue']},
  ink:{es:'Tinta',en:'Ink',hex:['#414650','#f4e8ce','#d33650','#366bd3'],esNames:['Grafito','Marfil','Carmesí','Azul cobalto'],enNames:['Graphite','Ivory','Crimson','Cobalt blue']}
};
const words={
  es:{eyebrow:'IMANTO · MATERIALES',title:'Materiales y colores para elegir.',intro:'Cambia la superficie y pruébala con el movimiento Elástico que elegiste.',choose:'Elige un acabado para probar',materialNote:'Misma forma. Combina cada material con una paleta completa.',preview:'VISTA PREVIA',color:'Color de la prueba',place:'Colocar',line:'Completar línea',sequence:'▶ Secuencia',volume:'Volumen',footer:'Son pruebas de acabado: todavía no hay ninguna elección nueva guardada.',soundNote:'Misma animación y mismos sonidos en todas las opciones.',reference:'Referencia',proposal:'Propuesta · sin guardar',soundOn:'Sonido activado',soundOff:'Sonido desactivado',ready:'Pulsa una prueba para ver cómo se siente.',loading:'Preparando sonido…',placing:'La ficha encuentra su sitio…',placed:'Contacto suave. Pequeño rebote.',clearing:'La línea responde desde el centro…',cleared:'Una línea completa. +50',error:'No se ha podido reproducir el sonido. Puedes repetir.',reduced:'Movimiento reducido según tu dispositivo.',coral:'Coral',teal:'Turquesa',honey:'Miel',
    current:['Actual','Liso y limpio. La referencia del juego.'],ceramic:['Cerámica esmaltada','Baldosa opaca, esmalte moteado y borde firme.'],glass:['Cristal','Cristal tallado: facetas, grosor y centro translúcido.'],gummy:['Gominola','Gel abombado, burbujas y luz por dentro.'],wood:['Madera pintada','Veta marcada, nudo y bisel de madera.']},
  en:{eyebrow:'IMANTO · MATERIALS',title:'Materials and colours to choose.',intro:'Change the surface and try it with your chosen Spring motion.',choose:'Choose a finish to try',materialNote:'Same shape. Try each material with a complete palette.',preview:'PREVIEW',color:'Trial colour',place:'Place',line:'Complete a line',sequence:'▶ Sequence',volume:'Volume',footer:'These are finish trials. No new choice has been saved.',soundNote:'The same motion and sounds in every option.',reference:'Reference',proposal:'Proposal · unsaved',soundOn:'Sound on',soundOff:'Sound off',ready:'Press a trial to see how it feels.',loading:'Preparing sound…',placing:'The piece finds its place…',placed:'A soft touch. A little bounce.',clearing:'The line ripples from the centre…',cleared:'One complete line. +50',error:'The sound could not play. You can try again.',reduced:'Reduced motion follows your device setting.',coral:'Coral',teal:'Teal',honey:'Honey',
    current:['Current','Smooth and clean. The game reference.'],ceramic:['Glazed ceramic','Opaque tile, speckled glaze and a firm rim.'],glass:['Glass','Cut glass: facets, depth and a translucent centre.'],gummy:['Gummy','Domed gel, tiny bubbles and light within.'],wood:['Painted wood','Visible grain, a knot and carved wooden edges.']}
};
Object.assign(words.es,{palettes:'Paletas para comparar',paletteNote:'Tres colores al empezar. El cuarto entra desde la tanda 4.',startStage:'Inicio · 3 colores',laterStage:'Desde tanda 4 · 4 colores',random:'Al azar entre partidas',newGame:'Simular nueva partida',paletteRule:'Cada partida recibe otra paleta al azar y la conserva hasta terminar. Las muestras manuales son solo para comparar.',trialColor:'Color de prueba · no es la tanda de fichas',sessionOnly:'Solo vista previa: no cambia tu partida ni tus ajustes.',choose:'Elige una familia',versions:'Tres versiones para comparar',uniqueReference:'El acabado actual, como referencia.',uniqueWood:'Madera V2 elegida. Se conserva exactamente.',chosen:'Elegida',versionNote:'Prueba cada versión con la misma animación.',footer:'Madera elegida. Las versiones de cerámica, cristal y gominola siguen siendo propuestas.',sixLink:'Probar tablero 6×6'});
Object.assign(words.en,{palettes:'Palettes to compare',paletteNote:'Three starting colours. The fourth joins from batch 4.',startStage:'Start · 3 colours',laterStage:'From batch 4 · 4 colours',random:'Random between games',newGame:'Simulate new game',paletteRule:'Each new game gets a different random palette and keeps it until the end. Manual swatches are only for comparison.',trialColor:'Trial colour · not your hand of pieces',sessionOnly:'Preview only: your game and settings stay unchanged.',choose:'Choose a family',versions:'Three versions to compare',uniqueReference:'The current finish, as a reference.',uniqueWood:'Wood V2 selected. Kept exactly as chosen.',chosen:'Selected',versionNote:'Try every version with the same motion.',footer:'Wood is selected. Ceramic, glass and gummy versions are still proposals.',sixLink:'Try the 6×6 board'});
Object.assign(words.es,{versions:'Cuatro tipos, lado a lado',uniqueCeramic:'Cerámica craquelada elegida.',versionNote:'Compara los cuatro tipos. Toca el que quieras probar en el tablero.',footer:'Madera y cerámica craquelada elegidas. Los ocho tipos de cristal y gominola son propuestas.',ceramic:['Cerámica craquelada','Elegida · esmalte con grietas finas.'],wood:['Madera pintada','Elegida · veta, nudo y bisel.'],glass:['Cristal','Joya, macizo, esmerilado y martillado.'],gummy:['Gominola','Gelatina, fruta, azúcar y leche.']});
Object.assign(words.en,{versions:'Four types, side by side',uniqueCeramic:'Crackle ceramic selected.',versionNote:'Compare the four types. Tap one to try it on the board.',footer:'Wood and crackle ceramic are selected. The eight glass and gummy types are proposals.',ceramic:['Crackle ceramic','Selected · fine cracks in the glaze.'],wood:['Painted wood','Selected · grain, knot and bevel.'],glass:['Glass','Jewel, solid, frosted and hammered.'],gummy:['Gummy','Jelly, fruit, sugar and milk.']});
Object.assign(words.es,{gummy:['Gelatina','Tu gelatina limpia y tres variaciones de la misma.'],baseChosen:'Base limpia',footer:'Madera y cerámica craquelada elegidas. Gelatina base limpiada como pediste; tres variaciones para comparar. Sonido 5 elegido por ahora.',uniqueWood:'Madera elegida. Se conserva exactamente.'});
Object.assign(words.en,{gummy:['Jelly','Your clean jelly and three variations of it.'],baseChosen:'Clean base',footer:'Wood and crackle ceramic selected. Jelly base cleaned as requested; three variations to compare. Sound 5 selected for now.',uniqueWood:'Wood selected. Kept exactly as chosen.'});
const versionText={
  es:{glass:[['Joya tallada','Facetas grandes y una mesa central profunda.'],['Vidrio macizo','Transparente, pesado y con bordes de lente.'],['Esmerilado','Lechoso, difuso y suave al tacto.'],['Martillado','Relieve irregular que deforma la luz.']],gummy:[['Base limpia','Tu gelatina, sin círculos ni reflejo inferior.'],['Suave','La misma gelatina, con brillo más difuso.'],['Mullida','La misma base, más abombada y tierna.'],['Translúcida','La misma gelatina, más ligera y transparente.']]},
  en:{glass:[['Cut jewel','Broad facets around a deep central table.'],['Solid glass','Clear and weighty, with lens-like edges.'],['Frosted','Milky, diffuse and soft to the touch.'],['Hammered','Irregular dimples that distort the light.']],gummy:[['Clean base','Your jelly, without circles or a lower glint.'],['Soft','The same jelly with a softer sheen.'],['Pillowy','The same base, plumper and softer.'],['Translucent','The same jelly, lighter and clearer.']]}
};
const query=new URLSearchParams(location.search);
const soundFocus=query.get('sounds')==='1';
document.body.classList.toggle('sound-focus',soundFocus);
const lineOptions=[
  {id:'current',es:'Cuerdas · anterior',en:'Strings · previous',time:'1.15 s'},
  {id:'pizzi',es:'Pizzicato corto',en:'Short pizzicato',time:'0.49 s'},
  {id:'steel',es:'Celebración tropical',en:'Tropical celebration',time:'1.39 s'},
  {id:'double',es:'Doble acierto',en:'Double success',time:'0.54 s'},
  {id:'brief',es:'Acierto breve · elegido',en:'Quick success · selected',time:'0.29 s'}
];
let lineSound='brief';
const lineId=()=>`line-trials/${lineSound}`;
function renderLineSounds(){
  const es=lang==='es';
  $('#line-sounds-title').textContent=es?'Cinco sonidos de línea':'Five line sounds';
  $('#line-sounds-note').textContent=es?'Escucha cada opción o pruébala con la línea. La elección solo se usa en esta prueba.':'Listen to each option or try it with the line. Your choice only applies to this preview.';
  $('#line-sound-list').innerHTML=lineOptions.map((o,i)=>`<div class="sound-option" data-selected="${o.id===lineSound}"><div><strong>${i+1}. ${o[lang]}</strong><small>${o.time}</small></div><button data-listen="${o.id}" aria-pressed="${o.id===lineSound}" aria-label="${es?'Escuchar':'Listen to'} ${o[lang]}">▶ ${es?'Escuchar':'Listen'}</button><button data-line-demo="${o.id}" aria-label="${es?'Probar línea con':'Try line with'} ${o[lang]}">${es?'Ver línea':'Try line'}</button></div>`).join('');
  $('#stop-audition').textContent=es?'■ Detener':'■ Stop';
  $('#sound-lab-link').textContent=soundFocus?(es?'← Volver a materiales':'← Back to materials'):(es?'♪ Probar sonidos de línea':'♪ Try line sounds');
  $('#sound-lab-link').href=`?${soundFocus?'':'sounds=1&'}lang=${lang}`;
  if(soundFocus){document.title=es?'Imanto · Sonidos de línea':'Imanto · Line sounds';$('.intro h1').textContent=es?'Así suena una línea.':'The sound of a line.';$('.intro>p:last-child').textContent=es?'Cinco opciones reales, la misma animación Elástico.':'Five real sound clips, the same Spring animation.';}
  $('[data-text="soundNote"]').textContent=es?'Misma animación. Sonido 5 elegido por ahora.':'Same motion. Sound 5 selected for now.';
}
let palette=Object.hasOwn(palettes,query.get('palette'))?query.get('palette'):Object.keys(palettes)[Math.floor(Math.random()*Object.keys(palettes).length)];
let stage=3;
const activeColors=()=>colors.slice(0,stage);
const colorName=c=>palettes[palette][lang==='es'?'esNames':'enNames'][colors.indexOf(c)];
let lang=['es','en'].includes(query.get('lang'))?query.get('lang'):navigator.language?.startsWith('es')?'es':'en';
let finish=finishes.includes(query.get('finish'))?query.get('finish'):'gummy',color='coral';
const selectedVersions={ceramic:3,glass:1,gummy:1};
if(['glass','gummy'].includes(finish)&&[1,2,3,4].includes(Number(query.get('version'))))selectedVersions[finish]=Number(query.get('version'));
let active=null,enabled=true,volume=.65,context=null,gain=null;
const nextPitch=createPlacementVariation(),buffers=new Map(),loads=new Map(),playing=new Set();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const $=selector=>document.querySelector(selector),preview=$('#preview'),board=$('#board'),fx=$('#fx');
const block=c=>`<span class="block ${c}"></span>`;
function renderBoard(){
  const occupied={0:'teal',3:'honey',6:stage===4?'violet':'coral',8:'teal',17:'honey',19:stage===4?'violet':'teal',22:'coral'};
  $('#grid').innerHTML=Array.from({length:25},(_,i)=>`<div class="cell ${i===12?'target':''}">${i>=10&&i<=14?block(color):occupied[i]?block(occupied[i]):''}</div>`).join('');
  $('#tray').innerHTML=activeColors().map(c=>`<button class="color-choice" data-color="${c}" aria-label="${colorName(c)}" aria-pressed="${c===color}">${block(c)}</button>`).join('');
}
function selectFinish(){
  const version=selectedVersions[finish]||1,list=versionText[lang][finish];
  preview.dataset.finish=finish;preview.dataset.variant=String(version);
  $('#active-name').textContent=words[lang][finish][0]+(list?` · ${list[version-1][0]}`:'');
  $('#proposal').textContent=words[lang][finish==='current'?'reference':finish==='gummy'&&version===1?'baseChosen':['wood','ceramic'].includes(finish)?'chosen':'proposal'];
  document.querySelectorAll('[data-choice]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.choice===finish));b.dataset.variant=String(selectedVersions[b.dataset.choice]||1);});
  $('#version-title').textContent=list?words[lang].versions:words[lang][['wood','ceramic'].includes(finish)?'chosen':'reference'];
  $('#versions').hidden=!list;
  $('#versions').innerHTML=list?list.map((item,i)=>`<button class="version" data-version="${i+1}" data-finish="${finish}" data-variant="${i+1}" aria-pressed="${version===i+1}"><span class="version-number">0${i+1}</span><span class="version-samples" aria-hidden="true">${colors.slice(0,3).map(block).join('')}</span><strong>${item[0]}</strong><small>${item[1]}</small></button>`).join(''):'';
  $('#version-note').textContent=words[lang][list?'versionNote':finish==='wood'?'uniqueWood':finish==='ceramic'?'uniqueCeramic':'uniqueReference'];
}
function updateSound(){ $('#sound').setAttribute('aria-pressed',String(enabled));$('#sound-label').textContent=words[lang][enabled?'soundOn':'soundOff']; }
function render(){
  document.documentElement.lang=lang;document.title=`Imanto · ${lang==='es'?'Acabados':'Finishes'}`;
  document.querySelectorAll('[data-text]').forEach(el=>el.textContent=words[lang][el.dataset.text]);
  document.querySelectorAll('[data-lang]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.lang===lang)));
  $('.materials').setAttribute('aria-label',words[lang].choose);preview.setAttribute('aria-label',words[lang].preview);$('#volume').setAttribute('aria-label',words[lang].volume);
  $('#finishes').innerHTML=finishes.map(f=>`<button class="finish" data-choice="${f}" data-finish="${f}" aria-pressed="${f===finish}"><span class="samples" aria-hidden="true">${colors.slice(0,3).map(block).join('')}</span><span class="finish-text"><span class="finish-name">${words[lang][f][0]}</span><span class="finish-description">${words[lang][f][1]}</span><span class="family-status">${words[lang][f==='current'?'reference':f==='gummy'?'baseChosen':['wood','ceramic'].includes(f)?'chosen':'proposal']}</span></span><span class="finish-check" aria-hidden="true">✓</span></button>`).join('');
  renderPalettes();renderBoard();selectFinish();updateSound();renderLineSounds();$('#status').textContent=words[lang].ready;
}
function renderPalettes(){
  colors.forEach((c,i)=>document.querySelector('main').style.setProperty(`--block-${c}`,palettes[palette].hex[i]));
  preview.dataset.palette=palette;preview.dataset.stage=String(stage);
  $('#palettes').innerHTML=Object.entries(palettes).map(([id,p])=>`<button class="palette-choice" data-palette="${id}" aria-pressed="${id===palette}"><span class="palette-swatches" aria-hidden="true">${p.hex.map((hex,i)=>`<i style="background:${hex}" class="${i===3?'fourth':''}"></i>`).join('')}</span><strong>${p[lang]}</strong></button>`).join('');
  document.querySelectorAll('button[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.stage)===stage)));
  $('#palette-name').textContent=palettes[palette][lang];
  $('#trial-color-label').textContent=words[lang].trialColor;
}
$('#palettes').addEventListener('click',event=>{const b=event.target.closest('[data-palette]');if(!b)return;reset();palette=b.dataset.palette;renderPalettes();renderBoard();});
document.querySelectorAll('button[data-stage]').forEach(b=>b.addEventListener('click',()=>{reset();stage=Number(b.dataset.stage);if(!activeColors().includes(color))color=colors[0];renderPalettes();renderBoard();}));
$('#new-preview').addEventListener('click',()=>{reset();const options=Object.keys(palettes).filter(id=>id!==palette);palette=options[Math.floor(Math.random()*options.length)];stage=3;color=colors[0];renderPalettes();renderBoard();});
async function prepareAudio(){
  if(!enabled||!volume)return;
  const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)throw new Error('Audio unavailable');
  if(!context){context=new Ctx();gain=context.createGain();gain.gain.value=volume;gain.connect(context.destination);}
  await context.resume();
}
function loadSound(id){
  if(buffers.has(id))return Promise.resolve(buffers.get(id));
  if(!loads.has(id))loads.set(id,fetch(id==='sopa-win'?'./audio/feel-lab/sopa-win.wav':`./audio/${id}.wav`).then(r=>{if(!r.ok)throw new Error('Missing audio');return r.arrayBuffer();}).then(bytes=>context.decodeAudioData(bytes)).then(buffer=>{buffers.set(id,buffer);return buffer;}).catch(error=>{loads.delete(id);throw error;}));
  return loads.get(id);
}
function sound(id){
  if(id==='place'){const pitch=nextPitch();preview.dataset.lastPitch=String(pitch);id=PLACEMENT_VARIANTS[pitch];}
  if(!enabled||!volume||context?.state!=='running'||!buffers.has(id))return;
  const source=context.createBufferSource();source.buffer=buffers.get(id);source.connect(gain);source.onended=()=>{playing.delete(source);source.disconnect();};playing.add(source);source.start();
  preview.dataset.lastSound=id;
}
function stopSound(){for(const source of playing){try{source.stop();}catch{/* Already ended. */}}playing.clear();}
function wait(ms,signal){return new Promise(resolve=>{if(signal.aborted)return resolve(false);const abort=()=>{clearTimeout(timer);resolve(false);};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve(true);},ms);signal.addEventListener('abort',abort,{once:true});});}
function animate(run,element,keyframes,duration,delay=0,easing='ease-out'){if(run.signal.aborted)return;const animation=element.animate(keyframes,{duration,delay,easing,fill:'both'});run.animations.push(animation);return animation;}
function rect(el,relative){const r=el.getBoundingClientRect(),b=relative.getBoundingClientRect();return{x:r.left-b.left,y:r.top-b.top,w:r.width,h:r.height};}
function effect(cls,style){const el=document.createElement('i');el.className=cls;Object.assign(el.style,style);fx.append(el);return el;}
function reset(){
  $('#audition-status').textContent='';
  if(active){active.controller.abort();active.animations.forEach(a=>a.cancel());active=null;}
  stopSound();preview.removeAttribute('aria-busy');preview.removeAttribute('data-action');fx.replaceChildren();
  document.querySelectorAll('.actions button').forEach(b=>b.setAttribute('aria-pressed','false'));
  document.querySelectorAll('#grid .block,#tray .block').forEach(el=>{el.style.opacity='';});
  $('#status').textContent=words[lang].ready;
}
async function placement(run){
  $('#status').textContent=words[lang].placing;
  const from=run.tray.getBoundingClientRect(),to=run.target.getBoundingClientRect();
  const dx=from.left+from.width/2-to.left-to.width/2,dy=from.top+from.height/2-to.top-to.height/2;
  run.tray.style.opacity='0';run.target.style.opacity='1';
  animate(run,run.target,reduced.matches?[{opacity:0},{opacity:1}]:[{transform:`translate(${dx}px,${dy}px) scale(${from.width/to.width}) rotate(-7deg)`},{transform:'translate(0,0) scale(1) rotate(0deg)'}],reduced.matches?140:220,0,'cubic-bezier(.45,0,.75,.5)');
  if(!await wait(reduced.matches?140:220,run.signal))return false;sound('place');
  if(!reduced.matches){
    animate(run,run.target,[{transform:'scale(1.16,.79)'},{transform:'translateY(-7px) scale(.94,1.08)',offset:.3},{transform:'scale(1.06,.94)',offset:.6},{transform:'translateY(-2px) scale(.99,1.02)',offset:.8},{transform:'none'}],480);
    const r=rect(run.target,fx),halo=effect('halo',{left:`${r.x-4}px`,top:`${r.y-4}px`,width:`${r.w+8}px`,height:`${r.h+8}px`});
    animate(run,halo,[{opacity:.65,transform:'scale(.8)'},{opacity:0,transform:'scale(1.3)'}],410);
  }
  if(!await wait(reduced.matches?150:480,run.signal))return false;$('#status').textContent=words[lang].placed;return true;
}
async function clearLine(run){
  $('#status').textContent=words[lang].clearing;run.target.style.opacity='1';run.tray.style.opacity='0';
  const pieces=[...$('#grid').children].slice(10,15).map(cell=>cell.querySelector('.block'));
  if(!await wait(180,run.signal))return false;sound(lineId());
  if(reduced.matches){pieces.forEach(p=>animate(run,p,[{opacity:1},{opacity:0}],220));if(!await wait(240,run.signal))return false;}
  else{
    pieces.forEach((piece,i)=>{
      const delay=Math.abs(i-2)*90,offset=(i-2)*2;
      animate(run,piece,[{opacity:1,transform:'scale(1)'},{opacity:1,transform:'scale(1.1,.85)',offset:.2},{opacity:1,transform:`translate(${offset}px,-10px) scale(.92,1.07)`,offset:.46},{opacity:.9,transform:`translate(${offset}px,0) scale(1.05,.96)`,offset:.7},{opacity:0,transform:`translate(${offset}px,5px) scale(.15)`}],520,delay);
      const r=rect(piece,fx),spark=effect('spark',{left:`${r.x+r.w/2-3}px`,top:`${r.y+r.h/2-3}px`});
      animate(run,spark,[{opacity:0,transform:'scale(.5)'},{opacity:.8,transform:`translate(${offset*2}px,-22px)`,offset:.45},{opacity:0,transform:`translate(${offset*3}px,4px) scale(.2)`}],480,delay+230);
    });
    if(!await wait(760,run.signal))return false;
  }
  animate(run,$('#reward'),reduced.matches?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translate(-50%,10px) scale(.92)'},{opacity:1,transform:'translate(-50%,0) scale(1)'}],240);
  $('#status').textContent=words[lang].cleared;return true;
}
async function play(action){
  reset();$('#audio-status').textContent='';
  const controller=new AbortController(),run={controller,signal:controller.signal,animations:[],target:$('.target .block'),tray:$('#tray [aria-pressed="true"] .block')};active=run;
  preview.setAttribute('aria-busy','true');preview.dataset.action=action;$(`.actions [data-action="${action}"]`).setAttribute('aria-pressed','true');
  if(enabled&&volume){$('#status').textContent=words[lang].loading;try{await prepareAudio();if(run.signal.aborted)return;await Promise.all([...PLACEMENT_VARIANTS,lineId()].map(loadSound));}catch{if(!run.signal.aborted)$('#audio-status').textContent=words[lang].error;}}
  if(run.signal.aborted)return;if(reduced.matches)$('#audio-status').textContent=words[lang].reduced;
  if(action!=='line'&&!await placement(run))return;
  if(action==='sequence'&&!await wait(280,run.signal))return;
  if(action!=='place'&&!await clearLine(run))return;
  if(!await wait(1000,run.signal))return;if(active===run)reset();
}
$('#finishes').addEventListener('click',event=>{const button=event.target.closest('[data-choice]');if(!button)return;reset();finish=button.dataset.choice;selectFinish();});
$('#versions').addEventListener('click',event=>{const button=event.target.closest('[data-version]');if(!button||!['glass','gummy'].includes(finish))return;reset();selectedVersions[finish]=Number(button.dataset.version);selectFinish();});
$('#tray').addEventListener('click',event=>{const button=event.target.closest('[data-color]');if(!button)return;reset();color=button.dataset.color;renderBoard();});
$('.actions').addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(button)void play(button.dataset.action);});
document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>{reset();lang=button.dataset.lang;$('#audio-status').textContent='';render();}));
$('#sound').addEventListener('click',()=>{enabled=!enabled;if(!enabled)stopSound();updateSound();});
$('#volume').addEventListener('input',event=>{volume=Number(event.target.value)/100;if(gain)gain.gain.setValueAtTime(volume,context.currentTime);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){reset();void context?.suspend();}});
addEventListener('pagehide',()=>{reset();void context?.suspend();});reduced.addEventListener('change',reset);
async function audition(id){
  reset();lineSound=id;renderLineSounds();$('#audio-status').textContent='';
  if(!enabled||!volume){$('#audition-status').textContent=lang==='es'?'Activa el sonido y sube el volumen para escuchar.':'Turn sound on and raise the volume to listen.';return;}
  const controller=new AbortController(),run={controller,signal:controller.signal,animations:[]};active=run;
  $('#audition-status').textContent=words[lang].loading;
  try{await prepareAudio();if(run.signal.aborted)return;const buffer=await loadSound(lineId());if(run.signal.aborted)return;
    sound(lineId());$('#audition-status').textContent=`♪ ${lineOptions.find(o=>o.id===id)[lang]}`;
    if(await wait(buffer.duration*1000+40,run.signal)){if(active===run)active=null;$('#audition-status').textContent=lang==='es'?'Puedes repetir o probar otra opción.':'Replay or try another option.';}
  }catch{if(!run.signal.aborted)$('#audition-status').textContent=words[lang].error;}
}
$('#line-sound-list').addEventListener('click',event=>{
  const listen=event.target.closest('[data-listen]'),demo=event.target.closest('[data-line-demo]');
  if(listen)void audition(listen.dataset.listen);
  else if(demo){reset();lineSound=demo.dataset.lineDemo;renderLineSounds();$('#audition-status').textContent='';preview.scrollIntoView({block:'nearest'});void play('line');}
});
$('#stop-audition').addEventListener('click',()=>{reset();$('#audition-status').textContent=lang==='es'?'Detenido.':'Stopped.';});
render();
