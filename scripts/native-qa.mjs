import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:30*1024*1024});if(r.status!==0){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');throw Error(cmd+' failed');}return r.stdout;};
const devices=JSON.parse(run('xcrun',['simctl','list','devices','available','-j'])).devices;
const all=Object.values(devices).flat();
fs.mkdirSync('artifacts/qa',{recursive:true});
for(const kind of ['iPhone','iPad']){
 const d=all.find(d=>d.name.startsWith(kind));if(!d)throw Error('No '+kind+' simulator');
 if(d.state!=='Booted')run('xcrun',['simctl','boot',d.udid]);
 run('xcrun',['simctl','bootstatus',d.udid,'-b']);
 const output=run('xcodebuild',['test','-project','ios/Imanto.xcodeproj','-scheme','Imanto','-destination',`platform=iOS Simulator,id=${d.udid}`,'-derivedDataPath','artifacts/DerivedData','-resultBundlePath',`artifacts/qa/${kind}.xcresult`,'CODE_SIGNING_ALLOWED=NO']);
 fs.writeFileSync(`artifacts/qa/${kind}-tests.log`,output);
 const app='artifacts/DerivedData/Build/Products/Debug-iphonesimulator/Imanto.app';
 run('xcrun',['simctl','install',d.udid,app]);
 run('xcrun',['simctl','launch',d.udid,'com.krazel.imanto']);
 await new Promise(r=>setTimeout(r,2000));
 run('xcrun',['simctl','io',d.udid,'screenshot',`artifacts/qa/${kind}.png`]);
 console.log(kind+' simulator: production offline runtime, placement, menu and native audio tests passed');
 run('xcrun',['simctl','shutdown',d.udid]);
}
