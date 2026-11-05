import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MATERIALS} from '../web/block-appearance.mjs';

const read=name=>fs.readFileSync(new URL(`../web/${name}`,import.meta.url),'utf8');
const materials=read('block-materials.css')+'\n'+read('block-specials.css'),effects=read('effects.css');
const surfaceProperty=/(?:^|[;{])\s*(?:background(?:-[\w-]+)?|border(?:-[\w-]+)?|box-shadow|content)\s*:/;

function keyframes(css,name){
  const start=css.indexOf(`@keyframes ${name}{`);
  assert.notEqual(start,-1,`missing ${name}`);
  const open=css.indexOf('{',start);let depth=1,end=open+1;
  for(;depth&&end<css.length;end++){
    if(css[end]==='{')depth++;
    if(css[end]==='}')depth--;
  }
  assert.equal(depth,0,`unclosed ${name}`);
  return css.slice(open+1,end-1);
}

test('every approved material keeps its surface and pseudo-elements through winning and clear',()=>{
  for(const material of MATERIALS){
    if(material.startsWith('special-')){
      assert.ok(materials.includes(`[data-block-material=${material}]`));
      assert.match(materials,/\[data-block-material\^=special-\][^{]+::before[^{}]*\{[^}]*background-image:var\(--block-sprite-atlas/);
      assert.doesNotMatch(materials,/\[data-block-material\^=special-\][^{]*(?:winning|clear)/);
      continue;
    }
    const rules=[...materials.matchAll(/(\[data-block-material=([^\]]+)\][^{]+)\{([^}]+)\}/g)].filter(match=>match[2]===material);
    assert.ok(rules.length>=2,`${material}: surface and pseudo-element rules exist`);
    for(const [,selector] of rules){
      assert.match(selector,/\.tile(?:[,:\s])/);
      assert.doesNotMatch(selector,/winning|clear/,`${material}: lifecycle classes must not disable a surface`);
    }
  }
  assert.doesNotMatch(materials,/\.tile\.winning[^{}]*\{[^}]*content\s*:\s*none/, 'winning must not suppress texture/reflections');
});

test('line, combo and all-clear animate the original material instead of overwriting its surface',()=>{
  for(const name of ['spring-line','winning-charge','winning-burst']){
    assert.doesNotMatch(keyframes(effects,name),surfaceProperty,`${name} must not repaint, flatten relief or erase texture`);
  }
  // Includes reduced-motion feedback and pseudo-element overrides, not only keyframes.
  for(const [,selector,declarations] of effects.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
    if(/\.tile[^,{]*\.(?:winning|clear)/.test(selector))assert.doesNotMatch(declarations,surfaceProperty,selector);
  }
  const charge=keyframes(effects,'winning-charge'),burst=keyframes(effects,'winning-burst');
  const end=charge.match(/100%\{([^}]+)\}/)[1].match(/filter:([^;}]+)/)[1];
  const start=burst.match(/0%\{([^}]+)\}/)[1].match(/filter:([^;}]+)/)[1];
  assert.equal(start,end,'charge and burst join without a one-frame lighting jump');
});
