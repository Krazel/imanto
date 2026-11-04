// Compile the real Foundation-only Swift source under every supported selection.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {AD_UNITS} from './ad-destination.mjs';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'imanto-ad-inventory-'));
const swift = fs.readFileSync('ios/App/AdInventory.swift', 'utf8');
const cases = [
  {name:'debug', flags:['DEBUG'], mode:'demo'},
  {name:'testflight-release', flags:['IMANTO_TESTFLIGHT'], mode:'demo'},
  {name:'store-debug', flags:['DEBUG','IMANTO_PRODUCTION'], mode:'demo'},
  {name:'store-release', flags:['IMANTO_PRODUCTION'], mode:'production'},
  {name:'unspecified-release', flags:[], mode:'disabled'},
  {name:'conflicting', flags:['IMANTO_TESTFLIGHT','IMANTO_PRODUCTION'], error:true}
];
try {
  for (const scenario of cases) {
    const units = AD_UNITS[scenario.mode] ?? {banner:'', interstitial:'', rewarded:''};
    const main = path.join(temporary, 'main.swift');
    fs.writeFileSync(main, swift + `\nprecondition(AdInventory.mode == "${scenario.mode}")\n`
      + Object.entries(units).map(([format,id]) => `precondition(AdInventory.${format} == "${id}")`).join('\n')
      + `\nprecondition(!AdInventory.enabled(bundleMode: nil))\nprecondition(!AdInventory.enabled(bundleMode: "wrong"))\nprecondition(AdInventory.enabled(bundleMode: "${scenario.mode}") == ${scenario.mode !== 'disabled'})\n`);
    const executable = path.join(temporary, process.platform === 'win32' ? 'inventory.exe' : 'inventory');
    const compile = spawnSync('swiftc', [...scenario.flags.flatMap(flag => ['-D',flag]), main, '-o', executable], {encoding:'utf8'});
    if (compile.error) throw compile.error;
    if (scenario.error) {
      assert.notEqual(compile.status, 0, 'Conflicting destinations must not compile');
      assert.match(compile.stderr, /production and TestFlight cannot be combined/);
    } else {
      assert.equal(compile.status, 0, compile.stderr);
      const result = spawnSync(executable, [], {encoding:'utf8'});
      assert.equal(result.status, 0, result.stderr);
    }
    console.log(`PASS advertising inventory: ${scenario.name}`);
  }
} finally {
  fs.rmSync(temporary, {recursive:true, force:true});
}
