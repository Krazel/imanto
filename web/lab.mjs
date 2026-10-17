import {LAB_PHYSICS,normalizePhysics,contactPairs} from './physics.mjs';
import {t} from './i18n.mjs';
const KEY='krazel-imanes-lab-settings-v2';
export function createLaboratory({onChange,onScene,onEdit,onApply}){
  let saved;try{saved=JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('krazel-imanes-lab-settings-v1'));}catch{}
  let settings=normalizePhysics(saved||LAB_PHYSICS);
  const element=document.createElement('aside');element.className='lab-panel';
  element.setAttribute('aria-label','Laboratorio de imanes');
  element.innerHTML=`<p class="eyebrow">UNA EXPULSIÓN · PARTIDA SEPARADA</p><h2>Laboratorio de imanes</h2>
  <p>Solo la ficha que colocas expulsa. Las afectadas se mueven a la vez, sin provocar otros empujes.</p>
  <fieldset><legend>Movimiento</legend>
  <label class="check-label"><input id="lab-sideways" type="checkbox"> Desviar a un lado si el avance está bloqueado</label>
  <label class="check-label"><input id="lab-transmit" type="checkbox"> Transmitir el empuje hasta el final de una fila</label>
  <small>Cada desplazamiento es de una casilla. Prueba las dos reglas por separado con los interruptores.</small>
  <label for="lab-turn">Si ambos lados están libres</label><select id="lab-turn"><option value="right">Girar primero a la derecha</option><option value="left">Girar primero a la izquierda</option></select>
  <label for="lab-speed">Duración de cada movimiento <output id="lab-speed-value"></output></label><input id="lab-speed" type="range" min="40" max="400" step="20">
  <div class="scene-buttons"><button type="button" data-scene="row">Empuje en fila</button><button type="button" data-scene="pulse">Sin reacción en cadena</button><button type="button" data-scene="four">Cuatro a la vez</button><button type="button" data-scene="wall">Pared arriba</button><button type="button" data-scene="diagonal">En diagonal</button></div>
  <button type="button" class="primary" id="lab-apply">Simular / repetir escena</button></fieldset>
  <fieldset><legend>Editar el tablero</legend>
  <label>Color<select id="lab-color"><option value="coral">Coral</option><option value="teal">Turquesa</option><option value="honey">Miel</option><option value="violet">Violeta</option><option value="empty">Borrar</option></select></label>
  <button type="button" class="secondary" id="lab-edit">Editar casillas</button>
  <small>Pinta o borra casillas. El último imán que pintes hará la expulsión al pulsar Simular.</small></fieldset>
  <p id="lab-stats" class="lab-stats" role="status"></p>`;
  const $=s=>element.querySelector(s);
  function render(){
    $('#lab-sideways').checked=settings.sideways;$('#lab-transmit').checked=settings.transmit;$('#lab-turn').value=settings.turn;
    $('#lab-speed').value=settings.speed;$('#lab-speed-value').value=`${settings.speed} ms`;
  }
  function change(){
    settings=normalizePhysics({sideways:$('#lab-sideways').checked,transmit:$('#lab-transmit').checked,turn:$('#lab-turn').value,speed:$('#lab-speed').value});
    try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{}
    render();onChange(settings);
  }
  for(const input of element.querySelectorAll('fieldset:first-of-type input,fieldset:first-of-type select'))input.addEventListener('input',change);
  for(const button of element.querySelectorAll('[data-scene]'))button.addEventListener('click',()=>onScene(button.dataset.scene));
  $('#lab-edit').addEventListener('click',onEdit);$('#lab-apply').addEventListener('click',onApply);render();
  return {element,getSettings:()=>({...settings}),getBrush:()=>({color:$('#lab-color').value}),
    setEditing:editing=>{$('#lab-edit').textContent=t(editing?'Cancelar edición':'Editar casillas');},
    setBusy:busy=>{for(const f of element.querySelectorAll('fieldset'))f.disabled=busy;},
    showStats:(board,moves=0,pending=false)=>{
      const contacts=contactPairs(board).length;
      $('#lab-stats').textContent=t('{result}: {moves} {movement} · {contacts} {contact}',{result:t(pending?'Escena preparada':'Resultado'),moves,movement:t(moves===1?'desplazamiento':'desplazamientos'),contacts,contact:t(contacts===1?'contacto lateral':'contactos laterales')});
    }};
}
export function laboratoryScene(name,state){
  const next=structuredClone(state);next.board=Array(25).fill(null);next.score=0;next.over=false;next.endReason=null;
  // The last entry is the source of the impulse, not a fixed anchor.
  const layouts={row:[[11,'teal'],[12,'honey'],[10,'coral']],
    pulse:[[11,'teal'],[12,'honey'],[8,'violet'],[10,'coral']],
    four:[[7,'teal'],[13,'honey'],[17,'violet'],[11,'honey'],[12,'coral']],
    wall:[[2,'teal'],[7,'coral']],diagonal:[[6,'teal'],[12,'coral']]};
  for(const[at,color]of layouts[name]||layouts.row)next.board[at]={id:next.nextId++,color};
  return {state:next,triggerId:next.nextId-1};
}
