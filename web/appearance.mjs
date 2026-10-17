export const LOOKS={warm:'1. Cálido',clean:'2. Plano',soft:'3. Suave'};
export const APPROVED_LOOK='warm';
const KEY='krazel-imanes-appearance-v1';
export function savedLook(){try{const value=localStorage.getItem(KEY);return Object.hasOwn(LOOKS,value)?value:null;}catch{return null;}}
export function setLook(value){
  if(value!==null&&!Object.hasOwn(LOOKS,value))return false;
  try{if(value===null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,value);}catch{return false;}
  applyLook();return true;
}
function applyLook(){
  const preview=new URLSearchParams(location.search).get('look');
  document.documentElement.dataset.look=Object.hasOwn(LOOKS,preview)?preview:APPROVED_LOOK;
}
applyLook();
addEventListener('storage',event=>{if(event.key===KEY)applyLook();});
