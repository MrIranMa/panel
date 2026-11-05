/* WARP key material and client configs: direct enrollment or explicitly consented provider imports. */
const bytes64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const decode64=s=>Uint8Array.from(atob(String(s||'')),c=>c.charCodeAt(0));
function rawIP(value){const s=String(value||'').split('/')[0];if(s.includes(':')){return new URL('http://['+s.replace(/^\[|\]$/g,'')+']/').hostname.slice(1,-1);}if(!/^\d{1,3}(\.\d{1,3}){3}$/.test(s)||s.split('.').some(v=>Number(v)>255))throw Error('آدرس داخلی WARP نامعتبر است');return s;}
export async function generateWarpMaterial(kind){
 if(kind==='wireguard'){const pair=await crypto.subtle.generateKey({name:'X25519'},true,['deriveBits']);const privateDER=new Uint8Array(await crypto.subtle.exportKey('pkcs8',pair.privateKey));return {privateKey:bytes64(privateDER.slice(-32)),publicKey:bytes64(await crypto.subtle.exportKey('raw',pair.publicKey))};}
 if(kind!=='masque')throw Error('Unknown WARP protocol');
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);return {privateKey:bytes64(await crypto.subtle.exportKey('pkcs8',pair.privateKey)),publicKey:bytes64(await crypto.subtle.exportKey('spki',pair.publicKey)),bootstrapKey:bytes64(crypto.getRandomValues(new Uint8Array(32)))};
}
export async function makeWarpCredentials(kind,material,device){
 const c=device?.config,peer=c?.peers?.[0],source=c?.interface?.addresses;if(!peer?.public_key||!source)throw Error('پاسخ ثبت WARP ناقص است؛ کانفیگ ساخته نشد');
 const addresses=[source.v4,source.v6].filter(Boolean).map(value=>{const ip=rawIP(value);return ip+(ip.includes(':')?'/128':'/32');});if(!addresses.length)throw Error('WARP آدرس داخلی اختصاص نداد');
 if(kind==='wireguard'){if(decode64(peer.public_key).length!==32||decode64(material.privateKey).length!==32)throw Error('کلید WireGuard نامعتبر است');}
 else await crypto.subtle.importKey('spki',decode64(peer.public_key),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 const candidate=peer.endpoint?.v4||peer.endpoint?.v6;if(!candidate)throw Error('WARP مقصد اتصال برنگرداند');
 const ep=new URL('https://'+candidate);if(ep.username||ep.password||ep.pathname!=='/')throw Error('WARP endpoint invalid');
 const reserved=c.client_id?Array.from(decode64(c.client_id)):[];if(reserved.length&&reserved.length!==3)throw Error('WARP reserved invalid');
 return {kind,privateKey:material.privateKey,peerPublicKey:peer.public_key,addresses,endpoint:ep.hostname.replace(/^\[|\]$/g,''),port:Number(ep.port)||(kind==='wireguard'?2408:443),reserved,createdAt:Date.now()};
}
function endpoint(value,port){let host=String(value||'').trim();if(host.includes(':'))host=new URL('http://['+host.replace(/^\[|\]$/g,'')+']/').hostname.slice(1,-1);else if(!/^[a-z\d.-]{1,253}$/i.test(host))throw Error('مقصد WARP نامعتبر است');const n=Number(port);if(!Number.isInteger(n)||n<1||n>65535)throw Error('پورت نامعتبر است');return {host,port:n,authority:(host.includes(':')?'['+host+']':host)+':'+n};}
export function buildWarpXray(credentials,options={}){
 const c=credentials,ep=endpoint(options.endpoint||c.endpoint,options.port||c.port),mode=options.mode==='h3'?'h3':'h2';let proxy;
 if(c.kind==='wireguard')proxy={tag:'warp',protocol:'wireguard',settings:{secretKey:c.privateKey,address:c.addresses,peers:[{publicKey:c.peerPublicKey,endpoint:ep.authority,allowedIPs:['0.0.0.0/0','::/0']}],reserved:c.reserved.length?c.reserved:[0,0,0],mtu:1280}};
 else{proxy={tag:'warp',protocol:'masque',settings:{address:ep.host,port:ep.port},streamSettings:{method:'masque',masqueSettings:{warp:{privateKey:c.privateKey,publicKey:c.peerPublicKey,address:c.addresses}},security:'tls',tlsSettings:{serverName:'consumer-masque.cloudflareclient.com',alpn:[mode],allowInsecure:false}}};if(options.fragment&&mode==='h2')proxy.streamSettings.finalmask={tcp:[{type:'fragment',settings:{packets:'tlshello',lengths:['10-20'],delays:['1-3']}}]};}
 return {remarks:'NIGHTLINE FREE · Independent WARP · '+(c.kind==='wireguard'?'WireGuard':'MASQUE '+mode.toUpperCase()),log:{loglevel:'warning'},inbounds:[{tag:'socks',listen:'127.0.0.1',port:10808,protocol:'socks',settings:{udp:true}},{tag:'http',listen:'127.0.0.1',port:10809,protocol:'http',settings:{}}],outbounds:[proxy,{tag:'direct',protocol:'freedom',settings:{}},{tag:'block',protocol:'blackhole',settings:{}}],dns:{servers:['https://1.1.1.1/dns-query']},routing:{domainStrategy:'AsIs',rules:[{type:'field',domain:['domain:ir','domain:local','domain:localhost'],outboundTag:'direct'},{type:'field',ip:['10.0.0.0/8','172.16.0.0/12','192.168.0.0/16','127.0.0.0/8','::1/128','fc00::/7','fe80::/10'],outboundTag:'direct'}]}};
}
export function buildWireGuardConf(c,options={}){
 if(c.kind!=='wireguard')throw Error('کلید MASQUE قابل استفاده در WireGuard نیست');const ep=endpoint(options.endpoint||c.endpoint,options.port||c.port);
 return '# NIGHTLINE FREE - independent WARP; Worker user quota/expiry does not apply\n[Interface]\nPrivateKey = '+c.privateKey+'\nAddress = '+c.addresses.join(', ')+'\nDNS = 1.1.1.1\nMTU = 1280\n\n[Peer]\nPublicKey = '+c.peerPublicKey+'\nAllowedIPs = 0.0.0.0/0, ::/0\nEndpoint = '+ep.authority+'\nPersistentKeepalive = 25\n';
}
export async function validateWarpCredentials(c){
 if(!c||!['wireguard','masque'].includes(c.kind)||!Array.isArray(c.addresses)||!c.addresses.length||c.addresses.length>2)throw Error('پشتیبان WARP معتبر نیست');
 c.addresses.forEach(rawIP);endpoint(c.endpoint,c.port);if(!Array.isArray(c.reserved)||c.reserved.some(v=>!Number.isInteger(v)||v<0||v>255)||![0,3].includes(c.reserved.length))throw Error('Reserved invalid');
 if(c.kind==='wireguard'){if(decode64(c.privateKey).length!==32||decode64(c.peerPublicKey).length!==32)throw Error('WireGuard key invalid');}
 else{await crypto.subtle.importKey('pkcs8',decode64(c.privateKey),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);await crypto.subtle.importKey('spki',decode64(c.peerPublicKey),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);}
 return c;
}
