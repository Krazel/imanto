import {LOOKS,savedLook,setLook} from './appearance.mjs';
const options=[
  {id:'warm',image:'01-gameplay.png',copy:'El acabado actual: crema, cacao y un relieve discreto.'},
  {id:'clean',image:'choice-02-clean.png',copy:'Más gráfico y sencillo, con bordes finos y fichas planas.'},
  {id:'soft',image:'choice-03-soft.png',copy:'Más suave y con volumen, paneles para los puntos y la tanda.'}
];
const section=document.querySelector('#style-options'),status=document.querySelector('#choice-status');
for(const [i,option] of options.entries()){
  const card=document.createElement('article');card.className='style-card';card.dataset.lookOption=option.id;
  const title=document.createElement('h2');title.textContent=LOOKS[option.id];
  const link=document.createElement('a');link.className='choice-image';link.href='/design-final/'+option.image;link.target='_blank';link.setAttribute('aria-label','Ampliar '+LOOKS[option.id]);
  const img=document.createElement('img');img.src=link.href;img.alt='Propuesta '+LOOKS[option.id]+' creada con ChatGPT Imágenes';link.append(img);
  const copy=document.createElement('p');copy.textContent=option.copy;
  const preview=document.createElement('a');preview.className='preview-link';preview.href='/?look='+option.id;preview.textContent='Probar sin elegir ↗';
  const button=document.createElement('button');button.className='choose-style';button.dataset.choose=option.id;button.textContent='Elegir opción '+(i+1);
  button.addEventListener('click',()=>{if(setLook(option.id))render();else status.textContent='No se pudo guardar. Puedes probar esta opción desde su enlace.';});
  button.style.marginBottom='14px';card.append(title,button,link,copy,preview);section.append(card);
}
function render(){
  const selected=savedLook();
  status.textContent=selected?'Has elegido '+LOOKS[selected]+'. Se aplicará a todas las pantallas al abrir el juego.':'Todavía no has elegido. Compara las tres y pulsa «Elegir opción».';
  for(const [i,button] of [...section.querySelectorAll('[data-choose]')].entries()){
    const chosen=button.dataset.choose===selected;button.setAttribute('aria-pressed',String(chosen));button.textContent=chosen?'Elegida ✓':'Elegir opción '+(i+1);button.closest('article').classList.toggle('selected',chosen);
  }
  document.querySelector('#clear-choice').hidden=!selected;
}
document.querySelector('#clear-choice').addEventListener('click',()=>{if(setLook(null))render();});
addEventListener('storage',render);render();
