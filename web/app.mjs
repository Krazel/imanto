import {createGame,playTurn,simulate,restoreGame,resolveBoard,BASIC_PHYSICS,normalizePhysics,contactPairs,reviveStatus,beginRevive,settleRevive,removeForRevive,beginCreditRemoval,settleCreditRemoval,blockRemovalStatus,removeForCredit,beginPaidRevive,settlePaidRevive} from './engine.mjs';
import {createAds,createAdCadence,ADS_CONFIG} from './ads.mjs';
import {createNativeAdProvider} from './native-ads.mjs';
import {createSubscriptions,MONTHLY_PLAN_PREVIEW} from './subscriptions.mjs';
import {createNativeSubscriptionProvider} from './native-subscriptions.mjs';
import {createLaboratory,laboratoryScene} from './lab.mjs';
import {VARIANTS,variantSaveKey,loadComparison} from './variants.mjs';
import {MAIN_SAVE_KEY,loadMain} from './main-save.mjs';
import {DEMOS,effectScene,createEffectsRoom} from './effect-demos.mjs';
import {createCelebration} from './celebration.mjs';
import {checkLines,applyLineCheck} from './line-search.mjs';
import {t,initializeLanguage,language} from './i18n.mjs';
import {writeScore,fitScore,scoreText} from './score-display.mjs';
import {createAudio} from './audio.mjs';
import {createHaptics} from './haptics.mjs';
import {readCombo} from './combo.mjs';
import {createPersonalBest} from './personal-best.mjs';
import {installTrayDrag} from './drag.mjs';
import {installBoardPress} from './board-press.mjs';
const $=s=>document.querySelector(s);
const boardEl=$('#board'),cellsEl=$('#cells'),piecesEl=$('#pieces'),previewEl=$('#preview');
const trayEl=$('#tray'),status=$('#status'),menu=$('#menu'),help=$('#instructions');
const restartConfirm=$('#restart-confirm');
const effectParam=new URLSearchParams(location.search).get('effects');
const IS_EFFECTS=effectParam!==null;
const IS_CAPTURE=IS_EFFECTS&&new URLSearchParams(location.search).get('capture')==='1';
const IS_PRESENTATION=IS_EFFECTS&&new URLSearchParams(location.search).get('presentation')==='1';
const IS_LAB=!IS_EFFECTS&&new URLSearchParams(location.search).get('lab')==='1';
const variantId=new URLSearchParams(location.search).get('variant');
const VARIANT=!IS_LAB&&!IS_EFFECTS&&variantId!=='no-turn'&&Object.hasOwn(VARIANTS,variantId)?VARIANTS[variantId]:null;
const IS_MAIN=!IS_LAB&&!IS_EFFECTS&&!VARIANT;
const SAVE=IS_EFFECTS&&Object.hasOwn(DEMOS,effectParam)?`krazel-imanes-effect-demo-${effectParam}-v2`:IS_EFFECTS?'krazel-imanes-effects-v1':IS_LAB?'krazel-imanes-lab-v5':VARIANT?variantSaveKey(variantId):MAIN_SAVE_KEY;
const names={coral:t('coral'),teal:t('turquesa'),honey:t('miel'),violet:t('violeta')};
const spoken=p=>names[p.color];
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
let state,selected=0,busy=false,editing=false,draft=null,experiment=null,triggerId=null,removingForRevive=false;
let previewAt=null,bonusTimer,statusTimer,migrated=false,guidanceSeen=false;
let removalKind='revive';
let demoKind=Object.hasOwn(DEMOS,effectParam)?effectParam:'double',demoSpeed=1,demoAt=12;
const effectRoom=IS_EFFECTS?createEffectsRoom({onPlay:playDemo,onPrepare:()=>prepareDemo(),onSpeed:setEffectSpeed}):null;
const celebration=createCelebration(boardEl,document.querySelector('.game'));
const audio=createAudio();
const haptics=createHaptics();
const lab=IS_LAB?createLaboratory({onChange:setPhysics,onScene:loadScene,onEdit:toggleEditing,onApply:applyExperiment}):null;
let physics=lab?.getSettings()||normalizePhysics(VARIANT||BASIC_PHYSICS);
if(lab) {
  document.body.classList.add('is-lab');document.body.append(lab.element);document.title=`Imanto · ${t('Laboratorio')}`;
  $('.heading h1').textContent=t('Laboratorio');$('#variant-name').hidden=false;$('#variant-name').textContent=t('Prueba sin cambiar tu partida.');
  document.querySelector('.legend').textContent=t('Laboratorio · una expulsión simultánea');
  $('#lab-link').textContent=t('Volver al juego');$('#lab-link').href='/';
}
if(effectRoom){
  document.body.classList.add('is-lab','is-effects');document.body.append(effectRoom.element);
  document.title=`Imanto · ${t('Pruebas de animación')}`;$('.heading h1').textContent=t('Pruebas');$('#variant-name').hidden=false;$('#variant-name').textContent=t('Tu partida se guarda aparte.');
  $('#lab-link').textContent=t('Volver a mi partida');$('#lab-link').href='/';$('#new-game').textContent=t('Preparar prueba');
}
if(!IS_LAB&&!VARIANT){
  if(!IS_EFFECTS){document.title='Imanto · Krazel Games';$('#variant-name').hidden=true;}
  $('#movement-rule').textContent=t(VARIANTS['no-turn'].rule);
}
document.querySelector('.variant-links').hidden=!(VARIANT||IS_LAB);
if(VARIANT){
  document.body.classList.add('is-comparison');
  document.title=`Imanto · ${t(VARIANT.short)}`;
  document.querySelector('.legend').textContent=t('Solo la ficha colocada expulsa · todos a la vez');
  $('#variant-name').hidden=false;$('#variant-name').textContent=t(VARIANT.name);
  $('#variant-rule').hidden=false;$('#variant-rule').textContent=t(VARIANT.rule);
  $('#movement-rule').textContent=t(VARIANT.rule);
  $('#help-title').textContent=t(VARIANT.short);
  $('#new-game').textContent=t('Repetir inicio común');
}
$('#mode-back').hidden=!(IS_LAB||IS_EFFECTS||VARIANT);
if(IS_CAPTURE){document.body.classList.add('is-capture');$('.heading h1').textContent='IMANTO';document.title='Imanto · Gameplay capture';for(const id of ['#quick-speed','#effect-speed']){const option=document.createElement('option');option.value='12';option.textContent='Capture (slow)';$(id).append(option);}}
if(IS_PRESENTATION){document.body.classList.remove('is-lab');document.body.classList.add('is-presentation');$('.heading h1').textContent='IMANTO';}

