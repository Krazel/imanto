import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {PLACEMENT_VARIANTS,createPlacementVariation} from '../web/sound-variation.mjs';
test('placement randomly covers five pitches with no consecutive repeats',()=>{
  let seed=42;
  const pick=createPlacementVariation(()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32));
  const seen=new Set();let previous=-1;
  for(let i=0;i<1000;i++){const index=pick();assert.ok(index>=0&&index<5);assert.notEqual(index,previous);previous=index;seen.add(index);}
  assert.equal(seen.size,5);
});
test('native and web play the same prerecorded pitch files and selected line recording',()=>{
  const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(new URL(file,import.meta.url))).digest('hex');
  for(const file of [...PLACEMENT_VARIANTS,'line-win'])assert.equal(hash(`../web/audio/${file}.wav`),hash(`../ios/Audio/${file}.wav`));
  assert.equal(hash('../web/audio/place-spring-2.wav'),'e5e672bbac7d3c256adfe210aaa815d3a879e52548880d650815c6145f33948e');
  assert.equal(hash('../web/audio/line-win.wav'),'32734cedd11f49462f89d71d1913bbe651c66a7d0db4e5971d1eccfc6fd3aa56');
});
