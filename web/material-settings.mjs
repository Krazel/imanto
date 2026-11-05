import {MATERIALS,LEGACY_MATERIALS,MATERIAL_NAMES,applyBlockPalette} from './block-appearance.mjs';
import {language} from './i18n.mjs';
export const MATERIAL_KEY='imanto-material-selection-v1';
const SELECTION_VERSION_KEY='imanto-material-selection-version';
export function normalizeMaterialSelection(value){
  const valid=MATERIALS.filter(id=>Array.isArray(value)&&value.includes(id));
  return valid.length?valid:[...MATERIALS];
}
export function readMaterialSelection(storage){
 try{
  let selected=normalizeMaterialSelection(JSON.parse(storage.getItem(MATERIAL_KEY)));
  if(storage.getItem(SELECTION_VERSION_KEY)!=='2'){
   if(selected.length===LEGACY_MATERIALS.length&&LEGACY_MATERIALS.every(id=>selected.includes(id)))selected=[...MATERIALS];
   try{storage.setItem(MATERIAL_KEY,JSON.stringify(selected));storage.setItem(SELECTION_VERSION_KEY,'2');}catch{}
  }
  return selected;
 }catch{return [...MATERIALS];}
}
export function installMaterialSettings(){
  const es=language==='es',root=document.querySelector('#material-settings');
  const names=MATERIALS.map(id=>MATERIAL_NAMES[id][es?0:1]);
  let selected=readMaterialSelection(localStorage);
  root.dataset.layout='1';
  const colors=[['coral','#f46b50'],['honey','#edb137'],['teal','#278a91'],['violet','#927fb6']];
  const chevron='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="m6 9 6 6 6-6"/></svg>';
  const check='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="m5 12 4.5 4.5L19 7"/></svg>';
  root.innerHTML=`<details class="material-disclosure"><summary><span>${es?'Estilo de bloques':'Block style'}</span><span class="material-chevron" aria-hidden="true">${chevron}</span></summary><div class="material-content"><div class="material-intro"><p>${es?'Elige uno fijo o varios al azar.':'Choose one fixed style or several at random.'}</p><div class="material-bulk-actions"><button type="button" class="material-all">${es?'Seleccionar todos':'Select all'}</button><button type="button" class="material-clear" aria-label="${es?'Deseleccionar todos excepto el clásico original':'Deselect all except Original classic'}">${es?'Deseleccionar todos':'Deselect all'}</button></div></div><div class="material-options">${MATERIALS.map((id,i)=>`<label class="material-option"><span class="material-control"><input type="checkbox" value="${id}" ${selected.includes(id)?'checked':''}><span class="material-check" aria-hidden="true">${check}</span></span><span class="material-preview" data-block-material="${id}" aria-hidden="true">${colors.map(([color,hex])=>`<span class="material-swatch ${color}" data-material="${id}" style="--paint:${hex};--block-${color}:${hex}"></span>`).join('')}</span><span class="material-name">${names[i]}</span></label>`).join('')}</div><p class="material-status" role="status"></p></div></details>`;
  root.querySelectorAll('.material-preview').forEach(preview=>applyBlockPalette('original',preview));
  const save=()=>{try{localStorage.setItem(MATERIAL_KEY,JSON.stringify(selected));}catch{}status();};
  function status(message){root.querySelector('.material-status').textContent=message||(es?(selected.length===1?'Estilo fijo · se aplica en la próxima partida.':`${selected.length} estilos al azar · próxima partida.`):(selected.length===1?'Fixed style · applies next game.':`${selected.length} random styles · next game.`));}
  root.addEventListener('change',e=>{if(!e.target.matches('input'))return;const next=[...root.querySelectorAll('input:checked')].map(i=>i.value);if(!next.length){e.target.checked=true;status(es?'Mantén al menos un estilo seleccionado.':'Keep at least one style selected.');return;}selected=next;save();});
  root.querySelector('.material-all').onclick=()=>{selected=[...MATERIALS];root.querySelectorAll('input').forEach(i=>i.checked=true);save();};
  root.querySelector('.material-clear').onclick=()=>{selected=['classic'];root.querySelectorAll('input').forEach(i=>i.checked=i.value==='classic');save();status(es?'Solo queda Clásico original.':'Only Original classic remains selected.');};status();
}
