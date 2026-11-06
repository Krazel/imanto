import {MATERIAL_FAMILIES,EXTRA_PROPOSALS,SPECIAL_PROPOSALS,proposalCatalog} from './material-proposals.mjs';
import {MATERIALS,PALETTES,applyBlockPalette} from './block-appearance.mjs';
const es=new URLSearchParams(location.search).get('lang')!=='en';
const copy=es?{lab:'PRUEBAS DE MATERIALES',title:'Una tanda bien distinta.',intro:'Seis superficies nuevas. La misma forma y los mismos colores para comparar.',reference:'Comparar con los actuales',preview:'PRUEBA EN EL TABLERO',single:'Completar una línea',double:'Combo de dos',all:'Limpiar tablero',repeat:'Repetir animación',prepare:'Preparar tablero',picker:'Cambiar material',notice:'Solo pruebas: no cambia tu partida ni los estilos que tienes elegidos.',proposal:'Propuesta nueva',approved:'Referencia actual',ready:'Toca repetir o completa la fila en el tablero.',playing:'Reproduciendo…',done:'Listo para repetir.',settings:'← Ajustes corregidos'}:{lab:'MATERIAL TRIALS',title:'A very different set.',intro:'Six new surfaces. The same shape and colors, so you can compare.',reference:'Compare with current styles',preview:'TRY ON THE BOARD',single:'Complete a line',double:'Double combo',all:'Clear the board',repeat:'Replay animation',prepare:'Prepare board',picker:'Change material',notice:'Preview only: your game and selected styles remain unchanged.',proposal:'New proposal',approved:'Current reference',ready:'Replay or complete the row on the board.',playing:'Playing…',done:'Ready to replay.',settings:'← Corrected Settings'};
copy.intro=es?'Vidrio, líquido, arena y circuito de luz. Los diseños de las imágenes, ahora con las animaciones del juego.':'Glass, liquid, sand and light circuit. The image designs, now with the game’s animations.';
document.documentElement.lang=es?'es':'en';document.title=es?'Imanto · Nuevos bloques':'Imanto · New block styles';document.querySelectorAll('[data-copy]').forEach(e=>e.textContent=copy[e.dataset.copy]);
document.querySelector('#all-colors-link').textContent=es?'Ver todos los estilos y colores →':'See every style and color →';document.querySelector('#all-colors-link').href=`color-gallery.html?lang=${es?'es':'en'}`;
document.querySelector('#special-heading').textContent=es?'De la imagen al tablero':'From image to board';document.querySelector('#chosen-heading').textContent=es?'Tus elegidos anteriores':'Your earlier picks';document.querySelector('#previous-label').textContent=es?'Ver las pruebas anteriores':'See earlier trials';
document.querySelector('#settings-link').textContent=copy.settings;document.querySelector('#settings-link').href=`settings-review.html?lang=${es?'es':'en'}`;
const proposals=proposalCatalog(es?'es':'en');
const approved=[['jelly',es?'Gelatina':'Jelly',''],['wood',es?'Madera':'Wood',''],['ceramic',es?'Cerámica':'Ceramic',''],['classic',es?'Clásico':'Classic','']];
let selected=new URLSearchParams(location.search).get('material')||'special-glass';if(![...proposals,...approved].some(x=>x[0]===selected))selected='special-glass';let scene='single',doc=null,observer=null;
let palette=new URLSearchParams(location.search).get('palette')||'original';if(!Object.hasOwn(PALETTES,palette))palette='original';
const frame=document.querySelector('iframe'),status=document.querySelector('#review-status'),buttons=[...document.querySelectorAll('.scene-buttons button,#replay,#prepare,#material-picker,#palette-picker')];
const palettePicker=document.querySelector('#palette-picker');const paletteLabels=es?['Original','Arcade','Laguna','Jardín','Tinta']:['Original','Arcade','Lagoon','Garden','Ink'];document.querySelector('#palette-label').textContent=es?'Paleta de colores':'Color palette';Object.keys(PALETTES).forEach((id,i)=>{const o=document.createElement('option');o.value=id;o.textContent=paletteLabels[i];palettePicker.append(o);});
function syncPalette(){applyBlockPalette(palette,document.documentElement);if(doc)applyBlockPalette(palette,doc.documentElement);palettePicker.value=palette;const u=new URL(location.href);u.searchParams.set('palette',palette);history.replaceState(null,'',u);}
palettePicker.onchange=()=>{palette=palettePicker.value;syncPalette();};syncPalette();
function card([id,name,description]){const b=document.createElement('button');b.type='button';b.className='material-card';b.dataset.blockMaterial=id;b.dataset.material=id;b.innerHTML=`<h3>${name}</h3><span class="sample-row" aria-hidden="true">${['coral','honey','teal','violet'].map(c=>`<span class="sample tile ${c}"></span>`).join('')}</span><p>${description}</p>`;b.onclick=()=>choose(id);return b;}
document.querySelector('#special-materials').append(...SPECIAL_PROPOSALS.map(([id])=>card(proposals.find(p=>p[0]===id))));
document.querySelector('#chosen-materials').append(...['paper-origami','neon'].map(id=>card(proposals.find(p=>p[0]===id))));
for(const family of MATERIAL_FAMILIES){const section=document.createElement('section');section.className='material-family';section.dataset.family=family.id;const heading=document.createElement('h2');heading.textContent=family.names[es?0:1];const grid=document.createElement('div');grid.className='family-options';grid.append(...family.variants.map(([id])=>card(proposals.find(p=>p[0]===id))));section.append(heading,grid);document.querySelector('#new-materials').append(section);}
document.querySelector('#extra-materials').append(...EXTRA_PROPOSALS.map(([id])=>card(proposals.find(p=>p[0]===id))));
document.querySelector('#approved-materials').append(...approved.map(card));
const picker=document.querySelector('#material-picker');
const groups=[[es?'Nuevas pruebas especiales':'New special trials',proposals.filter(p=>SPECIAL_PROPOSALS.some(e=>e[0]===p[0]))],...MATERIAL_FAMILIES.map(f=>[f.names[es?0:1],f.variants.map(([id])=>proposals.find(p=>p[0]===id))]),[es?'Otras propuestas':'Other proposals',proposals.filter(p=>EXTRA_PROPOSALS.some(e=>e[0]===p[0]))],[es?'Estilos actuales':'Current styles',approved]];
for(const [name,list]of groups){const group=document.createElement('optgroup');group.label=name;for(const[id,label]of list){const option=document.createElement('option');option.value=id;option.textContent=label;group.append(option);}picker.append(group);}picker.onchange=()=>choose(picker.value);
function choose(id){selected=id;picker.value=id;const material=[...proposals,...approved].find(x=>x[0]===id);document.querySelector('#preview-name').textContent=material[1];document.querySelector('#preview-description').textContent=material[2]||(es?'El material actual, con la corrección de animación.':'The current material with the animation fix.');document.querySelector('#preview-tag').textContent=MATERIALS.includes(id)?(es?'En el juego':'In the game'):copy.proposal;document.querySelectorAll('[data-material]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.material===id)));if(doc){doc.documentElement.dataset.blockMaterial=id;prepare();}const u=new URL(location.href);u.searchParams.set('material',id);history.replaceState(null,'',u);}
function refreshBusy(){if(!doc)return;const busy=doc.querySelector('#board')?.getAttribute('aria-busy')==='true';buttons.forEach(b=>b.disabled=busy);document.querySelectorAll('.material-card').forEach(b=>b.disabled=busy);status.textContent=busy?copy.playing:copy.done;}
function prepare(){if(!doc||doc.querySelector('#board').getAttribute('aria-busy')==='true')return;doc.querySelector(`#effect-prepare`).click();status.textContent=copy.ready;}
function play(){if(!doc)return;const music=doc.querySelector('#background-music');if(music)music.muted=true;doc.dispatchEvent(new frame.contentWindow.Event('pointerdown',{bubbles:true}));doc.querySelector(`[data-demo="${scene}"]`).click();}
frame.addEventListener('load',()=>{doc=frame.contentDocument;if(!doc?.querySelector('#board'))return;const link=doc.createElement('link');link.rel='stylesheet';link.href='block-experiments.css';doc.head.append(link);const style=doc.createElement('style');style.textContent='html,body,body.is-capture{width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:0!important;background:#fff7eb!important;overflow:hidden!important}.game,.is-capture .game{width:100%!important;max-width:none!important;padding:8px!important;margin:0!important}.game>:not(.board),.lab-panel{display:none!important}.board,.is-capture .board{width:100%!important;max-width:none!important;margin:0!important}';doc.head.append(style);doc.documentElement.dataset.blockMaterial=selected;applyBlockPalette(palette,doc.documentElement);observer?.disconnect();observer=new frame.contentWindow.MutationObserver(()=>{if(doc.documentElement.dataset.blockMaterial!==selected)doc.documentElement.dataset.blockMaterial=selected;if(doc.documentElement.dataset.blockPalette!==palette)applyBlockPalette(palette,doc.documentElement);refreshBusy();});observer.observe(doc.documentElement,{attributes:true,attributeFilter:['data-block-material','data-block-palette']});observer.observe(doc.querySelector('#board'),{attributes:true,attributeFilter:['aria-busy']});buttons.forEach(b=>b.disabled=false);status.textContent=copy.ready;});
document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>{scene=b.dataset.scene;document.querySelectorAll('[data-scene]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));play();});document.querySelector('[data-scene=single]').setAttribute('aria-pressed','true');document.querySelector('#replay').onclick=play;document.querySelector('#prepare').onclick=prepare;
if(new URLSearchParams(location.search).get('fit')==='1'){
  const sizeReview=document.querySelector('#size-review');
  const sizePicker=document.querySelector('#size-picker');
  const cornerPicker=document.querySelector('#corner-picker');
  const sizeOutline=document.querySelector('#size-outline');
  sizeReview.hidden=false;
  document.querySelector('#size-label').textContent=es?'Tamaño del bloque':'Block size';
  document.querySelector('#corner-label').textContent=es?'Esquinas de la casilla':'Cell corners';
  if(!es){
    const cornerNames=['Original','Matched rounding','Matched rounding and subtle base'];
    Array.from(cornerPicker.options).forEach((option,i)=>option.textContent=cornerNames[i]);
  }
  document.querySelector('#size-outline-label').textContent=es?'Mostrar el contorno de la casilla':'Show cell outline';
  const syncSize=()=>{
    if(!doc)return;
    const root=doc.documentElement;
    root.style.setProperty('--board-sprite-scale',sizePicker.value);
    root.dataset.reviewCorners=cornerPicker.value;
    root.toggleAttribute('data-size-review-outline',sizeOutline.checked);
  };
  sizePicker.addEventListener('change',syncSize);
  cornerPicker.addEventListener('change',syncSize);
  sizeOutline.addEventListener('change',syncSize);
  frame.addEventListener('load',()=>{
    if(!doc)return;
    const style=doc.createElement('style');
    style.textContent=`
      [data-review-corners=original]{--occupied-slot-radius:10px}
      [data-block-material^=special-][data-review-corners=soft] .cell:not(.empty){
        background:color-mix(in srgb,var(--slot) 40%,var(--sand));box-shadow:none;
      }
      [data-size-review-outline] .pieces .tile::after{
        content:"";position:absolute;inset:0;border:1px dashed #432611;
        border-radius:var(--occupied-slot-radius,var(--material-slot-radius,max(10px,22%)));
        box-shadow:none;background:none;pointer-events:none;
      }
      [data-block-material]:not([data-block-material^=special-])[data-size-review-outline] .pieces .tile::after{border-radius:inherit}
    `;
    doc.head.append(style);
    syncSize();
    if(location.hash==='#size-review')sizeReview.scrollIntoView({block:'start'});
  });
}
choose(selected);buttons.forEach(b=>b.disabled=true);frame.src=`./?effects=single&capture=1&presentation=1&lang=${es?'es':'en'}`;
