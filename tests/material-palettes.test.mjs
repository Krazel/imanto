import test from 'node:test';import assert from 'node:assert/strict';
import {MATERIALS,PALETTES,applyBlockAppearance,applyBlockPalette} from '../web/block-appearance.mjs';
import {SPRITE_ATLASES} from '../web/sprite-atlases.mjs';
import fs from 'node:fs';import crypto from 'node:crypto';
import {COLORS,VIOLET_ROUND,createGame,drawHand} from '../web/engine.mjs';
import {restoreGame as restoreSix} from '../web/six-lab/engine.mjs';
import {restoreGame} from '../web/engine.mjs';

test('color progression remains three identities then four, with five complete visual palettes',()=>{
 assert.equal(COLORS.length,4);assert.equal(VIOLET_ROUND,4);assert.equal(Object.keys(PALETTES).length,5);
 const s=createGame(()=>.2);for(let round=1;round<4;round++)for(let n=0;n<10;n++)assert(drawHand(s,round,()=>n/10).every(p=>p.color!=='violet'));
 assert(drawHand(s,4,()=>.999).some(p=>p.color==='violet'));
 for(const palette of Object.values(PALETTES)){assert.equal(new Set(palette.hex).size,4);assert.equal(palette.es.length,4);assert.equal(palette.en.length,4);}
});
test('all ten materials retain all five palettes on restore and publish native palette artwork',()=>{
 assert.equal(MATERIALS.length,10);
 for(const material of MATERIALS)for(const palette of Object.keys(PALETTES)){
  const state=createGame(()=>.2);state.blockAppearance={material,palette};const original=JSON.stringify(state.board),values=new Map(),root={dataset:{},style:{setProperty:(k,v)=>values.set(k,v)}};
  applyBlockAppearance(state,root);assert.equal(root.dataset.blockMaterial,material);assert.equal(root.dataset.blockPalette,palette);assert.equal(original,JSON.stringify(state.board));
  assert.deepEqual(restoreGame(JSON.parse(JSON.stringify(state))).blockAppearance,{material,palette});
  assert.equal(restoreSix(state),null);
  for(let i=0;i<COLORS.length;i++){assert.equal(values.get(`--block-${COLORS[i]}`),PALETTES[palette].hex[i]);assert(values.get(`--atlas-${COLORS[i]}-width`).endsWith('%'));}
  assert.equal(values.get('--block-sprite-atlas'),`url("${SPRITE_ATLASES[palette].file}")`);
 }
 assert.equal(applyBlockPalette('missing',{dataset:{},style:{setProperty(){}}}),'original');
});

test('five independent PNG atlases keep Original untouched and UV windows inside each sprite image',()=>{
 assert.deepEqual(Object.keys(SPRITE_ATLASES),Object.keys(PALETTES));const hashes=new Set();
 for(const [palette,a]of Object.entries(SPRITE_ATLASES)){
  const bytes=fs.readFileSync(new URL(`../web/${a.file}`,import.meta.url));assert.equal(bytes.subarray(1,4).toString(),'PNG');const hash=crypto.createHash('sha256').update(bytes).digest('hex');hashes.add(hash);
  if(palette==='original')assert.equal(hash,'4a8f26335fdb7efc149c94af42333b9c1e715997968e1748d767b7bfd2574164');
  for(const r of Object.values(a.columns)){assert(r.x>=0&&r.width>0&&r.x+r.width<=a.width);}
  for(const r of Object.values(a.rows)){assert(r.y>=0&&r.height>0&&r.y+r.height<=a.height);}
 }
 assert.equal(hashes.size,5);
 const css=fs.readFileSync(new URL('../web/block-specials.css',import.meta.url),'utf8');assert.doesNotMatch(css,/hue-rotate|saturate|brightness|--sprite-filter/);assert.match(css,/filter:none/);
});
