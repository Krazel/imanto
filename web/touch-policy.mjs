const editable='input,textarea,select,[contenteditable=true],[data-allow-copy]';
export function installTouchPolicy(scope=globalThis){
  const doc=scope.document;
  doc.addEventListener('pointerdown',e=>{doc.documentElement.dataset.input=e.pointerType==='touch'||e.pointerType==='pen'?'touch':'pointer';},true);
  doc.addEventListener('keydown',e=>{if(['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))doc.documentElement.dataset.input='keyboard';},true);
  for(const name of ['selectstart','contextmenu','dragstart'])doc.addEventListener(name,e=>{
    const node=e.target;if(node.closest(editable)||node.closest('a[href]'))return;
    if(node.closest('.game,dialog'))e.preventDefault();
  });
}
