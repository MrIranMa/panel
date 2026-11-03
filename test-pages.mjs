import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import installer,{runInstallation,PAGES_TOKEN_TEMPLATE} from './src/installer.js';
const original=globalThis.fetch,source=fs.readFileSync('worker-single-file.js');
const token='cloudflare_pages_token_01234567890123456789',account='a'.repeat(32),namespace='b'.repeat(32);
const release={tag_name:'2.5.3',assets:[{name:'worker-single-file.js',size:source.length,digest:'sha256:'+createHash('sha256').update(source).digest('hex'),browser_download_url:'https://github.com/youdidking/NightLine/releases/download/2.5.3/worker-single-file.js'}]};
let calls=[],mode='success',projectName,seeded=false,events=[];
globalThis.fetch=async(url,options={})=>{
 const u=new URL(url),method=options.method||'GET';calls.push([method,u.pathname]);
 if(u.hostname==='api.github.com'||u.hostname==='github.com'){assert(!options.headers.authorization);return u.hostname==='api.github.com'?Response.json(release):new Response(source);}
 if(u.hostname.endsWith('.pages.dev'))return Response.json({ok:true,version:mode==='health-mismatch'?'9.9.9':'2.5.3',initialized:true});
 assert.equal(options.headers.authorization,'Bearer '+token);
 let result={};
 if(u.pathname==='/client/v4/accounts')result=[{id:account}];
 else if(u.pathname.endsWith('/storage/kv/namespaces')&&method==='POST')result={id:namespace};
 else if(u.pathname.includes('/values/')){assert(!options.body.includes(token));seeded=true;}
 else if(u.pathname.endsWith('/pages/projects')&&method==='POST'){
  assert(seeded,'Admin must exist before Pages is public');const config=JSON.parse(options.body);projectName=config.name;
  assert.match(projectName,/^nightline-free-[a-f0-9]{12}$/);assert.equal(config.production_branch,'main');
  for(const env of ['production','preview']){assert.equal(config.deployment_configs[env].kv_namespaces.KV.namespace_id,namespace);assert.equal(config.deployment_configs[env].env_vars.SETUP_LOCKED.value,'true');}
  if(mode==='create-failure')return Response.json({success:false},{status:403});
  result={name:projectName};
 }else if(u.pathname.endsWith('/deployments')&&method==='POST'){
  assert.equal(options.body.get('manifest'),'{}');assert.equal(options.body.get('branch'),'main');
  const worker=options.body.get('_worker.js');assert(worker);assert.equal(worker.type,'application/javascript+module');assert.equal(await worker.text(),source.toString());
  if(mode==='upload-failure'||mode==='cleanup-failure')return Response.json({success:false},{status:500});
  result={id:'test-deployment',latest_stage:{name:'deploy',status:mode==='stage-failure'?'failure':mode==='pending'?'active':'success'}};
 }else if(u.pathname.endsWith('/deployments/test-deployment')&&method==='GET'){result={id:'test-deployment',latest_stage:{name:'deploy',status:'success'}};
 }else if(u.pathname.includes('/pages/projects/')&&method==='DELETE'){
  if(mode==='cleanup-failure')return Response.json({success:false},{status:500});
 }else if(u.pathname.includes('/workers/'))throw Error('Pages must not create a Worker or require workers.dev');
 return Response.json({success:true,result});
};
try{
 const keys=JSON.parse(new URL(PAGES_TOKEN_TEMPLATE).searchParams.get('permissionGroupKeys'));
 assert(keys.some(p=>p.key==='page'&&p.type==='edit'));assert(!keys.some(p=>p.key==='workers_scripts'));
 let result=await runInstallation(token,e=>events.push(e),undefined,{},'pages');assert.equal(result.ok,true,result.error);assert.equal(result.target,'pages');assert.equal(result.verified,true);assert.equal(result.url,'https://'+projectName+'.pages.dev/panel');assert.equal(result.password.length,48);
 assert.equal(events.filter(e=>e.state==='done').length,7);assert(!JSON.stringify(events).includes(token));
 mode='pending';calls=[];result=await runInstallation(token,()=>{},undefined,{},'pages');assert.equal(result.ok,true);assert(calls.some(c=>c[0]==='GET'&&c[1].endsWith('/deployments/test-deployment')),'Poll pending deployment');
 mode='health-mismatch';result=await runInstallation(token,()=>{},undefined,{},'pages');assert.equal(result.ok,true);assert.equal(result.verified,false,'Do not claim verified installation on a wrong health version');
 for(mode of ['upload-failure','stage-failure']){calls=[];result=await runInstallation(token,()=>{},undefined,{},'pages');assert.equal(result.ok,false);const projectDelete=calls.findIndex(c=>c[0]==='DELETE'&&c[1].includes('/pages/projects/')),kvDelete=calls.findIndex(c=>c[0]==='DELETE'&&c[1].endsWith('/storage/kv/namespaces/'+namespace));assert(projectDelete>=0&&kvDelete>projectDelete,'Delete only owned Pages project before its KV');}
 for(mode of ['cleanup-failure','create-failure']){calls=[];result=await runInstallation(token,()=>{},undefined,{},'pages');assert.equal(result.ok,false);assert(result.error.includes('Pages'));assert(!calls.some(c=>c[0]==='DELETE'&&c[1].includes('/storage/kv/namespaces/')),'Preserve KV when project ownership/cleanup is uncertain');}
 calls=[];const response=await installer.fetch(new Request('https://installer.example/install',{method:'POST',headers:{origin:'https://installer.example','content-type':'application/json'},body:JSON.stringify({token,target:'invalid'})}));assert.equal(response.status,400);assert.equal(calls.length,0);
 console.log('PASS Pages installation: permissions, full ESM upload, empty asset manifest, production/preview KV + setup lock, seeded admin, pages.dev result, seven stages, deployment failure rollback and conservative cleanup. CF API is mocked.');
}finally{globalThis.fetch=original;}
