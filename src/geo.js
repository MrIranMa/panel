/* Static GeoIP metadata only. Never a latency test or a physical anycast location. */
const cache=new Map();
export function canonicalPublicIP(value){
 let ip=String(value||'').replace(/^\[|\]$/g,'');
 if(ip.includes(':')){try{ip=new URL('http://['+ip+']/').hostname.slice(1,-1);}catch{return null;}if(/^(?:fc|fd|fe[89ab]|ff|2001:db8:|::(?:1)?$|::ffff:)/i.test(ip))return null;return ip;}
 if(!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip))return null;const n=ip.split('.').map(Number);if(n.some(v=>v>255))return null;
 if([0,10,127].includes(n[0])||n[0]>=224||(n[0]===172&&n[1]>=16&&n[1]<=31)||(n[0]===192&&(n[1]===168||n[1]===0&&[0,2].includes(n[2])))||(n[0]===169&&n[1]===254)||(n[0]===100&&n[1]>=64&&n[1]<=127)||(n[0]===198&&([18,19].includes(n[1])||n[1]===51&&n[2]===100))||(n[0]===203&&n[1]===0&&n[2]===113))return null;
 return n.join('.');
}
function validCC(value){return typeof value==='string'&&/^[A-Z]{2}$/.test(value)&&!['XX','ZZ','EU','AP'].includes(value);}
export async function lookupCountry(value,fetcher=fetch){
 const ip=canonicalPublicIP(value);if(!ip)return {ip:String(value),countryCode:null,confidence:'unavailable',reason:'non-public-ip'};
 const cached=cache.get(ip);if(cached&&Date.now()-cached.at<cached.ttl)return {...cached.result,cached:true};
 const providers=[{name:'ipwho.is',url:'https://ipwho.is/'+encodeURIComponent(ip),read:d=>d.success===true?d.country_code:null},{name:'ipapi.co',url:'https://ipapi.co/'+encodeURIComponent(ip)+'/json/',read:d=>!d.error?d.country_code:null}];
 const results=await Promise.all(providers.map(async p=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);try{const response=await fetcher(p.url,{signal:controller.signal,redirect:'error',headers:{accept:'application/json'}});if(!response.ok)return null;const d=await response.json(),code=p.read(d);if(canonicalPublicIP(d.ip)!==ip||!validCC(code))return null;return {source:p.name,code};}catch{return null;}finally{clearTimeout(timer);}}));
 const good=results.filter(Boolean),conflict=good.length===2&&good[0].code!==good[1].code;
 const result={ip,countryCode:conflict?null:good[0]?.code||null,confidence:conflict?'conflict':good.length===2?'two-sources':good.length===1?'single-source':'unavailable',sources:good.map(g=>g.source),checkedAt:Date.now(),anycastNotice:true};
 cache.set(ip,{at:Date.now(),ttl:good.length?6*3600000:60000,result});if(cache.size>2048)cache.delete(cache.keys().next().value);return result;
}
export async function lookupCountries(ips,fetcher){
 const result=new Array(ips.length);let next=0;await Promise.all(Array.from({length:Math.min(3,ips.length)},async()=>{while(next<ips.length){const i=next++;result[i]=await lookupCountry(ips[i],fetcher);}}));return result;
}
