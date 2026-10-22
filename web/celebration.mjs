import {t} from './i18n.mjs';
export function celebrationFor(frame){
  const combo=frame.lineCount>1||frame.multiplier>1,all=!!frame.allClear;
  const comboLabel=frame.multiplier>1?`¡Combo ×${frame.multiplier}!`:frame.lineCount===2?'¡Doble línea!':frame.lineCount===3?'¡Triple línea!':`¡${frame.lineCount} líneas!`;
  return {kind:all?'all':combo?'combo':'line',title:all?'¡Tablero limpio!':combo?comboLabel:'¡Línea!',
    detail:`${combo?frame.lineCount+' líneas · ':''}+${frame.gain} puntos`,
    charge:all?440:combo?340:180,clearDuration:all||combo?320:700,linger:all?650:combo?350:190};
}
export function createCelebration(board,game){
  const layer=document.createElement('div');layer.className='celebration-layer';layer.setAttribute('aria-hidden','true');board.append(layer);
  let placedTile=null,placementHalo=null;
  function finishPlacement(){
    placedTile?.classList.remove('spring-placed');placementHalo?.remove();placedTile=null;placementHalo=null;
  }
  function place(tile){
    finishPlacement();placedTile=tile;tile.classList.add('spring-placed');
    placementHalo=document.createElement('i');placementHalo.className='spring-place-halo';
    for(const key of ['--row','--col'])placementHalo.style.setProperty(key,tile.style.getPropertyValue(key));
    layer.append(placementHalo);return 480;
  }
  function finish(){
    finishPlacement();
    layer.replaceChildren();board.classList.remove('celebrating','celebrating-line','celebrating-combo','celebrating-all');
    game.classList.remove('celebrating-all');
  }
  function start(frame,tiles){
    finish();const source=celebrationFor(frame),info={...source,title:frame.allClear?t('¡Tablero limpio!'):frame.multiplier>1?t('¡Combo ×{n}!',{n:frame.multiplier}):frame.lineCount>3?t('¡{n} líneas!',{n:frame.lineCount}):t(source.title),detail:frame.multiplier>1?t('{base} × {combo} · +{points}',{base:frame.baseGain,combo:frame.multiplier,points:frame.gain}):frame.lineCount>1?t('{n} líneas · +{points} puntos',{n:frame.lineCount,points:frame.gain}):t('+{points} puntos',{points:frame.gain})};
    board.style.setProperty('--fx-charge',`${info.charge}ms`);
    board.classList.add('celebrating',`celebrating-${info.kind}`);if(info.kind==='all')game.classList.add('celebrating-all');
    for(const tile of tiles){
      tile.classList.add('winning',`winning-${info.kind}`);
      if(info.kind==='line'){
        const at=frame.board.findIndex(piece=>piece?.id===Number(tile.dataset.id));
        const along=frame.lines[0].axis==='row'?at%5:Math.floor(at/5),offset=along-2;
        tile.style.setProperty('--spring-delay',`${Math.abs(offset)*90}ms`);
        tile.style.setProperty('--spring-x',`${frame.lines[0].axis==='row'?offset*2:0}px`);
        tile.style.setProperty('--spring-y',`${frame.lines[0].axis==='row'?0:offset*2}px`);
        const mote=document.createElement('i');mote.className='spring-mote';
        mote.style.setProperty('--origin-x',`${(at%5+.5)*20}%`);mote.style.setProperty('--origin-y',`${(Math.floor(at/5)+.5)*20}%`);
        mote.style.setProperty('--spring-delay',`${Math.abs(offset)*90}ms`);mote.style.setProperty('--mote-x',`${offset*4}px`);
        layer.append(mote);
      }
    }
    if(info.kind!=='line'){
    for(const line of frame.lines){
      const beam=document.createElement('i');beam.className=`win-beam beam-${line.axis}`;beam.style.setProperty('--line',line.index);layer.append(beam);
    }
    // Two short star trails per cleared cell, bounded by the 25-cell board.
    for(const at of frame.cleared||[])for(let n=0;n<2;n++){
      const glint=document.createElement('i');glint.className='win-glint';
      glint.style.setProperty('--origin-x',`${(at%5+.5)*20}%`);glint.style.setProperty('--origin-y',`${(Math.floor(at/5)+.5)*20}%`);
      const angle=(at*1.7+n*3.1);glint.style.setProperty('--dx',`${Math.cos(angle)*(n?65:35)}px`);glint.style.setProperty('--dy',`${Math.sin(angle)*(n?65:35)-25}px`);
      glint.style.setProperty('--spark-delay',`${at%5*18+n*30}ms`);layer.append(glint);
    }
    const ring=document.createElement('i');ring.className='win-ring';layer.append(ring);
    const sparks=info.kind==='line'?14:info.kind==='all'?36:26;
    for(let n=0;n<sparks;n++){
      const spark=document.createElement('i'),angle=n*Math.PI*2/sparks;
      spark.className='win-spark';spark.style.setProperty('--dx',`${Math.cos(angle)*150}px`);spark.style.setProperty('--dy',`${Math.sin(angle)*150}px`);
      spark.style.setProperty('--spark-color',['#ffe18b','#fff8dd','#4ebfc0','#f7aa68'][n%4]);spark.style.setProperty('--spark-delay',`${n%4*25}ms`);layer.append(spark);
    }
    }
    const card=document.createElement('div');card.className='celebration-card';
    const title=document.createElement('strong');title.textContent=info.title;
    const detail=document.createElement('span');detail.textContent=info.detail;card.append(title,detail);layer.append(card);
    return info;
  }
  return {start,finish,place,finishPlacement};
}
