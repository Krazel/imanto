import * as five from './engine.mjs';
import * as six from './six-lab/engine.mjs';
import * as fiveSearch from './line-search.mjs';
import * as sixSearch from './six-lab/line-search.mjs';

export function createBoardMode(size=5){
  const isSix=size===6,engine=isSix?six:five;
  return {...engine,size:isSix?6:5,isSix,
    saveKey:isSix?'imanto-six-game-v1':'krazel-imanes-main-v6',
    bestKey:isSix?'imanto-six-best-v1':'imanto-best-v1',
    timeKey:isSix?'imanto-six-time-v1':'imanto-game-time-v1',
    async checkLines(state,physics){
      if(!isSix)return fiveSearch.checkLines(state,physics);
      const search=sixSearch.searchLines(state,physics),deadline=performance.now()+1800;
      while(true){const until=performance.now()+8;let step;do{step=search.next();if(step.done)return step.value;}while(performance.now()<until);
        // A search limit is never evidence of defeat. Keep the game playable.
        if(performance.now()>=deadline)return {unknown:true};
        await new Promise(resolve=>setTimeout(resolve,0));
      }
    },
    applyLineCheck(state,result){return result.unknown?state:(isSix?sixSearch:fiveSearch).applyLineCheck(state,result);}
  };
}