if(IS_LAB||IS_EFFECTS){
  $('#quick-controls').hidden=false;
  if(IS_LAB){$('#quick-controls').classList.add('lab-quick');$('#quick-primary').textContent=t('Simular');$('#quick-secondary').textContent=t('Editar');$('#quick-speed-label').hidden=true;}
  $('#quick-primary').addEventListener('click',()=>IS_LAB?applyExperiment():playDemo());
  $('#quick-secondary').addEventListener('click',()=>IS_LAB?toggleEditing():prepareDemo());
  $('#quick-speed').addEventListener('change',e=>setEffectSpeed(Number(e.target.value)));
}
function setEffectSpeed(value){demoSpeed=value;document.documentElement.style.setProperty('--fx-speed',value);$('#quick-speed').value=String(value);if($('#effect-speed'))$('#effect-speed').value=String(value);}
function setQuickBusy(value){for(const control of $('#quick-controls').querySelectorAll('button,select'))control.disabled=value;}
for(const example of document.querySelectorAll('.mini-board')){
  const kind=example.dataset.illustration;
  for(let at=0;at<25;at++){
    const cell=document.createElement('i');
    if(kind==='choose'&&at===12)cell.className=t('coral');
    if(kind==='push'&&[7,17].includes(at))cell.className='honey';
    if(kind==='push'&&[11,13].includes(at))cell.className=t('coral');
    if((kind==='push'&&at===12)||(kind==='line'&&at>=10&&at<15))cell.className='teal';
    example.append(cell);
  }
}
for(const link of document.querySelectorAll('.variant-links a')){
  if((VARIANT&&link.dataset.variant===variantId)||(!VARIANT&&!IS_LAB&&link.dataset.variant==='original'))link.setAttribute('aria-current','page');
}
function readSave(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}}
const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
const subscriptions=createSubscriptions({provider:createNativeSubscriptionProvider()});
const ads=createAds({provider:createNativeAdProvider(),suppressAutomatic:subscriptions.suppressAutomaticAds});
const adCadence=createAdCadence(storage);
$('#ad-privacy').hidden=!IS_MAIN||!['banner','interstitial','rewarded'].some(ads.supported);
$('#ad-privacy').addEventListener('click',async()=>{await ads.privacy();await syncAutomaticAds();});
const personalBest=createPersonalBest(storage);
if(IS_EFFECTS)state=effectParam==='1'?restoreGame(readSave(SAVE))||effectScene(demoKind).state:effectScene(demoKind).state;
else if(VARIANT)state=loadComparison(variantId,storage);
else if(IS_LAB)state=restoreGame(readSave(SAVE));
else {const loaded=loadMain(storage);state=loaded.state;migrated=loaded.migrated;}
if(!state&&IS_LAB) {
  for(const key of IS_LAB?['krazel-imanes-lab-v4',MAIN_SAVE_KEY,'krazel-imanes-v5','krazel-imanes-v4','krazel-imanes-v3','krazel-imanes-v2','krazel-imanes-v1']:['krazel-imanes-v4','krazel-imanes-v3','krazel-imanes-v2','krazel-imanes-v1']) {
    state=restoreGame(readSave(key),Math.random,physics);if(state){migrated=true;break;}
  }
}
if(!state) state=createGame(Math.random,physics);
function identifyGame(){if(IS_MAIN&&!state.gameId)state.gameId=globalThis.crypto?.randomUUID?.()||`game-${Date.now()}-${Math.random().toString(36).slice(2)}`;}
identifyGame();
if(IS_MAIN){try{guidanceSeen=localStorage.getItem('krazel-imanes-guidance-v1')==='done';}catch{}if(state.turns>0)finishGuidance();}
function finishGuidance(){guidanceSeen=true;if(IS_MAIN)try{localStorage.setItem('krazel-imanes-guidance-v1','done');}catch{}}
function idleMessage(){return IS_MAIN?(guidanceSeen?'':t('Elige una ficha y toca un hueco.')):t('Elige un color y toca un hueco.');}
selected=state.tray.findIndex(Boolean);
const cells=Array.from({length:25},(_,i)=>{const b=document.createElement('button');b.className='cell';b.dataset.at=i;cellsEl.append(b);return b;});
function persist(){try{localStorage.setItem(SAVE,JSON.stringify(state));}catch{}if(IS_MAIN)personalBest.update(state.score);renderBest();}
function renderBest(){const best=personalBest.get();writeScore($('#best-score'),best,language,true);$('#personal-best').setAttribute('aria-label',t('Récord personal: {n}',{n:scoreText(best,language).exact}));}
function renderCombo(){
  const combo=readCombo(state.combo,state.round),badge=$('#combo-badge');badge.hidden=!combo.count;
  if(!combo.count)return;
  $('#combo-label').textContent=`COMBO ×${combo.count}`;
  const hands=combo.lastRound===state.round?2:1;
  badge.dataset.hands=hands;badge.setAttribute('aria-label',t(hands===2?'Combo ×{n}. Esta tanda y la siguiente.':'Combo ×{n}. Última tanda para continuar.',{n:combo.count}));
}
let scoreFrame=0;
function showScore(value,animate=false){
  cancelAnimationFrame(scoreFrame);const el=$('#score'),from=Number(el.dataset.value)||0;
  el.setAttribute('aria-label',t('Puntuación: {n}',{n:value}));
  el.dataset.wide=String(value).length>6;
  if(!animate||reduce.matches){writeScore(el,value,language,true);return;}
  const begin=performance.now();
  const tick=now=>{const progress=Math.min(1,(now-begin)/280);writeScore(el,Math.round(from+(value-from)*(1-(1-progress)**3)),language,true);if(progress<1)scoreFrame=requestAnimationFrame(tick);};
  scoreFrame=requestAnimationFrame(tick);el.classList.remove('score-reward');void el.offsetWidth;el.classList.add('score-reward');
}
function position(el,at){el.style.setProperty('--row',Math.floor(at/5));el.style.setProperty('--col',at%5);}
function tile(p,at,extra=''){const el=document.createElement('div');el.className=`tile ${p.color} ${extra}`;el.textContent='';el.dataset.id=p.id;position(el,at);return el;}
function renderBoard(board) {
  if(IS_LAB)$('#quick-secondary').textContent=editing?t('Salir de edición'):t('Editar');
  const existing=new Map([...piecesEl.children].map(el=>[Number(el.dataset.id),el]));
  const touching=new Set(contactPairs(board).flat());
  board.forEach((p,at)=>{
    if(!p)return;let el=existing.get(p.id);
    if(!el){el=tile(p,at);piecesEl.append(el);}else{position(el,at);existing.delete(p.id);}
    el.classList.toggle('contact',IS_LAB&&editing&&touching.has(at));
  });
  for(const el of existing.values())el.remove();
  cells.forEach((cell,at)=>{const p=board[at];cell.classList.toggle('empty',!p);
    cell.disabled=busy||(removingForRevive?!p:!editing&&(!!p||state.over));
    cell.classList.toggle('revive-target',removingForRevive&&!!p);
    cell.setAttribute('aria-label',t('Fila {row}, columna {col}, {tile}',{row:Math.floor(at/5)+1,col:at%5+1,tile:p?spoken(p):t('vacía')}));
  });
  boardEl.classList.toggle('editing',editing);
}
function renderTray(){
  trayEl.replaceChildren();
  state.tray.forEach((p,i)=>{
    const button=document.createElement('button');button.className='choice';button.dataset.option=i;
    if(!p){button.classList.add('used');button.disabled=true;button.setAttribute('aria-label',t('Opción {n}: ya colocada',{n:i+1}));const mark=document.createElement('span');mark.className='chip';mark.textContent='✓';mark.setAttribute('aria-hidden','true');button.append(mark);trayEl.append(button);return;}
    button.setAttribute('aria-label',t('Opción {n}: {color}',{n:i+1,color:spoken(p)}));button.setAttribute('aria-pressed',String(selected===i));button.disabled=busy||editing||state.over||removingForRevive;
    const chip=document.createElement('span');chip.className=`chip ${p.color}`;chip.dataset.color=p.color;chip.textContent='';chip.setAttribute('aria-hidden','true');button.append(chip);
    button.addEventListener('click',()=>{if(trayDrag.suppressClick())return;selected=i;renderTray();clearPreview();status.textContent=IS_MAIN?idleMessage():t('{color}: toca un hueco',{color:spoken(p)});});trayEl.append(button);
  });
  renderCombo();$('#pause').setAttribute('aria-label',state.over?t('Ver resultado'):t('Pausar partida'));
  $('#next-hand').replaceChildren();for(const p of state.nextTray){const chip=document.createElement('span');chip.className=`forecast-chip ${p.color}`;chip.textContent='';chip.setAttribute('role','img');chip.setAttribute('aria-label',spoken(p));$('#next-hand').append(chip);}
}
function clearPreview(){previewAt=null;previewEl.replaceChildren();cells.forEach(c=>c.classList.remove('will-clear'));}
function preview(at){
  if(busy||editing||removingForRevive||state.over||state.board[at]||previewAt===at||menu.open||help.open||restartConfirm.open)return;
  clearPreview();previewAt=at;const p=state.tray[selected];if(!p)return;
  const result=simulate(state.board,at,p,physics);previewEl.append(tile(p,at,'ghost'));
  result.frames.find(frame=>frame.kind==='clear')?.cleared.forEach(i=>cells[i].classList.add('will-clear'));
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,reduce.matches?0:ms*(IS_EFFECTS?demoSpeed:1)));
async function animate(result,oldScore,playedId=null,initialBoard=null,lineCheck=null){
  clearTimeout(bonusTimer);clearTimeout(statusTimer);$('#bonus').classList.remove('show');busy=true;clearPreview();persist();
  if(initialBoard){piecesEl.replaceChildren();renderBoard(initialBoard);}
  boardEl.setAttribute('aria-busy','true');$('#pause').disabled=true;lab?.setBusy(true);effectRoom?.setBusy(true);setQuickBusy(true);renderTray();status.textContent=t('Los imanes se recolocan…');
  const moveFrames=result.frames.filter(f=>f.kind==='move').length;
  const speed=IS_LAB?physics.speed:Math.min(physics.speed,Math.max(12,1100/Math.max(1,moveFrames)));
  document.documentElement.style.setProperty('--move-ms',`${speed*(IS_EFFECTS?demoSpeed:1)}ms`);let shown=oldScore,activeCelebration=null;
  for(const frame of result.frames){
    if(frame.kind==='clear'){
      const ids=new Set(frame.cleared.map(i=>frame.board[i].id));
      const winning=[...piecesEl.children].filter(el=>ids.has(Number(el.dataset.id)));
      activeCelebration=celebration.start(frame,winning);audio.play('line');haptics.clear(frame);
      shown+=frame.gain;showScore(shown,true);$('#bonus').textContent=`+${frame.gain}`;$('#bonus').classList.add('show');
      const badge=$('#combo-badge');badge.classList.remove('combo-reward');void badge.offsetWidth;badge.classList.add('combo-reward');
      status.textContent=activeCelebration.title;await delay(activeCelebration.charge);
      winning.forEach(el=>el.classList.add('clear'));await delay(320);
    }else{
      renderBoard(frame.board);
      if(frame.kind==='move'){audio.play('move');await delay(speed+(IS_LAB?10:0));}
      if(frame.kind==='settle'&&activeCelebration){await delay(activeCelebration.linger);celebration.finish();activeCelebration=null;}
    }
  }
  if(lineCheck){status.textContent=t('Comprobando líneas posibles…');state=applyLineCheck(state,await lineCheck);persist();}
  busy=false;renderBoard(state.board);renderTray();showScore(state.score);$('#pause').disabled=false;lab?.setBusy(false);effectRoom?.setBusy(false);setQuickBusy(false);celebration.finish();boardEl.setAttribute('aria-busy','false');
  const resultMessage=result.allClears?t('¡Tablero limpio! +{points} puntos',{points:result.total}):result.maxSimultaneous>1?t('¡Combo de {n} líneas! +{points} puntos',{n:result.maxSimultaneous,points:result.total}):result.total?t('+{points} puntos · {n} línea',{points:result.total,n:result.lineCount}):result.physicsMoves?t(result.physicsMoves===1?'Expulsión · {n} movimiento':'Expulsión · {n} movimientos',{n:result.physicsMoves}):t('Completa cinco del mismo color');
  status.textContent=IS_MAIN&&!result.total?idleMessage():resultMessage;
  if(IS_MAIN&&result.total)statusTimer=setTimeout(()=>{if(!busy&&!state.over)status.textContent=idleMessage();},2400);
  lab?.showStats(state.board,result.physicsMoves);bonusTimer=setTimeout(()=>$('#bonus').classList.remove('show'),1200);
  if(state.over&&!IS_LAB)openMenu(true);
}
async function place(at){
  if(busy||menu.open||help.open||restartConfirm.open)return;
  if(removingForRevive){await finishRevive(at);return;}
  if(editing){const brush=lab.getBrush();draft.board[at]=brush.color==='empty'?null:{id:draft.nextId++,color:brush.color};draft.over=false;draft.endReason=null;triggerId=draft.board[at]?.id||null;experiment=structuredClone(draft);renderBoard(draft.board);lab.showStats(draft.board,0,true);return;}
  if(state.over||state.board[at])return;
  experiment=null;const oldScore=state.score,playedId=state.tray[selected].id,result=playTurn(state,at,selected,IS_EFFECTS&&demoKind==='escape'?()=>.5:Math.random,physics);
  state=result.state;audio.play('place');if(result.frames.find(f=>f.kind!=='place')?.kind!=='clear')haptics.play('place');if(IS_MAIN)finishGuidance();const lineCheck=IS_LAB?null:checkLines(state,physics);
  if(!state.tray[selected]||result.newRound)selected=state.tray.findIndex(Boolean);await animate(result,oldScore,playedId,null,lineCheck);
}
const trayDrag=installTrayDrag({tray:trayEl,board:boardEl,
  canStart:option=>!busy&&!editing&&!removingForRevive&&!state.over&&!menu.open&&!help.open&&!restartConfirm.open&&!!state.tray[option],
  onSelect:option=>{selected=option;clearPreview();haptics.prepare();for(const button of trayEl.children)button.setAttribute('aria-pressed',String(Number(button.dataset.option)===option));},
  onHover:at=>{clearPreview();if(at!==null){preview(at);haptics.prepare();}},
  onFinish:()=>renderTray(),onDrop:(at,option)=>{selected=option;place(at);}
});
const boardPress=installBoardPress({board:boardEl,
  canStart:at=>!busy&&!menu.open&&!help.open&&!restartConfirm.open&&!cells[at].disabled,
  onHover:at=>{clearPreview();if(at!==null){preview(at);if(!editing)haptics.prepare();}},
  onDrop:at=>place(at)
});
for(let at=0;at<25;at++){
  const cell=cells[at];cell.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')preview(at);});cell.addEventListener('focus',()=>preview(at));
  cell.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&!cell.disabled&&!busy&&!editing)haptics.prepare();});
  cell.addEventListener('click',()=>{if(!boardPress.suppressClick())place(at);});
  cell.addEventListener('keydown',e=>{const d={ArrowRight:1,ArrowLeft:-1,ArrowUp:-5,ArrowDown:5}[e.key];if(!d)return;e.preventDefault();for(let n=at+d;n>=0&&n<25;n+=d)if(!cells[n].disabled){cells[n].focus();break;}});
}
boardEl.addEventListener('pointerleave',()=>{if(!boardPress.active())clearPreview();});
function setPhysics(settings){physics=normalizePhysics(settings);clearPreview();status.textContent=t('Parámetros listos: pulsa Simular');}
function loadScene(name){if(busy)return;const scene=laboratoryScene(name,state);draft=scene.state;triggerId=scene.triggerId;experiment=structuredClone(draft);editing=true;lab.setEditing(true);clearPreview();piecesEl.replaceChildren();renderBoard(draft.board);renderTray();lab.showStats(draft.board,0,true);showScore(draft.score);status.textContent=t('Escena preparada: pulsa Simular');}
function toggleEditing(){if(busy)return;editing=!editing;if(editing){draft=structuredClone(state);experiment=null;}else{draft=null;experiment=null;triggerId=null;showScore(state.score);}lab.setEditing(editing);clearPreview();renderBoard(editing?draft.board:state.board);renderTray();lab.showStats(editing?draft.board:state.board,0,editing);status.textContent=editing?t('Toca casillas con el pincel; después, Simular'):t('Elige un color y toca un hueco.');}
async function applyExperiment(){if(busy)return;const base=structuredClone(editing?draft:experiment||state);experiment=structuredClone(base);const result=resolveBoard(base.board,physics,{triggerId:triggerId??base.board.filter(Boolean).at(-1)?.id});editing=false;draft=null;lab.setEditing(false);state={...base,board:result.board,score:base.score+result.total,over:result.board.every(Boolean),endReason:result.board.every(Boolean)?'full':null};selected=state.tray.findIndex(Boolean);await animate(result,base.score,null,base.board);}
function openMenu(over=state.over){
  clearPreview();const holes=state.board.filter(p=>!p).length;
  menu.dataset.mode=over?'over':'pause';
  $('#menu-title').textContent=over?t('Fin de la partida'):t('En pausa');
  $('#menu-copy').textContent=over?t('Ya no hay líneas posibles.'):t('Tu partida sigue aquí.');
  writeScore($('#menu-score'),state.score,language);writeScore($('#menu-best'),personalBest.get(),language);
  $('#menu-turns').textContent=over?t(holes===1?' · {n} hueco libre':' · {n} huecos libres',{n:holes}):'';
  $('#end-explanation').hidden=!over;$('#end-explanation').textContent=holes?t('Has terminado antes de llenar el tablero.'):t('El tablero está lleno y no quedan líneas.');
  $('#continue').hidden=over;$('#view-board').hidden=!over;$('#menu-close').hidden=over;
  $('#new-game').className=over?'primary':'secondary';if(!menu.open)menu.showModal();
  fitScores();
  refreshRevive();
}
async function refreshRevive(){
  const button=$('#revive'),copy=$('#revive-copy'),current=state;
  button.hidden=true;copy.hidden=true;
  renderMembership();
  if(!IS_MAIN||!state.over||reviveStatus(state)!=='available')return;
  if(ads.supported('rewarded')){
    if(state!==current||!state.over||!menu.open)return;
    button.hidden=false;copy.hidden=false;
  }
}
function selectReviveTile(kind='revive'){
  removalKind=kind;
  removingForRevive=true;menu.close();clearPreview();
  renderBoard(state.board);renderTray();status.textContent=t('Elige un bloque del tablero para eliminarlo.');
}
async function finishRevive(at){
  if(!state.board[at])return;
  state=removalKind==='remove'?removeForCredit(state,at):removeForRevive(state,at);removingForRevive=false;persist();
  busy=true;renderBoard(state.board);renderTray();$('#pause').disabled=true;
  state=applyLineCheck(state,await checkLines(state,physics));persist();busy=false;
  renderBoard(state.board);renderTray();$('#pause').disabled=false;
  status.textContent=t('Bloque eliminado. Puedes continuar.');
  if(state.over)openMenu(true);
}
$('#revive').addEventListener('click',async()=>{
  if(busy||!IS_MAIN||!state.over||reviveStatus(state)!=='available')return;
  const current=state;
  if(!await ads.ready('rewarded')||state!==current||busy){$('#menu-copy').textContent=t('Ahora no hay vídeos disponibles. Inténtalo más tarde.');return;}
  state=beginRevive(state);persist();busy=true;
  for(const id of ['#revive','#new-game','#view-board','#menu-help'])$(id).disabled=true;
  const result=await ads.show('rewarded',()=>{state=settleRevive(state,{shown:true,earned:true});persist();},()=>adCadence.noteFullscreen());
  state=settleRevive(state,result);persist();busy=false;
  for(const id of ['#revive','#new-game','#view-board','#menu-help'])$(id).disabled=false;
  if(reviveStatus(state)==='earned')selectReviveTile();
  else {$('#menu-copy').textContent=t('No se ha completado el anuncio.');refreshRevive();}
});
const membership=$('#membership');
function renderMembership(){
  const member=subscriptions.snapshot(),credit=$('#credit-removal');
  $('#membership-open').hidden=!IS_MAIN;
  $('#membership-upgrade').hidden=!IS_MAIN||!member.active||member.unlimited||member.balance>0||reviveStatus(state)!=='available';
  const retry=blockRemovalStatus(state)==='pending';
  credit.hidden=!IS_MAIN||(state.over&&!retry)||!(retry||blockRemovalStatus(state)==='available'&&(member.balance>0||member.unlimited)&&state.board.some(Boolean));
  const paidRetry=reviveStatus(state)==='pending'&&state.reviveSource==='paid';
  $('#paid-revive').hidden=!IS_MAIN||!state.over||!(paidRetry||reviveStatus(state)==='available'&&(member.unlimitedRevives||member.revivesRemaining>0));
  $('#paid-revive').textContent=t(paidRetry?'Recuperar revivir pendiente':'Revivir · incluido en tu plan');
  credit.textContent=t(retry?'Recuperar bloque pendiente':'Eliminar un bloque');
  $('#membership-balance').hidden=!subscriptions.enabled();
  $('#membership-balance').textContent=member.unlimited?t('Eliminar un bloque por partida · ilimitado'):t('Bloques que puedes eliminar: {n}',{n:member.balance});
  $('#membership-revives').hidden=!subscriptions.enabled();
  $('#membership-revives').textContent=member.unlimitedRevives?t('Un revivir incluido por partida'):t('Revivires incluidos disponibles hoy: {n}',{n:member.revivesRemaining});
  $('#membership-state').textContent=t(!subscriptions.enabled()?'Próximamente. Todavía no se puede comprar.':!member.available?'No se pudo conectar con la tienda. Inténtalo de nuevo.':member.active?'Suscripción activa · sin anuncios automáticos':'Elige tu suscripción');
  const plans=$('#membership-plans');plans.replaceChildren();
  if(!subscriptions.enabled())for(const plan of MONTHLY_PLAN_PREVIEW){
    const card=document.createElement('div');card.className='membership-plan';
    const price=document.createElement('strong'),allowance=document.createElement('span');
    price.textContent=t('{price}/mes',{price:new Intl.NumberFormat(document.documentElement.lang,{style:'currency',currency:'EUR'}).format(plan.priceCents/100)});
    allowance.textContent=planBenefit(plan);
    card.append(price,allowance);plans.append(card);
  }
  for(const plan of member.products){
    const button=document.createElement('button');button.className='secondary';button.type='button';
    button.textContent=`${plan.name} · ${t('{price}/mes',{price:plan.price})} · ${planBenefit(MONTHLY_PLAN_PREVIEW.find(p=>p.productId===plan.id)||plan)}`;
    button.disabled=!member.available;button.addEventListener('click',()=>membershipAction(()=>subscriptions.purchase(plan.id)));plans.append(button);
  }
  $('#membership-restore').disabled=!subscriptions.enabled();$('#membership-manage').disabled=!subscriptions.enabled();
  $('#membership-terms').hidden=!member.products.length;
}
function planBenefit(plan){
  const blocks=plan.unlimited?t('Elimina un bloque por partida'):t('Elimina hasta {n} bloques al mes',{n:plan.monthlyRemovals});
  const revive=plan.dailyRevives===null?t('Un revivir por partida'):plan.dailyRevives===1?t('Un revivir al día'):plan.dailyRevives?t('{n} revivires al día',{n:plan.dailyRevives}):t('Sin revivires incluidos');
  return `${blocks} · ${revive}`;
}
let preloadingInterstitial=false;
async function syncAutomaticAds(){
  if(!IS_MAIN)return;
  await ads.banner(adCadence.bannerAllowed()&&!subscriptions.suppressAutomaticAds());
  if(adCadence.canPreload()&&!preloadingInterstitial){
    preloadingInterstitial=true;
    try{await ads.ready('interstitial');}finally{preloadingInterstitial=false;}
  }
}
// Native consent initialization can finish after initial membership rendering.
addEventListener('imanto-ads-initialized',()=>{if(IS_MAIN)void syncAutomaticAds();});
function fitScores(){for(const id of ['#score','#best-score','#menu-score','#menu-best'])fitScore($(id));}
addEventListener('resize',fitScores);
async function syncMembership(){
  await subscriptions.refresh();renderMembership();
  await syncAutomaticAds();
}
async function membershipAction(action){
  for(const button of membership.querySelectorAll('button'))button.disabled=true;
  const result=await action();await syncMembership();
  $('#membership-close').disabled=false;
  if(!result.ok)$('#membership-state').textContent=t(result.reason==='pending'?'Compra pendiente de aprobación.':result.reason==='cancelled'?'Compra cancelada.':'No se pudo completar. Inténtalo de nuevo.');
  if(menu.open)refreshRevive();
}
const openMembership=async()=>{renderMembership();membership.showModal();await syncMembership();};
$('#membership-open').addEventListener('click',openMembership);
$('#membership-upgrade').addEventListener('click',openMembership);
$('#membership-close').addEventListener('click',()=>membership.close());
$('#membership-restore').addEventListener('click',()=>membershipAction(()=>subscriptions.restore()));
$('#membership-manage').addEventListener('click',()=>membershipAction(()=>subscriptions.manage()));
addEventListener('imanto-subscription-changed',()=>syncMembership());
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&IS_MAIN)syncMembership();});
$('#credit-removal').addEventListener('click',async()=>{
  if(busy||!IS_MAIN)return;
  if(blockRemovalStatus(state)==='available')state=beginCreditRemoval(state);
  if(blockRemovalStatus(state)!=='pending')return;
  persist();busy=true;
  for(const id of ['#credit-removal','#revive','#new-game','#view-board','#continue','#menu-close','#membership-open'])$(id).disabled=true;
  const claim=await subscriptions.claim(state.gameId);
  state=settleCreditRemoval(state,claim);persist();busy=false;
  for(const id of ['#credit-removal','#revive','#new-game','#view-board','#continue','#menu-close','#membership-open'])$(id).disabled=false;
  if(blockRemovalStatus(state)==='earned')selectReviveTile('remove');
  else {$('#menu-copy').textContent=t(claim.denied?'No te quedan bloques para eliminar con tu saldo. Puedes cambiar de plan.':'Ayuda pendiente de confirmar. Vuelve a intentarlo para recuperarla.');refreshRevive();}
});
$('#paid-revive').addEventListener('click',async()=>{
  if(busy||!IS_MAIN||!state.over)return;
  if(reviveStatus(state)==='available')state=beginPaidRevive(state);
  if(reviveStatus(state)!=='pending'||state.reviveSource!=='paid')return;
  persist();busy=true;
  for(const button of menu.querySelectorAll('button'))button.disabled=true;
  const result=await subscriptions.claim(state.gameId,'revive');
  state=settlePaidRevive(state,result);persist();busy=false;
  for(const button of menu.querySelectorAll('button'))button.disabled=false;
  if(reviveStatus(state)==='earned')selectReviveTile();else refreshRevive();
});
$('#pause').addEventListener('click',()=>openMenu());$('#continue').addEventListener('click',()=>menu.close());menu.addEventListener('cancel',e=>{if(state.over)e.preventDefault();});
$('#menu-close').addEventListener('click',()=>menu.close());
$('#view-board').addEventListener('click',()=>{if(reviveStatus(state)==='earned'){selectReviveTile();return;}menu.close();status.textContent=t('Partida terminada · no quedan líneas posibles');});
async function restartGame(){
  if(busy)return;
  if(restartConfirm.open)restartConfirm.close();
  if(IS_EFFECTS){menu.close();prepareDemo();return;}
  if(IS_MAIN&&state.over){
    identifyGame();adCadence.finish(state.gameId);
    if(adCadence.due()){
      busy=true;$('#new-game').disabled=true;
      if(await ads.available('interstitial'))await ads.show('interstitial',undefined,()=>adCadence.shown());
      busy=false;$('#new-game').disabled=false;
    }
  }
  celebration.finish();state=VARIANT?loadComparison(variantId,storage,Math.random,{restart:true}):createGame(Math.random,physics);
  identifyGame();removingForRevive=false;
  clearTimeout(statusTimer);selected=0;editing=false;draft=null;experiment=null;triggerId=null;lab?.setEditing(false);persist();menu.close();clearPreview();piecesEl.replaceChildren();renderBoard(state.board);renderTray();showScore(0);$('#bonus').classList.remove('show');lab?.showStats(state.board);status.textContent=idleMessage();
  if(IS_MAIN)void syncAutomaticAds();
}
$('#new-game').addEventListener('click',()=>{if(!IS_EFFECTS&&!IS_LAB&&!VARIANT&&!state.over){menu.close();restartConfirm.showModal();return;}restartGame();});
$('#restart-yes').addEventListener('click',restartGame);
$('#restart-no').addEventListener('click',()=>{restartConfirm.close();menu.close();});$('#restart-close').addEventListener('click',()=>{restartConfirm.close();openMenu(false);});
restartConfirm.addEventListener('cancel',()=>queueMicrotask(()=>openMenu(false)));
const openHelp=()=>{clearPreview();help.showModal();};$('#menu-help').addEventListener('click',openHelp);$('#close-help').addEventListener('click',()=>help.close());
$('#help-close-icon').addEventListener('click',()=>help.close());
renderBoard(state.board);renderTray();showScore(state.score);lab?.showStats(state.board);persist();
if(migrated&&!IS_MAIN)status.textContent=t('Partida elegida conservada · sin desvíos');
async function checkInitial(){
  busy=true;renderBoard(state.board);renderTray();$('#pause').disabled=true;effectRoom?.setBusy(true);setQuickBusy(true);boardEl.setAttribute('aria-busy','true');status.textContent=t('Comprobando líneas posibles…');
  state=applyLineCheck(state,await checkLines(state,physics));persist();busy=false;
  renderBoard(state.board);renderTray();$('#pause').disabled=false;effectRoom?.setBusy(false);setQuickBusy(false);boardEl.setAttribute('aria-busy','false');
  status.textContent=state.over?t('No quedan líneas posibles'):idleMessage();
  if(IS_MAIN&&reviveStatus(state)==='earned')selectReviveTile();
  else if(IS_MAIN&&blockRemovalStatus(state)==='earned')selectReviveTile('remove');
  else if(state.over)openMenu(true);
  else if(!IS_EFFECTS&&!IS_LAB&&!VARIANT){
    const screen=new URLSearchParams(location.search).get('screen');
    if(screen==='pause')openMenu(false);if(screen==='help')help.showModal();if(screen==='restart')restartConfirm.showModal();
  }
}
if(!IS_LAB&&(!IS_EFFECTS||effectParam==='1'))checkInitial();

