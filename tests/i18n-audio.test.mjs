import test from 'node:test';
import assert from 'node:assert/strict';
import {EN,resolveLanguage,t} from '../web/i18n.mjs';
import {normalizeAudioSettings} from '../web/audio.mjs';
test('device Spanish uses Spanish; English and unsupported device languages default to English',()=>{
  for(const tag of ['es','es-ES','es-MX','ES-ar'])assert.equal(resolveLanguage({languages:[tag]}),'es');
  for(const tag of ['en-US','fr-FR','de',''])assert.equal(resolveLanguage({languages:[tag]}),'en');
  assert.equal(resolveLanguage(), 'en');
});
test('explicit language choice and review override take precedence over device language',()=>{
  assert.equal(resolveLanguage({preference:'en',languages:['es-ES']}),'en');
  assert.equal(resolveLanguage({preference:'es',languages:['en-US']}),'es');
  assert.equal(resolveLanguage({override:'es',preference:'en',languages:['fr']}),'es');
  assert.equal(resolveLanguage({override:'bad',preference:'auto',languages:['fr','es']}),'en');
});
test('English translations preserve every interpolation parameter and required game states',()=>{
  const keys=text=>[...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
  for(const [es,en] of Object.entries(EN)){assert.ok(en.trim());assert.deepEqual(keys(es),keys(en),es);}
  assert.equal(t('{n} fichas disponibles',{n:2}),'2 tiles left');
  assert.equal(t('Fila {row}, columna {col}, {tile}',{row:2,col:4,tile:'teal'}),'Row 2, column 4, teal');
  assert.equal(t('Fin de la partida'),'Game over');
});
test('audio settings begin with music on, respect explicit mute and clamp invalid persisted volumes',()=>{
  assert.deepEqual(normalizeAudioSettings(null),{effects:true,music:true,effectsVolume:.7,musicVolume:.15});
  assert.deepEqual(normalizeAudioSettings({effects:false,music:true,effectsVolume:7,musicVolume:-1}),{effects:false,music:true,effectsVolume:1,musicVolume:0});
  assert.equal(normalizeAudioSettings({music:'yes',effectsVolume:NaN}).music,true);
  assert.equal(normalizeAudioSettings({music:false}).music,false);
});
