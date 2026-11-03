import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
const directory='.arena/pages-runtime',port=21000+Math.floor(Math.random()*300),base='http://127.0.0.1:'+port;
fs.mkdirSync(directory,{recursive:true});fs.copyFileSync('worker-single-file.js',directory+'/_worker.js');
const child=spawn('node_modules/.bin/wrangler',['pages','dev',directory,'--port',String(port),'--compatibility-date','2026-04-01','--kv','KV','--binding','SETUP_LOCKED=true'],{stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
try{
 let ready=false;for(let i=0;i<80;i++){try{const r=await fetch(base+'/health',{signal:AbortSignal.timeout(1200)});if(r.ok){ready=true;break;}}catch{}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,200));}
 assert(ready,'Pages runtime failed to start: '+logs);
 const health=await(await fetch(base+'/health')).json();assert.equal(health.ok,true);assert.equal(health.version,'2.5.3');assert.equal(health.initialized,false);
 const panel=await fetch(base+'/panel');assert.equal(panel.status,200);const html=await panel.text();assert(html.includes('NIGHTLINE'));assert(html.includes('v-admin'),'Standalone bundle must serve full panel without static assets');
 const setup=await fetch(base+'/api/setup',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({password:'TestPassword24!',firstUserName:'Test'})});assert.equal(setup.status,403,'SETUP_LOCKED must protect Pages too');
 console.log('PASS actual local Pages workerd: standalone ESM runs as _worker.js with no assets, full panel/health, KV binding and SETUP_LOCKED. Not a live Cloudflare Pages account deployment.');
}catch(e){console.error(logs.slice(-3000));throw e;}
finally{try{if(process.platform!=='win32')process.kill(-child.pid,'SIGTERM');else child.kill('SIGTERM');}catch{}}
