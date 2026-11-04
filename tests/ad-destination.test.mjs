import test from 'node:test';
import assert from 'node:assert/strict';
import {AD_UNITS, AD_APP_ID, adDestination, verifyAdArchive} from '../scripts/ad-destination.mjs';

function archive(mode) {
  return {info:{ImantoAdsMode:mode, GADApplicationIdentifier:AD_APP_ID},
    executable:Buffer.from(Object.values(AD_UNITS[mode]).join('\0'))};
}

test('beta and commercial destinations use separate inventory and build specifications', () => {
  assert.equal(adDestination('testflight').mode, 'demo');
  assert.equal(adDestination('app-store').mode, 'production');
  assert.notEqual(adDestination('testflight').spec, adDestination('app-store').spec);
  for (const destination of [undefined, '', 'Release', 'production', 'other']) assert.throws(() => adDestination(destination));
});

test('archive check accepts all three units only for their intended destination', () => {
  for (const [destination, mode] of [['testflight','demo'], ['app-store','production']]) {
    assert.equal(verifyAdArchive({destination,...archive(mode)}).mode, mode);
  }
});

test('demo IPA cannot be promoted to commercial by relabelling its plist', () => {
  const candidate = archive('demo');
  assert.throws(() => verifyAdArchive({destination:'app-store',...candidate}), /mode does not match/);
  candidate.info.ImantoAdsMode = 'production';
  assert.throws(() => verifyAdArchive({destination:'app-store',...candidate}), /unit missing/);
});

test('commercial units cannot leak into a beta even with demo plist metadata', () => {
  const candidate = archive('demo');
  candidate.executable = Buffer.concat([candidate.executable, Buffer.from(AD_UNITS.production.rewarded)]);
  assert.throws(() => verifyAdArchive({destination:'testflight',...candidate}), /production inventory/);
});

test('commercial archive requires rewarded too and the exact Imanto AdMob app', () => {
  const candidate = archive('production');
  candidate.executable = Buffer.from([AD_UNITS.production.banner,AD_UNITS.production.interstitial].join('\0'));
  assert.throws(() => verifyAdArchive({destination:'app-store',...candidate}), /rewarded unit missing/);
  const wrongApp = archive('production');
  wrongApp.info.GADApplicationIdentifier = 'other-app';
  assert.throws(() => verifyAdArchive({destination:'app-store',...wrongApp}), /Wrong AdMob application/);
});
