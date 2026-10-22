// Reuses the approved Spring contact/clear keyframes for the isolated 6×6 trial.
// Rendering, score, audio assets and rules remain owned by the caller.
export async function showFrames(frames,{render,board,onPlace=()=>{},onClear=()=>{}}){
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const animations=new Set(),effects=new Set();
  const cell=at=>board.querySelector(`[data-at="${at}"]`);
  const tile=at=>cell(at)?.querySelector('.block');
  const quiet=()=>reduce.matches||document.hidden;
  const run=(el,keyframes,duration,delay=0,easing='ease-out')=>{
    if(!el||quiet())return;
    const animation=el.animate(keyframes,{duration,delay,easing,fill:'both'});animations.add(animation);return animation;
  };
  const wait=ms=>new Promise(resolve=>{
    if(quiet())return resolve();
    const finish=()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',hidden);resolve();};
    const hidden=()=>{if(document.hidden)finish();};
    const timer=setTimeout(finish,ms);document.addEventListener('visibilitychange',hidden);
  });
  const cleanup=()=>{for(const a of animations)a.cancel();animations.clear();for(const e of effects)e.remove();effects.clear();};
  const effect=(name,styles)=>{
    const el=document.createElement('i');el.dataset.motion=name;el.setAttribute('aria-hidden','true');
    Object.assign(el.style,{position:'absolute',pointerEvents:'none',zIndex:'5',opacity:'0',...styles});board.append(el);effects.add(el);return el;
  };
  const bounds=el=>{const r=el.getBoundingClientRect(),b=board.getBoundingClientRect();return{x:r.left-b.left,y:r.top-b.top,w:r.width,h:r.height};};
  try{
    for(const frame of frames){
      cleanup();
      // Capture every source before replacing the board. All destinations animate together.
      const origins=new Map();
      if(frame.kind==='move')for(const move of frame.moves||[]){const el=cell(move.from);if(el)origins.set(move.id,el.getBoundingClientRect());}
      render(frame.board);
      if(frame.kind==='place'){
        const el=tile(frame.at);onPlace();
        if(!el||quiet())continue;
        run(el,[{transform:'scale(1.16,.79)'},{transform:'translateY(-7px) scale(.94,1.08)',offset:.3},{transform:'scale(1.06,.94)',offset:.6},{transform:'translateY(-2px) scale(.99,1.02)',offset:.8},{transform:'none'}],480);
        const r=bounds(el),halo=effect('place-halo',{left:`${r.x-4}px`,top:`${r.y-4}px`,width:`${r.w+8}px`,height:`${r.h+8}px`,border:'2px solid var(--coral,#f46b50)',borderRadius:'14px'});
        run(halo,[{opacity:.65,transform:'scale(.8)'},{opacity:0,transform:'scale(1.3)'}],410);await wait(480);
      }else if(frame.kind==='move'){
        for(const move of frame.moves||[]){
          const el=tile(move.to),from=origins.get(move.id);if(!el||!from)continue;
          const to=cell(move.to).getBoundingClientRect();
          run(el,[{transform:`translate(${from.left-to.left}px,${from.top-to.top}px)`},{transform:'translate(0,0)'}],280,0,'cubic-bezier(.2,.8,.3,1)');
        }
        await wait(280);
      }else if(frame.kind==='clear'){
        await wait(180);onClear(frame);if(quiet())continue;
        for(const at of frame.cleared||[]){
          const el=tile(at);if(!el)continue;
          const containing=(frame.lines||[]).filter(line=>line.cells.includes(at));
          const timings=containing.map(line=>{
            const middle=(line.cells.length-1)/2,position=line.cells.indexOf(at)-middle;
            const delay=(Math.abs(position)-(line.cells.length%2?0:.5))*90;
            const offset=middle?position/middle*4:0;
            return{delay,x:line.axis==='row'?offset:0,y:line.axis==='column'?offset:0};
          }).sort((a,b)=>a.delay-b.delay);
          const {delay=0,x=0,y=0}=timings[0]||{};
          run(el,[{opacity:1,transform:'scale(1)'},{opacity:1,transform:'scale(1.1,.85)',offset:.2},{opacity:1,transform:`translate(${x}px,${y-10}px) scale(.92,1.07)`,offset:.46},{opacity:.9,transform:`translate(${x}px,${y}px) scale(1.05,.96)`,offset:.7},{opacity:0,transform:`translate(${x}px,${y+5}px) scale(.15)`}],520,delay);
          const r=bounds(el),mote=effect('line-mote',{left:`${r.x+r.w/2-3}px`,top:`${r.y+r.h/2-3}px`,width:'6px',height:'6px',borderRadius:'50%',background:'var(--coral,#f46b50)'});
          run(mote,[{opacity:0,transform:'scale(.5)'},{opacity:.8,transform:`translate(${x*2}px,${y*2-22}px)`,offset:.45},{opacity:0,transform:`translate(${x*3}px,${y*3+4}px) scale(.2)`}],480,delay+230);
        }
        await wait(890);
      }
    }
  }finally{cleanup();}
}
