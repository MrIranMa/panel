/* Fixed-origin direct Cloudflare enrollment; the optional reference-provider workflow is separate. */
const API='https://api.cloudflareclient.com/v0a4471';let registrations=[];
const headers={'User-Agent':'WARP for Android','CF-Client-Version':'a-6.35-4471','content-type':'application/json','accept':'application/json'};
function b64(value,length){try{return typeof value==='string'&&atob(value).length===length;}catch{return false;}}
export async function warpAction(action,body,request,fetcher=fetch){
 if(body.__parseError)throw Error(body.__parseError);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw Error('Origin denied');
 if(body.privateKey||body.private_key)throw Error('کلید خصوصی نباید به API ارسال شود');
 let url,options;
 if(action==='register'){
  if(body.consent!==true||!['wireguard','masque'].includes(body.kind)||!b64(body.key,32))throw Error('تأیید شرایط و کلید عمومی معتبر لازم است');
  registrations=registrations.filter(t=>Date.now()-t<60000);if(registrations.length>=4)throw Error('ثبت‌های متوالی زیاد است؛ یک دقیقه صبر کنید');registrations.push(Date.now());
  url=API+'/reg';options={method:'POST',headers,body:JSON.stringify({key:body.key,install_id:'',fcm_token:'',tos:new Date().toISOString(),type:'Android',model:'NightLine Free',locale:'fa_IR',warp_enabled:true})};
 }else if(action==='enroll'){
  if(!/^[a-z\d._:-]{4,256}$/i.test(body.id||'')||typeof body.token!=='string'||body.token.length<8||body.token.length>2048||/[\r\n]/.test(body.token)||!b64(body.publicKey,91))throw Error('اطلاعات تکمیل MASQUE نامعتبر است');
  const bytes=Uint8Array.from(atob(body.publicKey),c=>c.charCodeAt(0));await crypto.subtle.importKey('spki',bytes,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  url=API+'/reg/'+encodeURIComponent(body.id);options={method:'PATCH',headers:{...headers,authorization:'Bearer '+body.token},body:JSON.stringify({key:body.publicKey,key_type:'secp256r1',tunnel_type:'masque',warp_enabled:true,name:'NightLine Free MASQUE'})};
 }else throw Error('Unknown WARP operation');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const response=await fetcher(url,{...options,redirect:'manual',signal:controller.signal});if(!response.ok)throw Error('Cloudflare ثبت WARP را نپذیرفت (HTTP '+response.status+'). ثبت زنده تضمین نیست؛ دوباره‌کاری خودکار انجام نشد.');const text=await response.text();if(text.length>65536)throw Error('WARP response too large');const d=JSON.parse(text);if(!d.id||!d.config)throw Error('پاسخ ثبت ناقص است');return {id:d.id,...(typeof d.token==='string'?{token:d.token}:{}),config:d.config};}
 finally{clearTimeout(timer);}
}
