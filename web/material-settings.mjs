import {MATERIALS} from './block-appearance.mjs';
import {language} from './i18n.mjs';
export const MATERIAL_KEY='imanto-material-selection-v1';
export function normalizeMaterialSelection(value){
  const valid=MATERIALS.filter(id=>Array.isArray(value)&&value.includes(id));
  return valid.length?valid:[...MATERIALS];
}
export function readMaterialSelection(storage){try{return normalizeMaterialSelection(JSON.parse(storage.getItem(MATERIAL_KEY)));}catch{return [...MATERIALS];}}
export function installMaterialSettings(){
  const es=language==='es',root=document.querySelector('#material-settings');
  const names=es?['Clásico original','Gelatina limpia','Madera pintada','Cerámica craquelada']:['Original classic','Clean jelly','Painted wood','Crackle ceramic'];
  let selected=readMaterialSelection(localStorage);
  root.dataset.layout='1';
  const colors=['#f46b50','#edb137','#278a91','#927fb6'];
  root.innerHTML=`<details class="material-disclosure" open><summary><span>${es?'Estilo de bloques':'Block style'}</span><span class="material-chevron" aria-hidden="true">⌄</span></summary><div class="material-content"><div class="material-intro"><p>${es?'Elige uno fijo o varios al azar.':'Choose one fixed style or several at random.'}</p><button type="button" class="material-all">${es?'Seleccionar todos':'Select all'}</button></div><div class="material-options">${MATERIALS.map((id,i)=>`<label class="material-option"><input type="checkbox" value="${id}" ${selected.includes(id)?'checked':''}><span class="material-preview" aria-hidden="true">${colors.map(color=>`<span class="material-swatch" data-material="${id}" style="--paint:${color}"></span>`).join('')}</span><span class="material-name">${names[i]}</span></label>`).join('')}</div><p class="material-status" role="status"></p></div></details>`;
  const save=()=>{try{localStorage.setItem(MATERIAL_KEY,JSON.stringify(selected));}catch{}status();};
  function status(message){root.querySelector('.material-status').textContent=message||(es?(selected.length===1?'Estilo fijo · se aplica en la próxima partida.':`${selected.length} estilos al azar · próxima partida.`):(selected.length===1?'Fixed style · applies next game.':`${selected.length} random styles · next game.`));}
  root.addEventListener('change',e=>{if(!e.target.matches('input'))return;const next=[...root.querySelectorAll('input:checked')].map(i=>i.value);if(!next.length){e.target.checked=true;status(es?'Mantén al menos un estilo seleccionado.':'Keep at least one style selected.');return;}selected=next;save();});
  root.querySelector('.material-all').onclick=()=>{selected=[...MATERIALS];root.querySelectorAll('input').forEach(i=>i.checked=true);save();};status();
}
