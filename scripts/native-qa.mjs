import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const run=(cmd,args)=>{console.log('Native QA:',cmd,args.join(' '));const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:30*1024*1024});if(r.status!==0){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');throw Error(cmd+' failed ('+r.status+')');}return r.stdout;};
const devices=JSON.parse(run('xcrun',['simctl','list','devices','available','-j'])).devices;
const all=Object.values(devices).flat();
fs.mkdirSync('artifacts/qa',{recursive:true});
for(const kind of ['iPhone','iPad']){
 const d=all.find(d=>d.name.startsWith(kind));if(!d)throw Error('No '+kind+' simulator');
 if(d.state!=='Booted')run('xcrun',['simctl','boot',d.udid]);
 run('xcrun',['simctl','bootstatus',d.udid,'-b']);
 let output;
 try{output=run('xcodebuild',['test','-project','ios/Imanto.xcodeproj','-scheme','Imanto','-destination',`platform=iOS Simulator,arch=arm64,id=${d.udid}`,'-parallel-testing-enabled','NO','-maximum-concurrent-test-simulator-destinations','1','-derivedDataPath','artifacts/DerivedData','-resultBundlePath',`artifacts/qa/${kind}.xcresult`,'CODE_SIGNING_ALLOWED=NO']);}
 catch(error){spawnSync('xcrun',['xcresulttool','get','test-results','summary','--path',`artifacts/qa/${kind}.xcresult`],{stdio:'inherit'});spawnSync('xcrun',['simctl','io',d.udid,'screenshot',`artifacts/qa/${kind}-failure.png`],{stdio:'inherit'});throw error;}
 fs.writeFileSync(`artifacts/qa/${kind}-tests.log`,output);
 const container=run('xcrun',['simctl','get_app_container',d.udid,'com.krazel.imanto','data']).trim();
 const snapshot=container+'/Documents/imanto-native-qa.png';
 if(!fs.existsSync(snapshot))throw Error('Missing verified in-game WKWebView snapshot');
 fs.copyFileSync(snapshot,`artifacts/qa/${kind}.png`);
 const membership=container+'/Documents/imanto-subscription-qa.png';if(fs.existsSync(membership))fs.copyFileSync(membership,`artifacts/qa/${kind}-subscription.png`);
 const ads=container+'/Documents/imanto-ads-qa.png';if(fs.existsSync(ads))fs.copyFileSync(ads,`artifacts/qa/${kind}-ads-layout.png`);
 const app='artifacts/DerivedData/Build/Products/Debug-iphonesimulator/Imanto.app';
 run('xcrun',['simctl','install',d.udid,app]);
 run('xcrun',['simctl','launch',d.udid,'com.krazel.imanto']);
 await new Promise(r=>setTimeout(r,2000));
 run('xcrun',['simctl','io',d.udid,'screenshot',`artifacts/qa/${kind}-relaunch.png`]);
 console.log(kind+' simulator: production offline runtime, placement, menu and native audio tests passed');
 run('xcrun',['simctl','shutdown',d.udid]);
}
