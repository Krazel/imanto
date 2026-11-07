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
  if(result.error)throw result.error;
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
    '--wifiBars','3','--cellularMode',kind==='iphone'?'active':'notSupported','--cellularBars','4',
    '--batteryState','discharging','--batteryLevel','100']);
  const args=['-project','ios/Imanto.xcodeproj','-scheme','Imanto','-destination',
    `platform=iOS Simulator,arch=${process.arch==='arm64'?'arm64':'x86_64'},id=${id}`,'-derivedDataPath',derived,
    '-parallel-testing-enabled','NO','-only-testing:ImantoTests/StoreMediaCapture','CODE_SIGNING_ALLOWED=NO'];
  console.log('Building store capture for',device.name);
  const buildLogPath=path.join(output,kind+'-build.log');
  const buildLog=fs.openSync(buildLogPath,'w');
  const build=spawn('xcodebuild',['build-for-testing','-quiet',...args],{stdio:['ignore',buildLog,buildLog]});
  fs.closeSync(buildLog);
  const buildStatus=await finish(build);
  assert.equal(buildStatus,0,fs.readFileSync(buildLogPath,'utf8').slice(-12_000));
  run('xcrun',['simctl','install',id,derived+'/Build/Products/Debug-iphonesimulator/Imanto.app']);
  const logPath=path.join(output,kind+'-capture.log');
  const log=fs.openSync(logPath,'w');
  // XCTest may reinstall the host, invalidating the container observed before
  // test-without-building. Use the app's Documents path from the running test.
  const getDocuments=()=>{
    const logged=fs.readFileSync(logPath,'utf8').match(/^IMANTO_STORE_DOCUMENTS=(.+)$/m)?.[1]?.trim();
    if(logged&&fs.existsSync(logged))return logged;
    const result=spawnSync('xcrun',['simctl','get_app_container',id,product,'data'],{encoding:'utf8'});
    return result.status===0?path.join(result.stdout.trim(),'Documents'):null;
  };
  const test=spawn('xcodebuild',['test-without-building',...args],{stdio:['ignore',log,log]});
  const done=finish(test);
  let active=null;
  try{
    if(kind==='iphone')for(const language of languages){
      const waitFor=async suffix=>{
        const deadline=Date.now()+200_000;
        const name='store-'+language+suffix;
        do {
          const docs=getDocuments();
          const file=docs&&path.join(docs,name);
          if(file&&fs.existsSync(file))return file;
          await sleep(450);
        } while(test.exitCode===null&&Date.now()<deadline);
        throw new Error('Missing capture marker '+name);
      };
      const start=await waitFor('.start');
      const movie=path.join(output,kind+'-'+language+'-raw.mov');
      const recorderLogPath=path.join(output,kind+'-'+language+'-recorder.log');
      const recorderLog=fs.openSync(recorderLogPath,'w');
      const recorder=spawn('xcrun',['simctl','io',id,'recordVideo','--codec=h264','--force',movie],{stdio:['ignore',recorderLog,recorderLog]});
      fs.closeSync(recorderLog);
      const captured=finish(recorder);
      active=recorder;
      const recordingDeadline=Date.now()+85_000;
      while(!fs.readFileSync(recorderLogPath,'utf8').includes('Recording started')){
        assert(recorder.exitCode===null&&Date.now()<recordingDeadline,'Simulator did not start recording '+language);
        await sleep(150);
      }
      const recordingStarted=Date.now()/1000;
      fs.writeFileSync(start.replace(/\.start$/,'.ready'),'');
      await waitFor('.end');
      const timeline=JSON.parse(fs.readFileSync(start.replace(/\.start$/,'.timeline'),'utf8'));
      fs.writeFileSync(path.join(output,kind+'-'+language+'-timeline.json'),JSON.stringify({...timeline,recordingStarted},null,2)+'\n');
      recorder.kill('SIGINT');
      await captured;
      active=null;
      assert(fs.statSync(movie).size>100_000,'Native gameplay recording is empty');
    }
    assert.equal(await done,0,kind+' native capture test failed');
    receipts.push({kind,device:device.name});
    console.log('Captured both locales on',device.name);
  }finally{
    const docs=getDocuments();
    if(docs&&fs.existsSync(docs)){
      for(const name of fs.readdirSync(docs).filter(x=>/^store-(en|es)-\d{2}-.+\.png$/.test(x))){
        fs.copyFileSync(path.join(docs,name),path.join(output,kind+'-'+name));
      }
    }
    if(active)active.kill('SIGINT');
    if(test.exitCode===null)test.kill('SIGTERM');
    fs.closeSync(log);
    run('xcrun',['simctl','shutdown',id]);
  }
  const count=fs.readdirSync(output).filter(name=>name.startsWith(kind+'-store-')&&name.endsWith('.png')).length;
  assert.equal(count,8,'Missing native gameplay stills for '+kind);
}
const runtime=fs.readFileSync('ios/Web/index.html');
fs.writeFileSync(path.join(output,'capture.json'),JSON.stringify({commit:process.env.GITHUB_SHA,
  htmlSHA256:crypto.createHash('sha256').update(runtime).digest('hex'),devices:receipts,locales:languages},null,2)+'\n');
