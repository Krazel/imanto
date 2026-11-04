import test from 'node:test';import assert from 'node:assert/strict';
import {installTouchPolicy} from '../web/touch-policy.mjs';
test('touch decorations stay separate from keyboard navigation',()=>{
 const events={},document={documentElement:{dataset:{}},addEventListener:(name,fn)=>events[name]=fn};installTouchPolicy({document});
 events.pointerdown({pointerType:'touch'});assert.equal(document.documentElement.dataset.input,'touch');events.keydown({key:'Tab'});assert.equal(document.documentElement.dataset.input,'keyboard');
});
test('game text and icons block accidental browser actions; fields, copy regions and links remain legitimate',()=>{
 const events={},document={documentElement:{dataset:{}},addEventListener:(name,fn)=>events[name]=fn};installTouchPolicy({document});
 for(const name of ['selectstart','contextmenu','dragstart'])for(const kind of ['game','input','copy','link']){
  let prevented=false;const target={closest:s=>s==='.game,dialog'?{}:s==='a[href]'?(kind==='link'?{}:null):kind==='input'||kind==='copy'?{}:null};events[name]({target,preventDefault(){prevented=true;}});assert.equal(prevented,kind==='game');
 }
});
