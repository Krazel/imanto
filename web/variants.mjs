import {createGame,restoreGame} from './engine.mjs';
export const VARIANTS=Object.freeze({
  'no-turn':Object.freeze({name:'1 · Sin desvíos',short:'Sin desvíos',sideways:false,transmit:true,
    rule:'Si no puede avanzar recto, se queda. El empuje sí puede llegar al último de una fila.'}),
  'no-row':Object.freeze({name:'2 · Sin empuje en fila',short:'Sin empuje en fila',sideways:true,transmit:false,
    rule:'Solo se mueve el vecino inmediato. Si está bloqueado, puede desviarse a un lado.'}),
  'simple':Object.freeze({name:'3 · Solo directo',short:'Solo directo',sideways:false,transmit:false,
    rule:'Solo se mueve el vecino inmediato si tiene libre la casilla de detrás. Sin giros ni empuje en fila.'})
});
const BASE='krazel-imanes-comparison-v1-base';
export function variantSaveKey(id){
  if(!Object.hasOwn(VARIANTS,id))throw Error('Variante desconocida');
  return `krazel-imanes-comparison-v1-${id}`;
}
export function loadComparison(id,storage,random=Math.random,{restart=false}={}){
  const key=variantSaveKey(id);
  const read=k=>{try{return restoreGame(JSON.parse(storage.getItem(k)));}catch{return null;}};
  const saved=read(key);if(saved&&!restart)return saved;
  let baseline=read(BASE);
  if(!baseline){
    baseline=createGame(random);
    try{storage.setItem(BASE,JSON.stringify(baseline));}catch{}
  }
  // Each version gets its own copy of one fresh, common board, hand and forecast.
  // The main game and laboratory storage are never read or overwritten here.
  const state=structuredClone(baseline);
  try{storage.setItem(key,JSON.stringify(state));}catch{}
  return state;
}
