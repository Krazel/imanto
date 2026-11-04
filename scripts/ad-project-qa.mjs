// Validate XcodeGen's resolved settings, including nested-spec overrides.
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {adDestination} from './ad-destination.mjs';

const run = (command, args, cwd) => {
  const result = spawnSync(command, args, {cwd, encoding:'utf8', maxBuffer:16*1024*1024});
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
};
for (const destination of ['app-store','testflight']) {
  const selection = adDestination(destination);
  run('xcodegen', ['generate','--spec',selection.spec], 'ios');
  for (const configuration of ['Debug','Release']) {
    const settings = JSON.parse(run('xcodebuild', ['-project','ios/Imanto.xcodeproj','-scheme','Imanto','-configuration',configuration,'-showBuildSettings','-json']));
    const app = settings.find(value => value.target === 'Imanto')?.buildSettings;
    assert(app, 'Missing Imanto build settings');
    assert.equal(app.IMANTO_ADS_MODE, configuration === 'Debug' ? 'demo' : selection.mode);
    const flags = new Set(app.SWIFT_ACTIVE_COMPILATION_CONDITIONS.split(/\s+/));
    assert(flags.has(destination === 'app-store' ? 'IMANTO_PRODUCTION' : 'IMANTO_TESTFLIGHT'));
    assert(!flags.has(destination === 'app-store' ? 'IMANTO_TESTFLIGHT' : 'IMANTO_PRODUCTION'), 'Conflicting destination flags after spec merge');
    assert.equal(flags.has('DEBUG'), configuration === 'Debug');
    assert(app.INFOPLIST_FILE.endsWith('App/Info.ads.plist'));
    console.log(`PASS resolved advertising project: ${destination} ${configuration}`);
  }
}
// Leaves the default beta specification generated for native transport tests.
