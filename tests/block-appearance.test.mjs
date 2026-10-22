import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,restoreGame,playTurn} from '../web/engine.mjs';
import {readBlockAppearance,nextBlockAppearance,applyBlockAppearance,blockColorName,MATERIALS,PALETTES} from '../web/block-appearance.mjs';
test('existing saves gain clean jelly without losing gameplay; appearance survives turns and reload',()=>{
 const state=createGame(()=>.3),before=structuredClone(state);
 const root={dataset:{},style:{setProperty(){}}};
 applyBlockAppearance(state,root);
 assert.deepEqual(state.blockAppearance,{material:'jelly',palette:'original'});
 assert.deepEqual(state.board,before.board);assert.deepEqual(state.tray,before.tray);
 state.blockAppearance={material:'ceramic',palette:'arcade'};
 const restored=restoreGame(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(restored.blockAppearance,state.blockAppearance);
 const next=playTurn(restored,restored.board.findIndex(x=>!x),0,()=>.2).state;
 assert.deepEqual(next.blockAppearance,state.blockAppearance);
});
test('only approved materials and complete palettes change between games, without immediate repeats',()=>{
 let previous=readBlockAppearance(null),seed=13;const materials=new Set(),palettes=new Set();
 for(let i=0;i<200;i++){
  const next=nextBlockAppearance(previous,()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32));
  assert.notEqual(next.material,previous.material);assert.notEqual(next.palette,previous.palette);
  assert(MATERIALS.includes(next.material));assert(Object.hasOwn(PALETTES,next.palette));
  materials.add(next.material);palettes.add(next.palette);previous=next;
 }
 assert.equal(materials.size,3);assert.equal(palettes.size,5);
 assert.equal(blockColorName('teal',{palette:'arcade'},'es'),'Fucsia');
 assert.equal(blockColorName('violet',{palette:'ink'},'en'),'Cobalt blue');
 assert.deepEqual(readBlockAppearance({material:'unapproved',palette:'bad'}),{material:'jelly',palette:'original'});
});
