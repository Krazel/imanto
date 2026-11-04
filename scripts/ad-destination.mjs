import assert from 'node:assert/strict';

export const AD_APP_ID = 'ca-app-pub-3425091654264901~2139439487';
export const AD_UNITS = Object.freeze({
  demo: Object.freeze({banner:'ca-app-pub-3940256099942544/2435281174', interstitial:'ca-app-pub-3940256099942544/4411468910', rewarded:'ca-app-pub-3940256099942544/1712485313'}),
  production: Object.freeze({banner:'ca-app-pub-3425091654264901/9778431363', interstitial:'ca-app-pub-3425091654264901/8321704454', rewarded:'ca-app-pub-3425091654264901/9990929215'})
});

export function adDestination(destination) {
  assert(destination === 'testflight' || destination === 'app-store', 'Explicit testflight or app-store destination required');
  return Object.freeze(destination === 'testflight'
    ? {destination, mode:'demo', spec:'project.ads.yml', purpose:'TestFlight', directory:'artifacts/testflight'}
    : {destination, mode:'production', spec:'project.store.yml', purpose:'AppStore', directory:'artifacts/app-store'});
}

// Run on the actual archived executable and expanded Info.plist before export/upload.
export function verifyAdArchive({destination, info, executable}) {
  const selection = adDestination(destination);
  assert.equal(info.ImantoAdsMode, selection.mode, 'Archived advertising mode does not match destination');
  assert.equal(info.GADApplicationIdentifier, AD_APP_ID, 'Wrong AdMob application');
  const bytes = Buffer.from(executable);
  const opposite = selection.mode === 'demo' ? 'production' : 'demo';
  for (const [format, id] of Object.entries(AD_UNITS[selection.mode])) {
    assert(bytes.includes(Buffer.from(id)), `Archived ${format} unit missing for ${selection.mode}`);
  }
  for (const id of Object.values(AD_UNITS[opposite])) {
    assert(!bytes.includes(Buffer.from(id)), `Archive contains ${opposite} inventory for ${selection.destination}`);
  }
  return {mode:selection.mode, appId:AD_APP_ID, units:AD_UNITS[selection.mode], executableInventoryVerified:true};
}
