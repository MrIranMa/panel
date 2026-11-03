/* Fetch only from the official NIGHTLINE repository. Cloudflare credentials are never sent here. */
export const OFFICIAL_REPO='youdidking/NightLine';
const MAX_SOURCE=8*1024*1024;
const API='https://api.github.com';
const RAW='https://raw.githubusercontent.com';
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function limited(response,max){
  if(!response.ok)throw Error('دریافت فایل رسمی ناموفق بود: HTTP '+response.status);
  if(Number(response.headers.get('content-length'))>max)throw Error('فایل رسمی از سقف مجاز بزرگ‌تر است.');
  const reader=response.body.getReader(),parts=[];let length=0;
  try{while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>max){await reader.cancel();throw Error('فایل رسمی از سقف مجاز بزرگ‌تر است.');}parts.push(part.value);}}finally{reader.releaseLock();}
  const data=new Uint8Array(length);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.length;}return data;
}
async function get(url,accept='application/vnd.github+json'){
  try{return await fetch(url,{headers:{accept,'user-agent':'NIGHTLINE-Official-Installer'},cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(25000)});}
  catch{throw Error('ارتباط با مخزن رسمی گیتهاب برقرار نشد؛ بعداً دوباره تلاش کنید.');}
}
function version(value){const match=String(value||'').match(/^v?(\d+\.\d+\.\d+(?:-[\w.-]+)?)$/);if(!match)throw Error('شمارهٔ نسخهٔ منبع رسمی معتبر نیست.');return match[1];}
function validateModule(bytes){
  if(bytes.length<1000)throw Error('فایل دریافتی برای پنل کامل نیست.');
  const text=new TextDecoder().decode(bytes);
  if(/^\s*(?:<!doctype|<html)/i.test(text)||!(/\bexport\s*(?:default\b|\{[^}]{0,1000}\bdefault\b[^}]*\})/.test(text.slice(-5000))))throw Error('فایل دریافتی، ماژول معتبر پنل نیست.');
}
export async function fetchLatestBundle(notify=()=>{},options={}){
  // Loopback overrides are for local tests only; browser input cannot control them.
  const api=/^http:\/\/127\.0\.0\.1:\d+\/gh$/.test(options.api||'')?options.api:API;
  const raw=/^http:\/\/127\.0\.0\.1:\d+\/ghraw$/.test(options.raw||'')?options.raw:RAW;
  notify('در حال شناسایی آخرین انتشار مخزن رسمی…');
  const latest=await get(api+'/repos/'+OFFICIAL_REPO+'/releases/latest');
  let release=null;
  if(latest.status!==404){
    if(!latest.ok)throw Error('خواندن انتشارهای رسمی گیتهاب ناموفق بود: HTTP '+latest.status+(latest.status===403||latest.status===429?'؛ محدودیت نرخ گیتهاب را بررسی کنید.':''));
    release=await latest.json();
    if(release.draft||release.prerelease)throw Error('انتشار رسمی پایدار قابل دریافت نیست.');
  }
  const asset=release?.assets?.find(a=>a.name==='worker-single-file.js');
  let bytes,installedVersion,sourceURL,ref,expectedHash='';
  if(asset){
    installedVersion=version(release.tag_name);ref=release.tag_name;
    const assetURL=new URL(asset.browser_download_url);
    if(assetURL.protocol!=='https:'||assetURL.hostname!=='github.com'||!assetURL.pathname.startsWith('/'+OFFICIAL_REPO+'/releases/download/'))throw Error('نشانی فایل انتشار به مخزن رسمی تعلق ندارد.');
    if(asset.size>MAX_SOURCE)throw Error('حجم فایل انتشار بیشتر از سقف مجاز است.');
    sourceURL=assetURL.href;
    if(asset.digest){if(!/^sha256:[a-f0-9]{64}$/i.test(asset.digest))throw Error('هش فایل انتشار معتبر نیست.');expectedHash=asset.digest.slice(7).toLowerCase();}
    notify('دریافت نسخهٔ '+installedVersion+' از انتشار رسمی…');
    // Mock endpoint keeps test traffic local; no production URL can be overridden by request input.
    bytes=await limited(await get(api===API?sourceURL:api+'/release-worker','application/octet-stream'),MAX_SOURCE);
    if(asset.size&&bytes.length!==asset.size)throw Error('حجم فایل دریافتی با انتشار رسمی مطابقت ندارد.');
    if(!expectedHash){
      const commitResponse=await get(api+'/repos/'+OFFICIAL_REPO+'/commits/'+encodeURIComponent(ref));
      if(!commitResponse.ok)throw Error('تأیید commit انتشار رسمی ناموفق بود.');
      const commit=await commitResponse.json();if(!/^[a-f0-9]{40}$/.test(commit.sha||''))throw Error('شناسهٔ commit معتبر نیست.');
      const original=await limited(await get(raw+'/'+OFFICIAL_REPO+'/'+commit.sha+'/worker-single-file.js','application/javascript'),MAX_SOURCE);
      expectedHash=await sha256(original);
    }
  }else{
    notify('فایل انتشار موجود نیست؛ دریافت از آخرین commit رسمی…');
    const repoResponse=await get(api+'/repos/'+OFFICIAL_REPO);if(!repoResponse.ok)throw Error('اطلاعات مخزن رسمی خوانده نشد.');
    const repo=await repoResponse.json();if(typeof repo.default_branch!=='string'||!repo.default_branch)throw Error('شاخهٔ اصلی مخزن مشخص نیست.');
    const commitResponse=await get(api+'/repos/'+OFFICIAL_REPO+'/commits/'+encodeURIComponent(repo.default_branch));if(!commitResponse.ok)throw Error('آخرین commit رسمی پیدا نشد.');
    const commit=await commitResponse.json();if(!/^[a-f0-9]{40}$/.test(commit.sha||''))throw Error('شناسهٔ commit رسمی معتبر نیست.');
    ref=commit.sha;sourceURL=raw+'/'+OFFICIAL_REPO+'/'+ref+'/worker-single-file.js';
    const packageResponse=await get(raw+'/'+OFFICIAL_REPO+'/'+ref+'/package.json','application/json');if(!packageResponse.ok)throw Error('نسخهٔ مخزن رسمی مشخص نشد.');
    installedVersion=version((await packageResponse.json()).version);
    bytes=await limited(await get(sourceURL,'application/javascript'),MAX_SOURCE);
  }
  validateModule(bytes);const hash=await sha256(bytes);
  if(expectedHash&&hash!==expectedHash)throw Error('هش فایل دانلودشده با منبع رسمی مطابقت ندارد؛ نصب لغو شد.');
  return {source:bytes,version:installedVersion,sha256:hash,ref,sourceURL,verifiedHash:!!expectedHash};
}
