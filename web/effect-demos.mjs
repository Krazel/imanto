import {createGame} from './engine.mjs';
import {t} from './i18n.mjs';
export const DEMOS=Object.freeze({
  single:{label:'Una línea',description:'Una fila coral: 50 puntos.'},
  double:{label:'Combo doble',description:'Fila y columna a la vez: 200 puntos.'},
  triple:{label:'Combo triple',description:'Tres líneas con una expulsión: 450 puntos.'},
  all:{label:'Tablero limpio',description:'Las dos últimas líneas: se retiran todas las fichas.'},
  streak:{label:'Racha ×3',description:'Una línea renueva la racha y gana 150 puntos.'},
  'streak-last':{label:'Última tanda',description:'Completa una línea en la última tanda disponible.'},
  expiry:{label:'Fin de racha',description:'Una jugada sin línea termina la segunda tanda y pierde la racha.'},
  dead:{label:'Sin salida',description:'Miel en fila 2, columna 2: ya no se puede puntuar, quedan 6 huecos.'},
  escape:{label:'Ver una solución',description:'Con un reparto posible, siete jugadas completan la segunda columna: +50 puntos.'}
});
export function effectScene(kind='double'){
  if(!Object.hasOwn(DEMOS,kind))kind='double';
  const state=createGame(()=>.2);state.board=Array(25).fill(null);
  const add=(at,color)=>{state.board[at]={id:state.nextId++,color};};
  let color='coral';
  if(kind==='dead'||kind==='escape'){
    // Exact board read from the user's visible game on 17 October. This copy
    // demonstrates both a legal rescue and a placement that makes scoring impossible.
    const layout=['teal','teal','honey','coral','teal','teal',null,'honey','teal','honey','honey','coral','violet','teal','coral',null,null,'honey',null,'violet','coral',null,'teal',null,null];
    layout.forEach((c,i)=>{if(c)add(i,c);});
    state.round=7;state.turns=18;state.score=200;
    state.tray=['teal','honey','violet'].map(color=>({id:state.nextId++,color}));
    state.nextTray=['teal','honey','violet'].map(color=>({id:state.nextId++,color}));
    const moves=kind==='escape'?[[23,'honey'],[6,'teal'],[18,'violet'],[11,'teal'],[22,'honey'],[23,'violet'],[16,'teal']].map(([at,color])=>({at,color})):null;
    return {state,at:kind==='escape'?23:6,option:1,kind,moves};
  }else if(kind==='single'||kind==='streak'||kind==='streak-last'){
    for(const i of[10,11,13,14])add(i,'coral');add(0,'teal');
    if(kind!=='single'){state.combo={count:2,lastRound:1};state.score=150;state.turns=kind==='streak-last'?4:2;state.round=kind==='streak-last'?2:1;}
  }else if(kind==='expiry'){
    add(0,'teal');state.combo={count:2,lastRound:1};state.round=2;state.turns=5;state.score=150;
    state.tray=[null,null,{id:state.nextId++,color:'honey'}];return {state,at:12,option:2,kind};
  }else if(kind==='triple'){
    for(const i of[0,1,3,4,20,21,23,24,9,19,7,13,17])add(i,'coral');
    color='teal';
  }else{
    for(const i of[10,11,13,14,2,7,17,22])add(i,'coral');
    if(kind==='double')add(0,'teal');
  }
  state.tray=[color,...['coral','teal','honey'].filter(c=>c!==color).slice(0,2)].map(color=>({id:state.nextId++,color}));
  return {state,at:12,option:0,kind};
}
export function createEffectsRoom({onPlay,onPrepare,onSpeed}){
  const element=document.createElement('aside');element.className='lab-panel effects-panel';
  element.setAttribute('aria-label','Pruebas de animación');
  element.innerHTML=`<p class="eyebrow">PRUEBAS INDEPENDIENTES</p><h2>Escenas</h2><p>Elige una escena o prepara una jugada para probarla tú.</p>
  <fieldset><legend>Animaciones</legend>
  <button class="primary" id="effect-repeat" type="button">Repetir animación</button><button class="secondary" id="effect-prepare" type="button">Preparar para jugar yo</button>
  <label for="effect-speed">Velocidad</label><select id="effect-speed"><option value="1">Normal</option><option value="2.5">Cámara lenta</option></select>
  <div class="effect-demo-buttons">
  ${Object.entries(DEMOS).map(([id,d])=>`<button type="button" data-demo="${id}"><strong>${d.label}</strong><small>${d.description}</small></button>`).join('')}
  </div></fieldset>
  <p id="effect-copy" role="status"></p><a class="text-button" href="/">Volver a mi partida</a>`;
  for(const button of element.querySelectorAll('[data-demo]'))button.addEventListener('click',()=>onPlay(button.dataset.demo));
  element.querySelector('#effect-repeat').addEventListener('click',()=>onPlay());
  element.querySelector('#effect-prepare').addEventListener('click',onPrepare);
  element.querySelector('#effect-speed').addEventListener('change',e=>onSpeed(Number(e.target.value)));
  return {element,setBusy:value=>{element.querySelector('fieldset').disabled=value;},
    setKind:kind=>{element.querySelector('#effect-copy').textContent=t(DEMOS[kind].description)+' '+t(kind==='escape'?'La tanda futura de esta copia incluye turquesa.':kind==='dead'?'Copia independiente de tu tablero.':'Casilla central para la jugada.');}};
}
