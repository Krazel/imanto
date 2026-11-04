import test from 'node:test';
import assert from 'node:assert/strict';
import {MATERIALS,nextBlockAppearance} from '../web/block-appearance.mjs';
import {normalizeMaterialSelection,readMaterialSelection} from '../web/material-settings.mjs';
test('old or broken preferences enable every approved material; fixed and subset choices persist safely',()=>{
 for(const value of [null,{},[],['missing']])assert.deepEqual(normalizeMaterialSelection(value),MATERIALS);
 assert.deepEqual(normalizeMaterialSelection(['wood','wood','missing']),['wood']);
 assert.deepEqual(readMaterialSelection({getItem:()=>'{bad'}),MATERIALS);
 for(let i=0;i<20;i++)assert.equal(nextBlockAppearance({material:'wood'},()=>i/20,['wood']).material,'wood');
 let prev={material:'classic'},seen=new Set();for(let i=0;i<40;i++){prev=nextBlockAppearance(prev,()=>.5,['classic','jelly']);seen.add(prev.material);}assert.deepEqual([...seen].sort(),['classic','jelly']);
});
