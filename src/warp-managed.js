/* Managed per-user WARP devices in this panel's KV. Credits: DarknessShade/Masque-Generator (MIT), official Xray WARP guide. */
import {generateWarpMaterial,makeWarpCredentials,validateWarpCredentials,buildWarpXray,buildWireGuardConf} from './warp-core.js';
import {warpAction} from './warp-api.js';
const inflight=new Map();
const key=(user,kind)=>'nightline:warp:v1:'+encodeURIComponent(user.id||user.uuid)+':'+kind;
export function validWarpKind(kind){if(!['masque','wireguard'].includes(kind))throw Error('Unknown WARP kind');return kind;}
export async function readWarpAccount(kv,user,kind){validWarpKind(kind);const k=key(user,kind),raw=await kv.get(k,'text');if(raw)return JSON.parse(raw);const parts=await Promise.all(['material','device','enrolled'].map(part=>kv.get(k+':'+part,'text')));if(!parts[0])return null;return {version:1,kind,material:JSON.parse(parts[0]),...(parts[1]?{device:JSON.parse(parts[1])}:{}),...(parts[2]?{enrolledDevice:JSON.parse(parts[2])}:{})};}
export async function createWarpAccount(kv,user,kind,consent,request,fetcher=fetch){
 validWarpKind(kind);if(consent!==true)throw Error('برای ساخت دستگاه، تأیید شرایط WARP لازم است');
 const k=key(user,kind);if(inflight.has(k))return inflight.get(k);
 const job=(async()=>{let a=await readWarpAccount(kv,user,kind);if(a?.credentials)return a;
 if(!a){a={version:1,kind,createdAt:Date.now(),material:await generateWarpMaterial(kind)};await kv.put(k+':material',JSON.stringify(a.material));}
 if(!a.device){a.device=await warpAction('register',{kind,key:kind==='masque'?a.material.bootstrapKey:a.material.publicKey,consent:true},request,fetcher);if(!a.device.token)throw Error('ثبت token دستگاه برنگرداند');await kv.put(k+':device',JSON.stringify(a.device));}
 let device=a.enrolledDevice||a.device;
 if(kind==='masque'&&!a.enrolledDevice){device=await warpAction('enroll',{id:device.id,token:device.token,publicKey:a.material.publicKey},request,fetcher);a.enrolledDevice=device;await kv.put(k+':enrolled',JSON.stringify(device));}
 a.credentials=await makeWarpCredentials(kind,a.material,device);await kv.put(k,JSON.stringify(a));return a;})();
 inflight.set(k,job);try{return await job;}finally{inflight.delete(k);}
}
export async function importWarpAccount(kv,user,kind,account){
 validWarpKind(kind);if(account?.kind!==kind)throw Error('نوع پشتیبان ناسازگار است');const k=key(user,kind);
 if(account.credentials){if(account.credentials.kind!==kind)throw Error('نوع کلید ناسازگار است');await validateWarpCredentials(account.credentials);const safe={version:1,kind,createdAt:Date.now(),source:['reference-api','public-list','manual'].includes(account.source)?account.source:'manual',credentials:account.credentials};await kv.put(k,JSON.stringify(safe));return safe;}
 const material=account.material;if(!material||typeof material.privateKey!=='string'||typeof material.publicKey!=='string')throw Error('پشتیبان ناقص است');
 await validateWarpCredentials({kind,privateKey:material.privateKey,peerPublicKey:material.publicKey,addresses:['172.16.0.2/32'],endpoint:'162.159.192.1',port:443,reserved:[]});
 if(kind==='masque'&&atob(material.bootstrapKey||'').length!==32)throw Error('کلید اولیه نامعتبر است');
 const safe={version:1,kind,material};await kv.put(k+':material',JSON.stringify(material));
 if(account.device){if(typeof account.device.id!=='string'||typeof account.device.token!=='string'||!account.device.config)throw Error('اطلاعات دستگاه نامعتبر است');safe.device=account.device;await kv.put(k+':device',JSON.stringify(safe.device));}
 return safe;
}
export function warpAccountStatus(a){return {kind:a?.kind,ready:!!a?.credentials,pending:!!a&&!a.credentials,source:a?.source||'direct',createdAt:a?.createdAt||null};}
export function exportWarpAccount(a,mode='h2',conf=false,options={}){if(!a?.credentials)throw Error('ابتدا حساب این پروتکل را برای کاربر منتخب آماده کنید');if(conf)return buildWireGuardConf(a.credentials,options);const config=buildWarpXray(a.credentials,{...options,mode});if(a.source==='public-list')config.remarks+=' · Shared public-list key';else if(a.source==='reference-api')config.remarks+=' · Third-party supplied key';return JSON.stringify(config,null,2);}
