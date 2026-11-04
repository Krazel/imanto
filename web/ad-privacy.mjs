// The native layer remains authoritative. This controller also prevents the web
// UI from resuming ads after a failed or timed-out privacy change.
export function bindAdPrivacy({ads,button,status,translate,onResolved,host=globalThis}){
  let working=false,latest=null;
  const render=()=>{
    button.hidden=!latest||!(latest.required||latest.retry);
    button.disabled=working||latest?.busy===true;
  };
  const update=value=>{latest=value;render();};
  const refresh=async()=>update(await ads.privacyState());
  host.addEventListener('imanto-ad-privacy-state',event=>{
    const wasBusy=latest?.busy===true;
    update(event.detail);
    // A user may keep the native form open beyond the bridge timeout. Recover
    // only when native reports a completed, permitted transaction afterward.
    if(!working&&wasBusy&&latest?.busy===false&&latest.canRequestAds===true){
      status.hidden=true;
      void Promise.resolve(onResolved()).catch(()=>{});
    }
  });
  button.addEventListener('click',async()=>{
    if(working)return;
    working=true;status.hidden=true;render();
    let complete=false;
    try{complete=await ads.privacy();}catch{}
    working=false;
    if(!complete){status.textContent=translate('No se pudieron actualizar las opciones de privacidad. Inténtalo de nuevo.');status.hidden=false;}
    await refresh();
    if(complete)await onResolved();
  });
  return {refresh};
}
