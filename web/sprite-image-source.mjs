import {SPRITE_ATLASES} from './sprite-atlases.mjs';
// Native packaging embeds the PNGs in this module's data. Large data URLs can
// exceed CSS custom-property limits, so expose short, cached local Blob URLs.
const nativeImages=new Map();
export function spriteImageCSS(palette){
 const source=SPRITE_ATLASES[palette].file;
 if(!source.startsWith('data:image/png;base64,'))return `url("${source}")`;
 if(!nativeImages.has(palette)){
  const binary=atob(source.slice(source.indexOf(',')+1)),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  nativeImages.set(palette,URL.createObjectURL(new Blob([bytes],{type:'image/png'})));
 }
 return `url("${nativeImages.get(palette)}")`;
}
