// Cosmetic state belongs to one game. Colour identities and puzzle rules never change.
export const MATERIALS=['jelly','wood','ceramic'];
export const PALETTES={
 original:{hex:['#f46b50','#278a91','#edb137','#927fb6'],es:['Coral','Turquesa','Miel','Violeta'],en:['Coral','Teal','Honey','Violet']},
 arcade:{hex:['#3556e5','#e9338b','#a2cf27','#f28a25'],es:['Azul eléctrico','Fucsia','Lima','Mandarina'],en:['Electric blue','Hot pink','Lime','Tangerine']},
 lagoon:{hex:['#23476c','#39c2b3','#f29b7e','#b28bd9'],es:['Azul marino','Aguamarina','Melocotón','Lavanda'],en:['Navy','Aquamarine','Peach','Lavender']},
 garden:{hex:['#743c79','#7a9e34','#e5a82b','#58addc'],es:['Ciruela','Oliva','Azafrán','Celeste'],en:['Plum','Olive','Saffron','Sky blue']},
 ink:{hex:['#414650','#f4e8ce','#d33650','#366bd3'],es:['Grafito','Marfil','Carmesí','Azul cobalto'],en:['Graphite','Ivory','Crimson','Cobalt blue']}
};
const COLORS=['coral','teal','honey','violet'];
export function readBlockAppearance(value){
 return {material:MATERIALS.includes(value?.material)?value.material:'jelly',palette:Object.hasOwn(PALETTES,value?.palette)?value.palette:'original'};
}
export function nextBlockAppearance(previous,random=Math.random){
 const old=readBlockAppearance(previous);
 const pick=items=>items[Math.min(items.length-1,Math.max(0,Math.floor(random()*items.length)))];
 return {material:pick(MATERIALS.filter(x=>x!==old.material)),palette:pick(Object.keys(PALETTES).filter(x=>x!==old.palette))};
}
export function applyBlockAppearance(state,root=document.documentElement){
 const value=readBlockAppearance(state.blockAppearance);state.blockAppearance=value;
 root.dataset.blockMaterial=value.material;root.dataset.blockPalette=value.palette;
 COLORS.forEach((c,i)=>root.style.setProperty(`--block-${c}`,PALETTES[value.palette].hex[i]));
 return value;
}
export function blockColorName(color,appearance,language='en'){
 const i=COLORS.indexOf(color);if(i<0)return color;
 return PALETTES[readBlockAppearance(appearance).palette][language==='es'?'es':'en'][i];
}
