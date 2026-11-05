/* Approximate database country for a connection IP, not exit-IP or physical anycast edge. */
const cache=new Map(),pending=new Map();
const ISO=new Set('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' '));
export function normalizeCountryCode(value){const cc=String(value||'').trim().toUpperCase();return ISO.has(cc)?cc:null;}
export function countryFlag(cc){return normalizeCountryCode(cc)?String.fromCodePoint(...[...cc].map(c=>0x1f1e6+c.charCodeAt(0)-65)):'';}
export function canonicalPublicIP(value){
 let ip=String(value||'').trim().replace(/^\[|\]$/g,'');
 if(ip.includes(':')){try{ip=new URL('http://['+ip+']/').hostname.slice(1,-1);}catch{return null;}if(/^(?:fc|fd|fe[89ab]|ff|2001:db8:|::(?:1)?$|::ffff:)/i.test(ip))return null;return ip;}
 if(!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip))return null;const n=ip.split('.').map(Number);if(n.some(v=>v>255))return null;
 if([0,10,127].includes(n[0])||n[0]>=224||(n[0]===172&&n[1]>=16&&n[1]<=31)||(n[0]===192&&(n[1]===168||n[1]===0&&[0,2].includes(n[2])))||(n[0]===169&&n[1]===254)||(n[0]===100&&n[1]>=64&&n[1]<=127)||(n[0]===198&&([18,19].includes(n[1])||n[1]===51&&n[2]===100))||(n[0]===203&&n[1]===0&&n[2]===113))return null;
 return n.join('.');
}
export function parseCountryEntry(value){
 const raw=String(value||'').trim(),i=raw.indexOf('#'),address=(i<0?raw:raw.slice(0,i)).trim(),remark=i<0?'':raw.slice(i+1).trim();let host='';
 try{if(address.startsWith('[')){const m=address.match(/^\[([^\]]+)\](?::(\d+))?$/);if(!m)return null;host=new URL('http://['+m[1]+']/').hostname.slice(1,-1);}
 else if((address.match(/:/g)||[]).length>1)host=new URL('http://['+address+']/').hostname.slice(1,-1);
 else host=new URL('http://'+address).hostname.toLowerCase();}catch{return null;}
 if(!host)return null;const isIP=host.includes(':')||/^\d{1,3}(\.\d{1,3}){3}$/.test(host),match=remark.match(/^(manual:)?([A-Z]{2})\|(.*)$/i);
 return {raw,address,host,isIP,remark,manual:!!match?.[1],savedCode:normalizeCountryCode(match?.[2]),note:match?match[3].trim():remark};
}
export function countryForEntry(entry,settings={}){
 if(!entry?.isIP)return {countryCode:null,confidence:'domain',scope:'connection-ip'};
 if(entry.manual&&entry.savedCode)return {countryCode:entry.savedCode,confidence:'manual',scope:'manual-label'};
 const fresh=settings.countryMeta?.[entry.host];if(fresh)return fresh;
 return {countryCode:null,confidence:'unavailable',scope:'connection-ip'};
}
export function countryNodeLabel(raw,settings={}){
 const entry=typeof raw==='string'?parseCountryEntry(raw):raw;if(!entry)return String(raw||'');if(!entry.isIP)return entry.note||entry.host;
 const meta=countryForEntry(entry,settings),cc=normalizeCountryCode(meta.countryCode),note=entry.note&&entry.note!==entry.host?entry.note:'';
 return (cc?countryFlag(cc)+' '+(meta.confidence==='single-source'?'~':'')+cc:'CC ?')+' · '+entry.host+(note?' · '+note:'')+(meta.confidence==='manual'?' · manual':'');
}
async function providerResult(p,ip,fetcher){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2200);try{
 const r=await fetcher(p.url(ip),{signal:controller.signal,redirect:'manual',headers:{accept:'application/json'}});if(!r.ok||Number(r.headers.get('content-length'))>65536)return null;
 const reader=r.body.getReader();let length=0;const chunks=[];try{while(true){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>65536){await reader.cancel();return null;}chunks.push(next.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const d=JSON.parse(new TextDecoder().decode(bytes)),cc=normalizeCountryCode(p.read(d));if(canonicalPublicIP(d.ip)!==ip||!cc)return null;return {source:p.name,code:cc};
 }catch{return null;}finally{clearTimeout(timer);}}
async function lookupCountryInternal(value,fetcher=fetch,options={}){
 const ip=canonicalPublicIP(value);if(!ip)return {ip:String(value),countryCode:null,confidence:'unavailable',reason:'non-public-ip',scope:'connection-ip'};
 const cached=cache.get(ip);if(cached&&Date.now()-cached.at<(options.force?Math.min(60000,cached.ttl):cached.ttl))return {...cached.result,cached:true};
 const providers=[{name:'ipwho.is',url:ip=>'https://ipwho.is/'+ip,read:d=>d.success===true?d.country_code:null},{name:'ipapi.co',url:ip=>'https://ipapi.co/'+ip+'/json/',read:d=>!d.error?d.country_code:null},{name:'country.is',url:ip=>'https://api.country.is/'+ip,read:d=>d.country}];
 const initial=(await Promise.all(providers.slice(0,2).map(p=>providerResult(p,ip,fetcher)))).filter(Boolean);
 const good=[...initial];if(initial.length!==2||initial[0].code!==initial[1].code){const extra=await providerResult(providers[2],ip,fetcher);if(extra)good.push(extra);}
 const votes=new Map();for(const r of good)votes.set(r.code,(votes.get(r.code)||0)+1);const winner=[...votes].find(([,v])=>v>=2)?.[0]||null;
 const confidence=winner?'two-sources':votes.size>1?'conflict':good.length?'single-source':'unavailable';
 const result={ip,countryCode:winner||(good.length===1?good[0].code:null),candidateCode:good.length===1?good[0].code:null,confidence,sources:good.map(r=>r.source),checkedAt:Date.now(),scope:'connection-ip',anycastNotice:true,disputed:votes.size>1};
 cache.set(ip,{at:Date.now(),ttl:winner?900000:good.length===1?300000:60000,result});if(cache.size>2048)cache.delete(cache.keys().next().value);return result;
}
export async function lookupCountry(value,fetcher=fetch,options={}){const ip=canonicalPublicIP(value);if(!ip)return lookupCountryInternal(value,fetcher,options);if(pending.has(ip))return pending.get(ip);const job=lookupCountryInternal(value,fetcher,options);pending.set(ip,job);try{return await job;}finally{pending.delete(ip);}}
export async function lookupCountries(ips,fetcher,options={}){const result=new Array(ips.length);let next=0;await Promise.all(Array.from({length:Math.min(6,ips.length)},async()=>{while(next<ips.length){const i=next++;result[i]=await lookupCountry(ips[i],fetcher,options);}}));return result;}
export async function refreshCountryLabels(settings,fetcher=fetch,options={}){
 const entries=[...(settings.cleanIPs||[]),...(settings.customDomains||[])].map(parseCountryEntry).filter(Boolean),allowed=options.hosts?new Set(options.hosts.map(h=>parseCountryEntry(h)?.host||h)):null;
 const hosts=[...new Set(entries.filter(e=>e.isIP&&(!allowed||allowed.has(e.host))).map(e=>e.host))];
 const automatic=new Set(entries.filter(e=>!e.manual||!e.savedCode).map(e=>e.host));
 const eligible=hosts.filter(h=>canonicalPublicIP(h)&&automatic.has(h));const limit=Math.max(1,Math.min(12,options.budget||12));
 const selected=eligible.filter(h=>{const c=cache.get(h);return !c||Date.now()-c.at>=(options.force?Math.min(60000,c.ttl):c.ttl);}).sort((a,b)=>(cache.get(a)?.at||0)-(cache.get(b)?.at||0)).slice(0,limit);
 await lookupCountries(selected,fetcher,options);
 const countryMeta=Object.create(null);for(const host of hosts){const c=cache.get(host);countryMeta[host]=c&&Date.now()-c.at<c.ttl?c.result:{ip:host,countryCode:null,confidence:'unavailable',reason:canonicalPublicIP(host)?'not-checked-this-batch':'non-public-ip',scope:'connection-ip'};}
 const decorate=raw=>{const e=parseCountryEntry(raw);if(!e?.isIP||e.manual)return raw;const cc=countryMeta[e.host]?.countryCode;return e.address+'#'+(cc?cc+'|':'')+(e.note||'GeoIP');};
 return {...settings,cleanIPs:(settings.cleanIPs||[]).map(decorate),customDomains:(settings.customDomains||[]).map(decorate),countryMeta,countryCheckedAt:Date.now()};
}
