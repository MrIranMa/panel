/* Masque-Generator API-pool/list workflow, adapted from the user-supplied index.html.
 * Credit: DarknessShade/Masque-Generator, MIT. Providers know the supplied private keys.
 */
import {validateWarpCredentials} from './warp-core.js';
export const MASQUE_APIS=Object.freeze(['https://masque.configwireguard.workers.dev/','https://masque.configwireguard2.workers.dev/','https://masque.configwireguard3.workers.dev/','https://masque.configwireguard4.workers.dev/']);
export const MASQUE_LIST='https://masque.configwireguard1.workers.dev/api/list';
export const pemBody=value=>String(value||'').replace(/-----(?:BEGIN|END)[^-]*-----/g,'').replace(/\s/g,'');
const bytes=s=>Uint8Array.from(atob(pemBody(s)),c=>c.charCodeAt(0));
const base64=b=>btoa(String.fromCharCode(...b));
function tlv(tag,b){const n=b.length,len=n<128?[n]:n<256?[129,n]:[130,n>>8,n&255];return Uint8Array.from([tag,...len,...b]);}
export async function normalizeMasqueCredential(input,options={}){
 const d=input?.content?.private_key?input.content:input;if(!d||d.success===false)throw Error('پاسخ مرجع معتبر نیست');
 let privateKey=pemBody(d.private_key||d.private_key_raw),peerPublicKey=pemBody(d.endpoint_pub_key||d.endpoint_public_key||options.publicKey);
 if(!privateKey||!peerPublicKey)throw Error('کلید خصوصی یا کلید عمومی مقصد در فایل/پاسخ وجود ندارد');
 const der=bytes(privateKey);if(der.length<48||der.length>512||bytes(peerPublicKey).length!==91)throw Error('قالب کلید MASQUE معتبر نیست');
 try{await crypto.subtle.importKey('pkcs8',der,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);}
 catch{const algorithm=Uint8Array.from([48,19,6,7,42,134,72,206,61,2,1,6,8,42,134,72,206,61,3,1,7]);const octets=tlv(4,der),wrapped=tlv(48,Uint8Array.from([2,1,0,...algorithm,...octets]));await crypto.subtle.importKey('pkcs8',wrapped,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);privateKey=base64(wrapped);}
 const addresses=d.ipv4?[String(d.ipv4),...(d.ipv6?[String(d.ipv6)]:[])]:String(d.address||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(!addresses.some(a=>/^(?:\d{1,3}\.){3}\d{1,3}(?:\/32)?$/.test(a)))throw Error('آدرس IPv4 حساب وجود ندارد');
 const c={kind:'masque',privateKey,peerPublicKey,addresses:addresses.map(a=>a.split('/')[0]+(a.includes(':')?'/128':'/32')),endpoint:'162.159.198.2',port:443,reserved:[],createdAt:Date.now()};
 // Use official endpoints, as the reference does. Never accept a provider's arbitrary destination.
 await validateWarpCredentials(c);return c;
}
async function readJSON(response,max=65536){if(!response.ok)throw Error('HTTP '+response.status);if(Number(response.headers.get('content-length'))>max)throw Error('پاسخ بیش از حد بزرگ است');const reader=response.body.getReader();let size=0;const parts=[];try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>max){await reader.cancel();throw Error('پاسخ بیش از حد بزرگ است');}parts.push(p.value);}}finally{reader.releaseLock();}const all=new Uint8Array(size);let pos=0;for(const p of parts){all.set(p,pos);pos+=p.length;}let d;try{d=JSON.parse(new TextDecoder().decode(all));}catch{throw Error('پاسخ مرجع JSON نیست');}if(d?.success===false)throw Error('مرجع درخواست را نپذیرفت');return d;}
export function createMasqueProvider({fetcher=fetch,now=Date.now,timeout=10000,cooldown=300000,retryDelay=1200,storage}={}){
 function read(k){try{return storage?.get('masque.'+k)||'';}catch{return '';}}function save(k,v){try{storage?.set('masque.'+k,String(v));}catch{}}
 let next=Number(read('next'))||0,peer=pemBody(read('peer')),listCache=null,listAt=0;if(!Number.isInteger(next)||next<0||next>=MASQUE_APIS.length)next=0;const cool=new Map(),used=new Set();let busy=false;for(let i=0;i<MASQUE_APIS.length;i++){const t=Number(read('cool.'+i));if(t>now())cool.set(i,Math.min(t,now()+cooldown));}
 async function request(url,signal,max){const c=new AbortController(),abort=()=>c.abort();if(signal?.aborted)throw Error('cancelled');signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,timeout);try{return await readJSON(await fetcher(url,{method:'GET',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'no-store',signal:c.signal}),max);}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}}
 return {
 async acquire({consent=false,signal,onProgress=()=>{}}={}){
  if(!consent)throw Error('استفاده از مرجع ثالث به تأیید شما نیاز دارد');if(busy)throw Error('درخواست قبلی هنوز تمام نشده است');busy=true;
  try{let sent=0;for(let step=0;step<MASQUE_APIS.length;step++){if(signal?.aborted)throw Error('cancelled');const i=(next+step)%MASQUE_APIS.length;if((cool.get(i)||0)>now())continue;if(sent++&&retryDelay)await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(t);signal?.removeEventListener('abort',abort);reject(Error('cancelled'));};const t=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},retryDelay);signal?.addEventListener('abort',abort,{once:true});});onProgress(i+1,MASQUE_APIS.length);try{const d=await request(MASQUE_APIS[i],signal,65536);if(signal?.aborted)throw Error('cancelled');const credentials=await normalizeMasqueCredential(d);peer=credentials.peerPublicKey;save('peer',peer);next=(i+1)%MASQUE_APIS.length;save('next',next);return {credentials,source:'reference-api'};}catch(e){if(signal?.aborted)throw Error('cancelled');cool.set(i,now()+cooldown);save('cool.'+i,now()+cooldown);}}
   throw Error('منابع مرجع در دسترس نیستند؛ چند دقیقه بعد تلاش کنید یا از ورود فایل / فهرست عمومی استفاده کنید.');
  }finally{busy=false;}
 },
 async fromList({consent=false,signal,publicKey=''}={}){
  if(!consent)throw Error('فهرست عمومی شامل کلیدهای اشتراکی است؛ تأیید شما لازم است');if(busy)throw Error('درخواست قبلی هنوز تمام نشده است');busy=true;
  try{if(!listCache||now()-listAt>300000){const d=await request(MASQUE_LIST,signal,1048576);const list=Array.isArray(d)?d:d?.keys;if(!Array.isArray(list))throw Error('قالب فهرست معتبر نیست');const seen=new Set();listCache=list.slice(0,512).filter(v=>{if(!v||!(v.private_key_raw||v.private_key)||!v.address)return false;const id=String(v.id||v.private_key_raw||v.private_key);if(seen.has(id))return false;seen.add(id);return true;});listAt=now();used.clear();}
   if(!listCache.length)throw Error('فهرست عمومی خالی است');const candidates=listCache.filter(v=>!used.has(v));if(!candidates.length)throw Error('همهٔ ورودی‌های این فهرست امتحان شدند؛ فایل کامل را وارد یا بعداً فهرست را تازه کنید.');
   let missing=false;const offset=Math.floor(crypto.getRandomValues(new Uint32Array(1))[0]/4294967296*candidates.length);for(let j=0;j<candidates.length;j++){const row=candidates[(offset+j)%candidates.length];if(signal?.aborted)throw Error('cancelled');try{const credentials=await normalizeMasqueCredential(row,{publicKey:publicKey||peer});used.add(row);peer=credentials.peerPublicKey;save('peer',peer);return {credentials,source:'public-list'};}catch{missing=true;used.add(row);}}
   throw Error(missing?'فهرست کلید کامل و معتبر ندارد؛ یک فایل کامل usque وارد کنید یا کلید عمومی مقصد را در تنظیمات بیشتر قرار دهید.':'ورودی معتبر یافت نشد');
  }finally{busy=false;}
 }
 };
}
