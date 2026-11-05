import {SPRITE_ATLASES} from './sprite-atlases.mjs';
import {spriteImageCSS} from './sprite-image-source.mjs';
// Cosmetic state belongs to one game. Colour identities and puzzle rules never change.
export const LEGACY_MATERIALS=['classic','jelly','wood','ceramic'];
export const MATERIALS=[...LEGACY_MATERIALS,'paper-origami','neon','special-glass','special-liquid','special-sand','special-circuit'];
export const MATERIAL_NAMES={classic:['Clásico original','Original classic'],jelly:['Gelatina limpia','Clean jelly'],wood:['Madera pintada','Painted wood'],ceramic:['Cerámica craquelada','Crackle ceramic'],'paper-origami':['Origami','Origami'],neon:['Neón','Neon'],'special-glass':['Vidrio dicroico','Dichroic glass'],'special-liquid':['Líquido en cápsula','Liquid capsule'],'special-sand':['Arena cinética','Kinetic sand'],'special-circuit':['Circuito de luz','Light circuit']};
export const PALETTES={
 original:{hex:['#f46b50','#278a91','#edb137','#927fb6'],es:['Coral','Turquesa','Miel','Violeta'],en:['Coral','Teal','Honey','Violet']},
 arcade:{hex:['#3556e5','#e9338b','#a2cf27','#f28a25'],es:['Azul eléctrico','Fucsia','Lima','Mandarina'],en:['Electric blue','Hot pink','Lime','Tangerine']},
 lagoon:{hex:['#23476c','#39c2b3','#f29b7e','#b28bd9'],es:['Azul marino','Aguamarina','Melocotón','Lavanda'],en:['Navy','Aquamarine','Peach','Lavender']},
 garden:{hex:['#743c79','#7a9e34','#e5a82b','#58addc'],es:['Ciruela','Oliva','Azafrán','Celeste'],en:['Plum','Olive','Saffron','Sky blue']},
 ink:{hex:['#414650','#f4e8ce','#d33650','#366bd3'],es:['Grafito','Marfil','Carmesí','Azul cobalto'],en:['Graphite','Ivory','Crimson','Cobalt blue']}
};
const COLORS=['coral','teal','honey','violet'];
export function applyBlockPalette(palette,root=document.documentElement){
 const key=Object.hasOwn(PALETTES,palette)?palette:'original';root.dataset.blockPalette=key;
 COLORS.forEach((c,i)=>root.style.setProperty(`--block-${c}`,PALETTES[key].hex[i]));
 const atlas=SPRITE_ATLASES[key];root.style.setProperty('--block-sprite-atlas',spriteImageCSS(key));
 for(const [color,rect]of Object.entries(atlas.columns)){
  root.style.setProperty(`--atlas-${color}-width`,`${atlas.width/rect.width*100}%`);
  root.style.setProperty(`--atlas-${color}-x`,`${rect.x/(atlas.width-rect.width)*100}%`);
 }
 for(const [material,rect]of Object.entries(atlas.rows)){
  root.style.setProperty(`--atlas-${material}-height`,`${atlas.height/rect.height*100}%`);
  root.style.setProperty(`--atlas-${material}-y`,`${rect.y/(atlas.height-rect.height)*100}%`);
 }
 return key;
}
export function readBlockAppearance(value){
 return {material:MATERIALS.includes(value?.material)?value.material:'jelly',palette:Object.hasOwn(PALETTES,value?.palette)?value.palette:'original'};
}
export function nextBlockAppearance(previous,random=Math.random,selected=MATERIALS){
 const old=readBlockAppearance(previous);
 const pick=items=>items[Math.min(items.length-1,Math.max(0,Math.floor(random()*items.length)))];
 return {material:pick(selected.length===1?selected:selected.filter(x=>x!==old.material)),palette:pick(Object.keys(PALETTES).filter(x=>x!==old.palette))};
}
export function applyBlockAppearance(state,root=document.documentElement){
 const value=readBlockAppearance(state.blockAppearance);state.blockAppearance=value;
 root.dataset.blockMaterial=value.material;applyBlockPalette(value.palette,root);
 return value;
}
export function blockColorName(color,appearance,language='en'){
 const i=COLORS.indexOf(color);if(i<0)return color;
 return PALETTES[readBlockAppearance(appearance).palette][language==='es'?'es':'en'][i];
}