function prepareDemo(kind=demoKind){
  if(busy)return;demoKind=Object.hasOwn(DEMOS,kind)?kind:demoKind;
  const scene=effectScene(demoKind);state=scene.state;selected=scene.option;demoAt=scene.at;
  celebration.finish();clearPreview();clearTimeout(bonusTimer);$('#bonus').classList.remove('show');
  piecesEl.replaceChildren();renderBoard(state.board);renderTray();showScore(state.score);
  effectRoom.setKind(demoKind);status.textContent=demoKind==='dead'?t('Coloca miel en fila 2, columna 2, o reproduce'):demoKind==='escape'?t('Tu tablero preparado · reproduce las siete jugadas'):t('Prueba preparada · coloca en el centro o reproduce');persist();
  document.querySelector('.game').scrollIntoView({behavior:'auto',block:'start'});
  return scene;
}
async function playDemo(kind=demoKind){
  if(busy)return;const scene=prepareDemo(kind);
  for(const step of scene.moves||[{at:demoAt}]){
    if(state.over)return;
    if(step.color){selected=state.tray.findIndex(p=>p?.color===step.color);if(selected<0)throw Error('La demostración requiere una ficha que no está en la tanda');renderTray();}
    await place(step.at);
  }
}
if(IS_EFFECTS){
  effectRoom.setKind(demoKind);
  if(effectParam==='1')$('#effect-copy').textContent=t('Tu partida de pruebas se conserva. Los botones preparan otra escena.');
  if(!IS_CAPTURE&&Object.hasOwn(DEMOS,effectParam))requestAnimationFrame(()=>requestAnimationFrame(()=>playDemo(demoKind)));
}
initializeLanguage();
if(IS_MAIN)syncMembership();
