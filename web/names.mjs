export const NAME_OPTIONS=[
  {id:'imanto',name:'Imanto',kind:'Corto · imán',copy:'Recuerda al imán, con un sonido más propio.'},
  {id:'repulo',name:'Repulo',kind:'Corto · movimiento',copy:'De repeler: pone el movimiento en el centro.'},
  {id:'empika',name:'Empika',kind:'Inventado · juguetón',copy:'Ligero y fácil de decir, desde la idea de empujar.'},
  {id:'impulso',name:'Impulso',kind:'Directo · acción',copy:'La acción que provoca cada ficha.'},
  {id:'cinco',name:'Cinco',kind:'Muy corto · objetivo',copy:'El objetivo del juego en una sola palabra.'},
  {id:'alinea',name:'Alinea',kind:'Directo · líneas',copy:'Una invitación a completar líneas de color.'}
];
export function applyNamePreview({replaceHeading=false}={}){
  const id=new URLSearchParams(location.search).get('name'),option=NAME_OPTIONS.find(o=>o.id===id);
  if(!option)return;
  if(replaceHeading)document.querySelector('.heading h1').textContent=option.name.toUpperCase();
  document.title=document.title.replace(/^Imanes/,option.name);
  document.querySelector('.game').setAttribute('aria-label',option.name);
  for(const label of document.querySelectorAll('.eyebrow'))if(label.textContent.trim()==='IMANES')label.textContent=option.name.toUpperCase();
  document.querySelector('#name-preview').hidden=false;
}
