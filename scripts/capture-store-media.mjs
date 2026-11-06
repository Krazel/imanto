import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';

const output = 'artifacts/store-media';
const derived = 'artifacts/StoreDerivedData';
const product = 'com.krazel.imanto';
const languages = ['en','es'];
const run = (command,args,cwd) => {
  const result=spawnSync(command,args,{cwd,encoding:'utf8',maxBuffer:32*1024*1024});
  if(result.status!==0)throw new Error(command+' '+args[0]+' failed\n'+result.stdout+'\n'+result.stderr);
  return result.stdout.trim();
};
const finish = child => new Promise((resolve,reject)=>{
  child.once('error',reject);
  child.once('exit',code=>resolve(code));
});
fs.mkdirSync(output,{recursive:true});
fs.copyFileSync('scripts/StoreMediaCapture.swift','ios/Tests/StoreMediaCapture.swift');
run('xcodegen',['generate','--spec','project.store.yml'],'ios');
const devices = Object.values(JSON.parse(run('xcrun',['simctl','list','devices','available','-j'])).devices).flat();
const targets = [
  ['iphone',devices.find(x=>x.name==='iPhone 17 Pro')??devices.find(x=>x.name==='iPhone 16 Pro')],
  ['ipad',devices.find(x=>x.name.startsWith('iPad Pro 13-inch'))],
];
assert(targets.every(([,device])=>device),'Required iPhone and 13-inch iPad simulators');
const receipts=[];
for(const [kind,device] of targets){
  const id=device.udid;
  if(device.state!=='Booted')run('xcrun',['simctl','boot',id]);
  run('xcrun',['simctl','bootstatus',id,'-b']);
  run('xcrun',['simctl','status_bar',id,'override','--time','9:41','--dataNetwork','wifi','--wifiMode','active',
    '--wifiBars','3','--cellularMode','active','--cellularBars','4','--batteryState','unplugged','--batteryLevel','100']);
  const args=['-project','ios/Imanto.xcodeproj','-scheme','Imanto','-destination',
    `platform=iOS Simulator,arch=${process.arch==='arm64'?'arm64':'x86_64'},id=${id}`,'-derivedDataPath',derived,
    '-parallel-testing-enabled','NO','-only-testing:ImantoTests/StoreMediaCapture','CODE_SIGNING_ALLOWED=NO'];
  console.log('Building store capture for',device.name);
  run('xcodebuild',['build-for-testing',...args]);
  run('xcrun',['simctl','install',id,derived+'/Build/Products/Debug-iphonesimulator/Imanto.app']);
  const container=run('xcrun',['simctl','get_app_container',id,product,'data']);
  const docs=path.join(container,'Documents');
  fs.mkdirSync(docs,{recursive:true});
  const log=fs.openSync(path.join(output,kind+'-capture.log'),'w');
  const test=spawn('xcodebuild',['test-without-building',...args],{stdio:['ignore',log,log]});
  const done=finish(test);
  let active=null;
  try{
    if(kind==='iphone')for(const language of languages){
      const base=path.join(docs,'store-'+language);
      const waitFor=async file=>{
        const deadline=Date.now()+160_000;
        while(!fs.existsSync(file)){
          assert(test.exitCode===null&&Date.now()<deadline,'Missing capture marker '+path.basename(file));
          await sleep(100);
        }
      };
      await waitFor(base+'.start');
      const movie=path.join(output,kind+'-'+language+'-raw.mov');
      const recorder=spawn('xcrun',['simctl','io',id,'recordVideo','--codec=h264','--force',movie],{stdio:['ignore',log,log]});
      const captured=finish(recorder);
      active=recorder;
      await sleep(800);
      fs.writeFileSync(base+'.ready','');
      await waitFor(base+'.end');
      recorder.kill('SIGINT');
      await captured;
      active=null;
      assert(fs.statSync(movie).size>100_000,'Native gameplay recording is empty');
    }
    assert.equal(await done,0,kind+' native capture test failed');
    for(const name of fs.readdirSync(docs).filter(x=>/^store-(en|es)-\d{2}-.+\.png$/.test(x))){
      fs.copyFileSync(path.join(docs,name),path.join(output,kind+'-'+name));
    }
    receipts.push({kind,device:device.name});
    console.log('Captured both locales on',device.name);
  }finally{
    if(active)active.kill('SIGINT');
    if(test.exitCode===null)test.kill('SIGTERM');
    fs.closeSync(log);
    run('xcrun',['simctl','shutdown',id]);
  }
}
const runtime=fs.readFileSync('ios/Web/index.html');
fs.writeFileSync(path.join(output,'capture.json'),JSON.stringify({commit:process.env.GITHUB_SHA,
  htmlSHA256:crypto.createHash('sha256').update(runtime).digest('hex'),devices:receipts,locales:languages},null,2)+'\n');
