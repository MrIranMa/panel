import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fetchLatestBundle,sha256} from './src/releases.js';
const original=globalThis.fetch,bytes=fs.readFileSync('worker-single-file.js'),hash=await sha256(bytes),commit='a'.repeat(40);
let mode='release',requests=[];
const release=()=>({tag_name:'v2.6.0',assets:[{name:'worker-single-file.js',size:bytes.length,digest:'sha256:'+hash,browser_download_url:mode==='foreign'?'https://evil.example/worker.js':'https://github.com/youdidking/NightLine/releases/download/v2.6.0/worker-single-file.js'}]});
globalThis.fetch=async(url,options)=>{
 requests.push(url);assert(!options.headers.authorization);assert.equal(options.credentials,undefined);
 const u=new URL(url);
 if(u.pathname.endsWith('/releases/latest')){
  if(mode==='rate')return new Response('',{status:403});
  if(mode==='fallback')return new Response('',{status:404});
  const r=release();if(mode==='no-digest')delete r.assets[0].digest;if(mode==='oversize')r.assets[0].size=9*1024*1024;
  return Response.json(r);
 }
 if(u.hostname==='github.com'){
  const data=Buffer.from(bytes);if(mode==='tamper')data[20]^=1;return new Response(data);
 }
 if(u.pathname.endsWith('/repos/youdidking/NightLine'))return Response.json({default_branch:'main'});
 if(u.pathname.includes('/commits/'))return Response.json({sha:commit});
 if(u.hostname==='raw.githubusercontent.com'){
  assert(u.pathname.includes('/'+commit+'/'),'Fallback source must be commit-pinned');
  if(u.pathname.endsWith('/package.json'))return Response.json({version:'2.7.1'});
  return new Response(bytes);
 }
 throw Error('Unexpected official request: '+url);
};
try{
 let result=await fetchLatestBundle();assert.equal(result.version,'2.6.0','Version must follow downloaded release, not installer build');assert.equal(result.sha256,hash);assert.equal(result.verifiedHash,true);
 mode='no-digest';result=await fetchLatestBundle();assert.equal(result.sha256,hash);assert.equal(result.verifiedHash,true);
 mode='fallback';result=await fetchLatestBundle();assert.equal(result.version,'2.7.1');assert.equal(result.ref,commit);assert.equal(result.verifiedHash,false);
 for(const [test,pattern] of [['tamper',/هش/],['foreign',/مخزن رسمی/],['oversize',/سقف مجاز/],['rate',/403/]]){mode=test;requests=[];await assert.rejects(fetchLatestBundle(),pattern);assert(!requests.some(u=>u.includes('evil.example')));if(test==='rate')assert.equal(requests.length,1,'No silent fallback on rate limit');}
 console.log('PASS official downloader: dynamic release version, SHA-256 tamper rejection, no-digest source comparison, immutable branch fallback, origin/size/rate guards and no CF credential disclosure.');
}finally{globalThis.fetch=original;}
