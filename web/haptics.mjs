// iOS uses UIKit feedback generators; unsupported browsers/devices stay silent.
export function clearHaptic(frame){
  if(!(frame?.lineCount>0))return null;
  return frame.allClear?'allClear':frame.lineCount>1?'combo':'line';
}
export function createHaptics(scope=globalThis){
  const doc=scope.document,handler=scope.webkit?.messageHandlers?.imantoHaptics;
  const supported=typeof handler?.postMessage==='function'&&scope.imantoCapabilities?.haptics===true;
  let enabled=true;
  try{enabled=JSON.parse(scope.localStorage.getItem('imanto-haptics-v1'))!==false;}catch{}
  const send=(kind,extra={})=>{try{handler?.postMessage({kind,...extra});}catch{}};
  const sync=()=>send('settings',{enabled,visible:!doc.hidden});
  const canPlay=()=>supported&&enabled&&!doc.hidden;
  const row=doc.querySelector('#haptics-row'),toggle=doc.querySelector('#haptics-enabled');
  row.hidden=!supported;toggle.checked=enabled;
  toggle.addEventListener('change',()=>{
    enabled=toggle.checked;
    try{scope.localStorage.setItem('imanto-haptics-v1',JSON.stringify(enabled));}catch{}
    sync();
  });
  doc.addEventListener('visibilitychange',sync);sync();
  return {
    prepare(){if(canPlay())send('prepare');},
    play(cue){if(canPlay()&&['place','line','combo','allClear'].includes(cue))send('play',{cue});},
    clear(frame){const cue=clearHaptic(frame);if(cue)this.play(cue);}
  };
}
