import {t} from './i18n.mjs';
export function celebrationFor(frame){
  const combo=frame.lineCount>1,all=!!frame.allClear;
  const comboLabel=frame.lineCount===2?'¡Combo doble!':frame.lineCount===3?'¡Combo triple!':`¡Combo ×${frame.lineCount}!`;
  return {kind:all?'all':combo?'combo':'line',title:all?'¡Tablero limpio!':combo?comboLabel:'¡Línea!',
    detail:`${combo?frame.lineCount+' líneas · ':''}+${frame.gain} puntos`,
    charge:all?440:combo?340:180,linger:all?650:combo?350:100};
}
export function createCelebration(board,game){
  const layer=document.createElement('div');layer.className='celebration-layer';layer.setAttribute('aria-hidden','true');board.append(layer);
  function finish(){
    layer.replaceChildren();board.classList.remove('celebrating','celebrating-line','celebrating-combo','celebrating-all');
    game.classList.remove('celebrating-all');
  }
  function start(frame,tiles){
    finish();const source=celebrationFor(frame),info={...source,title:frame.lineCount>3&&!frame.allClear?t('¡Combo ×{n}!',{n:frame.lineCount}):t(source.title),detail:frame.lineCount>1?t('{n} líneas · +{points} puntos',{n:frame.lineCount,points:frame.gain}):t('+{points} puntos',{points:frame.gain})};
    board.style.setProperty('--fx-charge',`${info.charge}ms`);
    board.classList.add('celebrating',`celebrating-${info.kind}`);if(info.kind==='all')game.classList.add('celebrating-all');
    for(const tile of tiles)tile.classList.add('winning',`winning-${info.kind}`);
    for(const line of frame.lines){
      const beam=document.createElement('i');beam.className=`win-beam beam-${line.axis}`;beam.style.setProperty('--line',line.index);layer.append(beam);
    }
    const ring=document.createElement('i');ring.className='win-ring';layer.append(ring);
    const sparks=info.kind==='line'?10:info.kind==='all'?32:20;
    for(let n=0;n<sparks;n++){
      const spark=document.createElement('i'),angle=n*Math.PI*2/sparks;
      spark.className='win-spark';spark.style.setProperty('--dx',`${Math.cos(angle)*150}px`);spark.style.setProperty('--dy',`${Math.sin(angle)*150}px`);
      spark.style.setProperty('--spark-color',['#ffe18b','#fff8dd','#4ebfc0','#f7aa68'][n%4]);spark.style.setProperty('--spark-delay',`${n%4*25}ms`);layer.append(spark);
    }
    const card=document.createElement('div');card.className='celebration-card';
    const title=document.createElement('strong');title.textContent=info.title;
    const detail=document.createElement('span');detail.textContent=info.detail;card.append(title,detail);layer.append(card);
    return info;
  }
  return {start,finish};
}
