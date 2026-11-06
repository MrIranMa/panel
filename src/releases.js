/* Fetch only from the official ArenaPanel repository. Cloudflare credentials are never sent here. */
export const OFFICIAL_REPO='MrIranMa/panel';
const MAX_SOURCE=8*1024*1024;
const RAW='https://raw.githubusercontent.com';
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function limited(response,max){
  if(!response.ok)throw Error('دریافت فایل رسمی ناموفق بود: HTTP '+response.status);
  if(Number(response.headers.get('content-length'))>max)throw Error('فایل رسمی از سقف مجاز بزرگ‌تر است.');
  const reader=response.body.getReader(),parts=[];let length=0;
  try{while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>max){await reader.cancel();throw Error('فایل رسمی از سقف مجاز بزرگ‌تر است.');}parts.push(part.value);}}finally{reader.releaseLock();}
  const data=new Uint8Array(length);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.length;}return data;
}
function validateModule(bytes){
  const text=new TextDecoder().decode(bytes);
  if(bytes.length<1000||/^\s*(?:<!doctype|<html)/i.test(text)||!(/\bexport\s*(?:default\b|\{[^}]{0,1000}\bdefault\b[^}]*\})/.test(text.slice(-5000))))throw Error('فایل دریافتی ساختار اولیهٔ پنل را ندارد؛ نصب متوقف شد.');
  const header=text.slice(0,250).match(/^\/\/ ArenaPanel v(\d+\.\d+\.\d+(?:-[\w.-]+)?) — Cloudflare Workers Standalone Edition(?:\r?\n|$)/);
  if(!header)throw Error('هدر و نسخهٔ فایل رسمی معتبر نیست؛ نصب متوقف شد.');
  return header[1];
}
export async function fetchLatestBundle(notify=()=>{},options={}){
  // Fixed official origin: no API dependency, token, mirror, or embedded fallback.
  // Only server-side loopback overrides are accepted for the local test suite.
  const raw=/^http:\/\/127\.0\.0\.1:\d+\/ghraw$/.test(options.raw||'')?options.raw:RAW;
  const sourceURL=RAW+'/'+OFFICIAL_REPO+'/main/worker-single-file.js';
  notify('دریافت مستقیم آخرین فایل پنل از شاخهٔ main مخزن رسمی…');
  const url=(raw===RAW?sourceURL:raw+'/'+OFFICIAL_REPO+'/main/worker-single-file.js')+'?nl_install='+crypto.randomUUID();
  let response;
  try{response=await fetch(url,{headers:{accept:'application/javascript','user-agent':'ArenaPanel-Official-Installer'},credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(25000)});}
  catch{throw Error('دانلود مستقیم فایل رسمی برقرار نشد؛ ارتباط نصب‌کننده با raw.githubusercontent.com را بررسی و کمی بعد تلاش کنید.');}
  if(!response.ok)throw Error('دانلود مستقیم از مخزن رسمی ناموفق بود: HTTP '+response.status+'؛ این پاسخ از مبدأ دانلود است، نه بررسی توکن Cloudflare.');
  if(/text\/html/i.test(response.headers.get('content-type')||''))throw Error('مبدأ دانلود به‌جای کد پنل، صفحهٔ HTML فرستاد؛ نصب متوقف شد.');
  const bytes=await limited(response,MAX_SOURCE),installedVersion=validateModule(bytes),hash=await sha256(bytes);
  notify('فایل نسخهٔ '+installedVersion+' دریافت شد؛ آمادهٔ نصب.');
  // SHA-256 is an identifier, not an independently authenticated checksum.
  return {source:bytes,version:installedVersion,sha256:hash,ref:'main',sourceURL,verifiedHash:false};
}
