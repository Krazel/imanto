// A board press follows the contact point, then commits once on release.
export function installBoardPress({board,cellCount=25,canStart,onHover,onDrop,document:doc=globalThis.document,window:win=globalThis.window,now=Date.now}){
  let press=null,ignoreClickUntil=0;
  const targetAt=(x,y)=>{
    const cell=doc.elementFromPoint(x,y)?.closest('.cell');
    if(!cell||!board.contains(cell)||cell.disabled)return null;
    const at=Number(cell.dataset.at);
    return Number.isInteger(at)&&at>=0&&at<cellCount&&canStart(at)?at:null;
  };
  function hover(at){if(press&&press.at!==at){press.at=at;onHover(at);}}
  function finish(cancelled=false){
    if(!press)return;
    const current=press;press=null;ignoreClickUntil=now()+600;
    if(board.hasPointerCapture?.(current.id))board.releasePointerCapture(current.id);
    onHover(null);
    if(!cancelled&&current.at!==null&&canStart(current.at))onDrop(current.at);
  }
  board.addEventListener('pointerdown',event=>{
    if(press||event.isPrimary===false||event.button>0||!['touch','pen'].includes(event.pointerType))return;
    const cell=event.target.closest('.cell');
    if(!cell||!board.contains(cell)||cell.disabled)return;
    const at=Number(cell.dataset.at);if(!canStart(at))return;
    event.preventDefault();press={id:event.pointerId,at};onHover(at);
    try{board.setPointerCapture?.(event.pointerId);}catch{} // Synthetic test/accessibility pointers have no native capture.
  });
  board.addEventListener('pointermove',event=>{
    if(!press||event.pointerId!==press.id)return;
    event.preventDefault();hover(targetAt(event.clientX,event.clientY));
  });
  board.addEventListener('pointerup',event=>{
    if(!press||event.pointerId!==press.id)return;
    event.preventDefault();hover(targetAt(event.clientX,event.clientY));finish();
  });
  for(const kind of ['pointercancel','lostpointercapture'])board.addEventListener(kind,event=>{if(press&&event.pointerId===press.id)finish(true);});
  doc.addEventListener('keydown',event=>{if(event.key==='Escape')finish(true);});
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden)finish(true);});
  win.addEventListener('blur',()=>finish(true));
  return {active:()=>press!==null,suppressClick:()=>press!==null||now()<ignoreClickUntil,cancel:()=>finish(true)};
}
