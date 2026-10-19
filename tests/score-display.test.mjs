import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreText} from '../web/score-display.mjs';
test('compact score preserves exact accessible value in both languages',()=>{
  for(const language of ['en','es'])for(const value of [0,99999,999999,1_000_000,12_345_678,Number.MAX_SAFE_INTEGER]){
    const result=scoreText(value,language,{compact:true});
    assert.equal(Number(result.exact.replace(/[^0-9]/g,'')),value);
    if(value<1_000_000)assert.equal(result.text,String(value));
    else assert.ok(result.text.length<=12,result.text);
    assert.equal(scoreText(value,language).text,result.exact);
  }
});
test('score display uses locale separators and never changes the underlying number',()=>{
  assert.equal(scoreText(12345678,'es').text,'12.345.678');
  assert.equal(scoreText(12345678,'en').text,'12,345,678');
  assert.equal(scoreText(12345678,'en',{compact:true}).text,'12.3M');
});
