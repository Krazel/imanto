import {t} from './i18n.mjs';
export function celebrationFor(frame){
  const combo=frame.lineCount>1||frame.multiplier>1,all=!!frame.allClear;
  const comboLabel=frame.multiplier>1?`¡Combo ×${frame.multiplier}!`:frame.lineCount===2?'¡Doble línea!':frame.lineCount===3?'¡Triple línea!':`¡${frame.lineCount} líneas!`;
  return {kind:all?'all':combo?'combo':'line',title:all?'¡Tablero limpio!':combo?comboLabel:'¡Línea!',
    detail:`${combo?frame.lineCount+' líneas · ':''}+${frame.gain} puntos`,
    charge:all?440:combo?340:180,clearDuration:all||combo?320:700,linger:all?650:combo?350:190};
}
export function createCelebration(board,game,boardSize=5){
  const layer=document.createElement('div');layer.className='celebration-layer';layer.setAttribute('aria-hidden','true');board.append(layer);
  layer.style.setProperty('--fx-board-size',boardSize);
  const cellPercent=100/boardSize,center=(boardSize-1)/2,innerDistance=boardSize%2?0:.5;
  const placements=new Map();
  let releaseTimer=null;
  function finishPlacement(){
    for(const cleanup of [...placements.values()])cleanup();
  }
  function place(tile,duration=480){
    if(releaseTimer!==null)finish({keepPlacement:true});
    placements.get(tile)?.();if(duration===0)return 480;
    tile.classList.add('spring-placed');
    const placementHalo=document.createElement('i');placementHalo.className='spring-place-halo';
    for(const key of ['--row','--col'])placementHalo.style.setProperty(key,tile.style.getPropertyValue(key));
    const cleanup=()=>{clearTimeout(timer);tile.removeEventListener('animationend',ended);tile.classList.remove('spring-placed');placementHalo.remove();placements.delete(tile);};
    const ended=event=>{if(event.target===tile&&event.animationName==='spring-place')cleanup();};
    const timer=setTimeout(cleanup,duration+50);tile.addEventListener('animationend',ended);placements.set(tile,cleanup);
    layer.append(placementHalo);return 480;
  }
  function finish({keepPlacement=false,keepReleased=false}={}){
    if(keepReleased&&releaseTimer!==null)return;
    clearTimeout(releaseTimer);releaseTimer=null;
    if(!keepPlacement)finishPlacement();
    for(const child of [...layer.children])if(!keepPlacement||!child.classList.contains('spring-place-halo'))child.remove();
    board.classList.remove('celebrating','celebrating-line','celebrating-combo','celebrating-all');
    game.classList.remove('celebrating-all');
  }
  function release(duration){
    clearTimeout(releaseTimer);
    if(duration<=0){finish({keepPlacement:true});return;}
    releaseTimer=setTimeout(()=>{releaseTimer=null;finish({keepPlacement:true});},duration);
  }
  function start(frame,tiles){
    finish();const source=celebrationFor(frame),info={...source,title:frame.allClear?t('¡Tablero limpio!'):frame.multiplier>1?t('¡Combo ×{n}!',{n:frame.multiplier}):frame.lineCount>3?t('¡{n} líneas!',{n:frame.lineCount}):t(source.title),detail:frame.multiplier>1?t('{base} × {combo} · +{points}',{base:frame.baseGain,combo:frame.multiplier,points:frame.gain}):frame.lineCount>1?t('{n} líneas · +{points} puntos',{n:frame.lineCount,points:frame.gain}):t('+{points} puntos',{points:frame.gain})};
    board.style.setProperty('--fx-charge',`${info.charge}ms`);
    board.classList.add('celebrating',`celebrating-${info.kind}`);if(info.kind==='all')game.classList.add('celebrating-all');
    for(const tile of tiles){
      tile.classList.add('winning',`winning-${info.kind}`);
      if(info.kind==='line'){
        const at=frame.board.findIndex(piece=>piece?.id===Number(tile.dataset.id));
        const along=frame.lines[0].axis==='row'?at%boardSize:Math.floor(at/boardSize);
        const offset=(along-center)*2/center;
        // Even boards launch their middle pair together; the outer cells still start at 180ms.
        const springDelay=(Math.abs(along-center)-innerDistance)*180/Math.max(1,center-innerDistance);
        tile.style.setProperty('--spring-delay',`${springDelay}ms`);
        tile.style.setProperty('--spring-x',`${frame.lines[0].axis==='row'?offset*2:0}px`);
        tile.style.setProperty('--spring-y',`${frame.lines[0].axis==='row'?0:offset*2}px`);
        const mote=document.createElement('i');mote.className='spring-mote';
        mote.style.setProperty('--origin-x',`${(at%boardSize+.5)*cellPercent}%`);mote.style.setProperty('--origin-y',`${(Math.floor(at/boardSize)+.5)*cellPercent}%`);
        mote.style.setProperty('--spring-delay',`${springDelay}ms`);mote.style.setProperty('--mote-x',`${offset*4}px`);
        layer.append(mote);
      }
    }
    if(info.kind!=='line'){
    // Clip only the burst, never the reward or the approved Spring placement.
    const burst=document.createElement('div');burst.className='celebration-burst';layer.append(burst);
    const all=info.kind==='all',radius=(board.clientWidth||320)*(all?.48:.43);
    const glow=document.createElement('i');glow.className='win-bloom';burst.append(glow);
    for(const line of frame.lines){
      const beam=document.createElement('i');beam.className=`win-beam beam-${line.axis}`;beam.style.setProperty('--line',line.index);burst.append(beam);
    }
    // Two short star trails per cleared cell, bounded by the current board.
    for(const at of frame.cleared||[])for(let n=0;n<2;n++){
      const glint=document.createElement('i');glint.className='win-glint';
      glint.style.setProperty('--origin-x',`${(at%boardSize+.5)*cellPercent}%`);glint.style.setProperty('--origin-y',`${(Math.floor(at/boardSize)+.5)*cellPercent}%`);
      const angle=(at*1.7+n*3.1);glint.style.setProperty('--dx',`${Math.cos(angle)*(n?65:35)}px`);glint.style.setProperty('--dy',`${Math.sin(angle)*(n?65:35)-25}px`);
      glint.style.setProperty('--spark-delay',`${(at%boardSize)*72/(boardSize-1)+n*30}ms`);burst.append(glint);
    }
    for(let n=0;n<(all?3:2);n++){
      const ring=document.createElement('i');ring.className='win-ring';ring.style.setProperty('--burst-delay',`${n*85}ms`);burst.append(ring);
    }
    const rays=all?16:10;
    for(let n=0;n<rays;n++){
      const ray=document.createElement('i');ray.className='win-ray';
      ray.style.setProperty('--ray-angle',`${n*360/rays+(all?11:18)}deg`);
      ray.style.setProperty('--ray-length',`${radius*(n%2?.78:1)}px`);
      ray.style.setProperty('--burst-delay',`${n%2*45}ms`);burst.append(ray);
    }
    if(all){const outline=document.createElement('i');outline.className='win-board-wave';burst.append(outline);}
    const sparks=all?42:28;
    for(let n=0;n<sparks;n++){
      const spark=document.createElement('i'),angle=n*Math.PI*2/sparks,distance=radius*(.65+n%3*.17);
      spark.className=`win-spark${n%3===0?' win-confetti':''}`;spark.style.setProperty('--dx',`${Math.cos(angle)*distance}px`);spark.style.setProperty('--dy',`${Math.sin(angle)*distance}px`);
      spark.style.setProperty('--spark-color',['#edb137','#fff8dd','#278a91','#f7aa68'][n%4]);spark.style.setProperty('--spark-delay',`${n%4*25}ms`);burst.append(spark);
    }
    }
    const card=document.createElement('div');card.className='celebration-card';
    if(info.kind!=='line'){
      const badge=document.createElement('b');badge.className='celebration-seal';
      badge.textContent=info.kind==='all'?'✦':frame.multiplier>1?`×${frame.multiplier}`:String(frame.lineCount);card.append(badge);
    }
    const title=document.createElement('strong');title.textContent=info.title;
    const detail=document.createElement('span');detail.textContent=info.detail;card.append(title,detail);layer.append(card);
    return info;
  }
  return {start,finish,place,finishPlacement,release};
}
