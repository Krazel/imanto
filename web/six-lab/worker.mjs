import {searchLines} from './line-search.mjs';
onmessage=({data})=>{const search=searchLines(data.state),deadline=performance.now()+1800;let step;do{step=search.next();if(performance.now()>deadline){postMessage({id:data.id,unknown:true});return;}}while(!step.done);postMessage({id:data.id,...step.value});};
