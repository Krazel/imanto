import {createGame,restoreGame} from './engine.mjs';
import {variantSaveKey} from './variants.mjs';
export const MAIN_SAVE_KEY='krazel-imanes-main-v6';
export function loadMain(storage,random=Math.random){
  const keys=[MAIN_SAVE_KEY,variantSaveKey('no-turn'),'krazel-imanes-v5','krazel-imanes-v4','krazel-imanes-v3','krazel-imanes-v2','krazel-imanes-v1'];
  for(const key of keys){
    let saved;try{saved=restoreGame(JSON.parse(storage.getItem(key)),random);}catch{}
    if(saved){
      try{storage.setItem(MAIN_SAVE_KEY,JSON.stringify(saved));}catch{}
      return {state:saved,source:key,migrated:key!==MAIN_SAVE_KEY};
    }
  }
  return {state:createGame(random),source:null,migrated:false};
}
