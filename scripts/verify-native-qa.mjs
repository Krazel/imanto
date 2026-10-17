// Reuse native QA only when all shipping source, resources and tests are identical.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const id=process.env.QA_RUN_ID,repo=process.env.GITHUB_REPOSITORY;
assert(/^\d+$/.test(id??'')&&repo==='Krazel/imanto','Exact Imanto QA run required');
const get=async endpoint=>{
 const r=await fetch(`https://api.github.com/repos/${repo}/${endpoint}`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
 assert(r.ok,`GitHub QA verification failed: ${r.status}`);return r.json();
};
const run=await get(`actions/runs/${id}`),workflow=await get('actions/workflows/native-qa.yml');
assert.equal(run.workflow_id,workflow.id);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');assert.equal(run.head_branch,'main');assert.equal(run.event,'workflow_dispatch');
assert(/^[a-f0-9]{40}$/.test(run.head_sha));
const paths=['ios','web','tests','package.json','package-lock.json','scripts/prepare-native.mjs','scripts/native-qa.mjs','scripts/native-config.json'];
const diff=spawnSync('git',['diff','--quiet',run.head_sha,process.env.GITHUB_SHA,'--',...paths]);
assert.equal(diff.status,0,'Native app, assets, packaging or test harness changed: run fresh native QA first');
fs.mkdirSync('artifacts/testflight',{recursive:true});
fs.writeFileSync('artifacts/testflight/qa-verified.json',JSON.stringify({run:id,qaCommit:run.head_sha,releaseCommit:process.env.GITHUB_SHA,shippingSourceAndHarnessIdentical:true,conclusion:run.conclusion,paths},null,2));
console.log(`Verified iPhone/iPad QA ${id}; shipping source, assets, packaging and tests match exactly.`);
