/* RFC 1928/1929 SOCKS5 and RFC 9110 HTTP CONNECT. No direct fallback. */
const encoder=new TextEncoder();
export function parseChainProxy(value){
 let raw=String(value||'').trim();if(!raw)return null;if(raw.length>2048)throw Error('آدرس زنجیره بیش از حد طولانی است');
 if(!/^[a-z][a-z\d+.-]*:\/\//i.test(raw))raw='socks5://'+raw;
 let u;try{u=new URL(raw);}catch{throw Error('فرمت زنجیره نامعتبر است؛ socks5://user:pass@host:port');}
 const protocol=u.protocol.slice(0,-1).toLowerCase();if(!['socks','socks5','socks5h','http','https'].includes(protocol))throw Error('فقط SOCKS5، HTTP و HTTPS CONNECT پشتیبانی می‌شوند');
 if(!u.hostname||u.search||u.hash||(u.pathname&&u.pathname!=='/'))throw Error('زنجیره باید فقط آدرس، پورت و در صورت نیاز اطلاعات ورود باشد');
 const decode=v=>{try{return decodeURIComponent(v);}catch{throw Error('کدگذاری نام کاربری یا گذرواژه نامعتبر است');}};
 let username=decode(u.username),password=decode(u.password);
 if(protocol.startsWith('socks')&&username&&!password){try{const decoded=new TextDecoder().decode(Uint8Array.from(atob(username.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));if(decoded.includes(':')){const i=decoded.indexOf(':');username=decoded.slice(0,i);password=decoded.slice(i+1);}}catch{}}
 if(u.port==='0')throw Error('پورت صفر معتبر نیست');
 const hasAuth=!!(username||password);if(protocol.startsWith('socks')&&hasAuth&&!username)throw Error('نام کاربری SOCKS5 خالی است');
 const port=Number(u.port)||(protocol.startsWith('socks')?1080:protocol==='https'?443:80);
 if(encoder.encode(username).length>255||encoder.encode(password).length>255||/[\r\n\0]/.test(username+password))throw Error('اطلاعات ورود پروکسی نامعتبر است');
 if(protocol.startsWith('http')&&username.includes(':'))throw Error('نام کاربری HTTP نمی‌تواند شامل : باشد');
 return {protocol,hasAuth,host:u.hostname.replace(/^\[|\]$/g,''),port,username,password,secure:protocol==='https'};
}
function ipv6Bytes(host){
 const canonical=new URL('http://['+host+']/').hostname.slice(1,-1);const sides=canonical.split('::'),left=sides[0]?sides[0].split(':'):[],right=sides[1]?sides[1].split(':'):[];
 const words=sides.length===2?left.concat(Array(8-left.length-right.length).fill('0'),right):left;
 if(words.length!==8)throw Error('Invalid IPv6');const out=new Uint8Array(16);words.forEach((w,i)=>{const n=parseInt(w,16);out[i*2]=n>>8;out[i*2+1]=n&255;});return out;
}
function destination(host,port){
 host=String(host||'').replace(/^\[|\]$/g,'');if(!host||/[\s\r\n\0/?#]/.test(host)||!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid chain destination');
 let atyp,data;if(host.includes(':')){atyp=4;data=ipv6Bytes(host);}else if(/^\d+\.\d+\.\d+\.\d+$/.test(host)){const octets=host.split('.').map(Number);if(octets.some(n=>n>255))throw Error('Invalid IPv4');atyp=1;data=Uint8Array.from(octets);}else{atyp=3;const text=encoder.encode(host);if(text.length>255)throw Error('Destination name too long');data=new Uint8Array(text.length+1);data[0]=text.length;data.set(text,1);}
 return {host,atyp,data,authority:(atyp===4?'['+host+']':host)+':'+port};
}
export async function connectChain(spec,targetHost,targetPort,connect,timeoutMs=7000){
 const proxy=parseChainProxy(spec);if(!proxy)throw Error('Empty chain');const dest=destination(targetHost,Number(targetPort));let socket,reader,writer,timer,finished=false;
 const job=(async()=>{
  socket=await connect(proxy.host,proxy.port,{secureTransport:proxy.secure?'on':'off'});if(finished){try{socket.close();}catch{}throw Error('Chain timeout');}
  socket.closed?.catch(()=>{});if(socket.opened)await socket.opened;
  writer=socket.writable.getWriter();reader=socket.readable.getReader();writer.closed?.catch(()=>{});reader.closed?.catch(()=>{});
  let buffer=new Uint8Array(0);
  async function take(n){while(buffer.length<n){const r=await reader.read();if(r.done)throw Error('پروکسی پیش از تکمیل مذاکره بسته شد');const v=r.value;const all=new Uint8Array(buffer.length+v.length);all.set(buffer);all.set(v,buffer.length);buffer=all;if(buffer.length>131072)throw Error('Proxy handshake overflow');}const out=buffer.slice(0,n);buffer=buffer.slice(n);return out;}
  if(proxy.protocol.startsWith('socks')){
   await writer.write(proxy.username?new Uint8Array([5,2,0,2]):new Uint8Array([5,1,0]));const greeting=await take(2);
   if(greeting[0]!==5||![0,2].includes(greeting[1])||(greeting[1]===2&&!proxy.username))throw Error('روش احراز هویت SOCKS5 پذیرفته نشد');
   if(greeting[1]===2){const u=encoder.encode(proxy.username),p=encoder.encode(proxy.password),auth=new Uint8Array(3+u.length+p.length);auth.set([1,u.length]);auth.set(u,2);auth[2+u.length]=p.length;auth.set(p,3+u.length);await writer.write(auth);const reply=await take(2);if(reply[0]!==1||reply[1]!==0)throw Error('نام کاربری یا گذرواژه SOCKS5 رد شد');}
   const request=new Uint8Array(6+dest.data.length);request.set([5,1,0,dest.atyp]);request.set(dest.data,4);request[request.length-2]=targetPort>>8;request[request.length-1]=targetPort&255;await writer.write(request);
   const head=await take(4);if(head[0]!==5||head[2]!==0||head[1]!==0)throw Error('SOCKS5 CONNECT رد شد: '+head[1]);
   if(head[3]===1)await take(6);else if(head[3]===4)await take(18);else if(head[3]===3){const n=(await take(1))[0];await take(n+2);}else throw Error('SOCKS5 address type invalid');
  }else{
   let auth='';if(proxy.hasAuth){const bytes=encoder.encode(proxy.username+':'+proxy.password);let bin='';for(const b of bytes)bin+=String.fromCharCode(b);auth='Proxy-Authorization: Basic '+btoa(bin)+'\r\n';}
   await writer.write(encoder.encode('CONNECT '+dest.authority+' HTTP/1.1\r\nHost: '+dest.authority+'\r\n'+auth+'Proxy-Connection: Keep-Alive\r\n\r\n'));
   let header='';while(!header.endsWith('\r\n\r\n')){header+=String.fromCharCode((await take(1))[0]);if(header.length>16384)throw Error('HTTP proxy header overflow');}
   if(!/^HTTP\/1\.[01]\s+2\d\d\b/.test(header))throw Error('HTTP CONNECT رد شد: '+(header.match(/^HTTP\/1\.[01]\s+(\d{3})/)?.[1]||'invalid response'));
  }
  return {socket,leftover:buffer};
 })();
 try{return await Promise.race([job,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('مهلت مذاکره با پروکسی تمام شد')),timeoutMs);})]);}
 catch(error){finished=true;try{await socket?.close();}catch{}throw error;}
 finally{finished=true;clearTimeout(timer);try{writer?.releaseLock();}catch{}try{reader?.releaseLock();}catch{}}
}
