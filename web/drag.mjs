// Pointer capture keeps touch/mouse drags coherent outside the tray and board.
export function installTrayDrag({tray,board,canStart,onSelect,onHover,onDrop,onFinish}){
  let drag=null,ignoreClickUntil=0;
  function finish(cancelled=false){
    if(!drag)return;
    const current=drag;drag=null;current.ghost?.remove();board.classList.remove('drag-over');tray.classList.remove('dragging');onHover(null);
    if(current.moved)ignoreClickUntil=Date.now()+600;
    if(tray.hasPointerCapture?.(current.id))tray.releasePointerCapture(current.id);
    onFinish();
    if(!cancelled&&current.moved&&current.at!==null&&canStart(current.option))onDrop(current.at,current.option);
  }
  tray.addEventListener('pointerdown',event=>{
    const button=event.target.closest('.choice');
    if(drag||!button||button.disabled||event.isPrimary===false||event.button>0)return;
    const option=Number(button.dataset.option);if(!canStart(option))return;
    event.preventDefault();onSelect(option);
    drag={id:event.pointerId,option,x:event.clientX,y:event.clientY,lift:event.pointerType==='touch'?38:0,moved:false,at:null,color:button.querySelector('.chip').dataset.color};
    try{tray.setPointerCapture?.(event.pointerId);}catch{} // Synthetic accessibility/test pointers may not support capture.
  });
  tray.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<7)return;
    event.preventDefault();drag.moved=true;
    if(!drag.ghost){
      const size=board.querySelector('.cell').getBoundingClientRect().width;
      const ghost=document.createElement('div');ghost.className=`drag-chip ${drag.color}`;ghost.setAttribute('aria-hidden','true');ghost.style.width=`${size}px`;ghost.style.height=`${size}px`;document.body.append(ghost);drag.ghost=ghost;tray.classList.add('dragging');
    }
    const x=event.clientX,y=event.clientY-drag.lift;
    drag.ghost.style.left=`${x}px`;drag.ghost.style.top=`${y}px`;
    const cell=document.elementFromPoint(x,y)?.closest('.cell');
    const at=cell&&!cell.disabled&&board.contains(cell)?Number(cell.dataset.at):null;
    if(at!==drag.at){drag.at=at;onHover(at);}
    drag.ghost.classList.toggle('over-target',at!==null);board.classList.toggle('drag-over',at!==null);
  });
  tray.addEventListener('pointerup',event=>{if(drag&&event.pointerId===drag.id){event.preventDefault();finish();}});
  tray.addEventListener('pointercancel',event=>{if(drag&&event.pointerId===drag.id)finish(true);});
  tray.addEventListener('lostpointercapture',()=>finish(true));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')finish(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(true);});
  window.addEventListener('blur',()=>finish(true));
  return {suppressClick:()=>Date.now()<ignoreClickUntil,cancel:()=>finish(true)};
}
