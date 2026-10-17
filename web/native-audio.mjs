// A native host supplies the handler at document start. Browsers keep HTMLAudio.
export function nativeAudioBridge(scope=globalThis){
  const handler=scope.webkit?.messageHandlers?.imantoAudio;
  if(typeof handler?.postMessage!=='function')return null;
  return {send:(kind,payload={})=>handler.postMessage({kind,...payload})};
}
