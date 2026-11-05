/* Bounded browser-native diagnostics. No server-side IP scan. Heuristic candidates never count as successful pings. */
(function (root) {
  'use strict';
  function median(values) {
    var a = values.filter(Number.isFinite).slice().sort(function (x,y) { return x-y; });
    return a.length ? Math.round(a.length % 2 ? a[(a.length-1)/2] : (a[a.length/2-1]+a[a.length/2])/2) : null;
  }
  function summary(samples) {
    var good = samples.filter(function(s) { return s.ok; });
    var diffs = [];
    for (var i=1;i<good.length;i++) diffs.push(Math.abs(good[i].ms-good[i-1].ms));
    return { ok: good.length > samples.length/2, ms: median(good.map(function(s){return s.ms;})),
      attemptMs: median(samples.map(function(s){return s.ms;})), jitter: median(diffs),
      replies:good.length, attempts:samples.length, noReply: samples.length ? Math.round((samples.length-good.length)*100/samples.length) : 100,
      samples:samples };
  }
  async function timed(url, options) {
    options = options || {};
    var local = new AbortController(), parent = options.signal, expired = false;
    function abort() { local.abort(); }
    if (parent) { if(parent.aborted) abort(); else parent.addEventListener('abort',abort,{once:true}); }
    var timer = setTimeout(function(){expired=true;local.abort();}, options.timeout || 2500);
    var start = performance.now();
    try {
      var sep = url.indexOf('?')<0?'?':'&';
      var res = await fetch(url + sep + '_nl=' + Date.now() + '-' + Math.random().toString(36).slice(2,8), {
        method:options.method || 'GET',mode:options.mode || 'cors',credentials: options.credentials || 'omit',
        cache:'no-store',redirect:options.redirect || 'follow',referrerPolicy:'no-referrer',
        headers:options.headers,body:options.body,signal:local.signal
      });
      var extra={};
      if(options.check === 'health') {
        if(!res.ok) throw Error('http');
        var h=await res.json(); if(h.ok!==true || h.version!=='2.5.6')throw Error('health');
      } else if(options.check === 'dns') {
        if(!res.ok)throw Error('http');
        var d=await res.json();if(d.Status!==0 || !Array.isArray(d.Answer) || !d.Answer.some(function(a){return a.type===1;}))throw Error('dns');
      } else if(options.check === 'dns-wire') {
        if(!res.ok)throw Error('http');
        var wire=new Uint8Array(await res.arrayBuffer());
        if(wire.length<12 || !(wire[2]&128) || (wire[3]&15)!==0 || (wire[6]*256+wire[7])<1)throw Error('dns');
      } else if(options.check === 'download') {
        if(!res.ok)throw Error('http');extra.bytes=(await res.arrayBuffer()).byteLength;
        if(extra.bytes!==options.bytes)throw Error('size');
      } else if(options.check === 'upload') {
        if(!res.ok)throw Error('http');extra.bytes=Number((await res.json()).receivedBytes);
        if(extra.bytes!==options.bytes)throw Error('size');
      } else if(res.type!=='opaque' && res.type!=='opaqueredirect' && !res.ok)throw Error('http');
      return Object.assign({ok:true,ms:Math.max(1,Math.round(performance.now()-start))},extra);
    } catch(e) {
      return {ok:false,ms:Math.max(1,Math.round(performance.now()-start)),reason: parent&&parent.aborted?'cancelled':expired?'timeout':'browser-or-network'};
    } finally { clearTimeout(timer);if(parent)parent.removeEventListener('abort',abort); }
  }
  async function sample(url, options, rounds) {
    var out=[];
    for(var i=0;i<(rounds||3);i++) {if(options.signal&&options.signal.aborted)break;out.push(await timed(url,options));}
    return summary(out);
  }
  function cidrIterator(cidr){
    var parts=String(cidr).split('/'),v6=parts[0].includes(':'),bits=Number(parts[1]),width=v6?128:32;if(!Number.isInteger(bits)||bits<0||bits>width)throw Error('Invalid CIDR');
    var base;if(v6){var host=new URL('http://['+parts[0]+']/').hostname.slice(1,-1),sides=host.split('::'),left=sides[0]?sides[0].split(':'):[],right=sides[1]?sides[1].split(':'):[];var words=sides.length===2?left.concat(Array(8-left.length-right.length).fill('0'),right):left;base=words.reduce(function(n,w){return (n<<16n)+BigInt('0x'+w);},0n);}else{var octets=parts[0].split('.').map(Number);if(octets.length!==4||octets.some(function(n){return n<0||n>255;}))throw Error('Invalid IPv4');base=octets.reduce(function(n,w){return (n<<8n)+BigInt(w);},0n);}
    var size=1n<<BigInt(width-bits),mask=size-1n,network=base&~mask,random=new Uint32Array(8);crypto.getRandomValues(random);
    var seed=Array.from(random.slice(0,4)).reduce(function(n,w){return(n<<32n)+BigInt(w);},0n)&mask,stride=(Array.from(random.slice(4)).reduce(function(n,w){return(n<<32n)+BigInt(w);},0n)|1n)&mask,index=0n;
    return {next:function(){if(index>=size)return null;var value=network+((seed+index++*stride)&mask);if(!v6)return [24n,16n,8n,0n].map(function(n){return Number((value>>n)&255n);}).join('.');return '['+Array.from({length:8},function(_,i){return ((value>>BigInt((7-i)*16))&65535n).toString(16);}).join(':')+']';}};
  }
  function imageSignal(url,options){
    options=options||{};
    return new Promise(function(resolve){
      var img,start=performance.now(),done=false,signal=options.signal;
      function finish(reason){if(done)return;done=true;clearTimeout(timer);if(signal)signal.removeEventListener('abort',cancel);if(img){img.onload=img.onerror=null;img.removeAttribute('src');}resolve({ok:false,reason:reason,ms:Math.max(1,Math.round(performance.now()-start))});}
      function cancel(){finish('cancelled');}
      var timer=setTimeout(function(){finish('timeout');},options.timeout||3000);
      if(signal){if(signal.aborted){cancel();return;}signal.addEventListener('abort',cancel,{once:true});}
      if(typeof Image!=='function'){finish('unavailable');return;}
      img=new Image();img.referrerPolicy='no-referrer';img.onload=function(){finish('image-load');};img.onerror=function(){finish('image-error');};img.src=url+(url.indexOf('?')<0?'?':'&')+'_img='+Date.now()+'-'+Math.random();
    });
  }
  async function edgeSignal(url,options){
    var pair=await Promise.all([timed(url,{mode:'no-cors',redirect:'manual',timeout:options.timeout,signal:options.signal}),imageSignal(url,options)]);
    return {fetch:pair[0],image:pair[1]};
  }
  async function scannerCalibration(options){
    options=options||{};
    var base=options.baseMs||100,floor=Math.min(200,Math.max(20,Math.round(base*0.4)));
    var controls=await Promise.all(['192.0.2.1','198.51.100.1','203.0.113.1'].map(function(ip){return edgeSignal('https://'+ip+':443/cdn-cgi/trace',{timeout:Math.min(options.timeout||3000,1200),signal:options.signal});}));
    var reacted=controls.some(function(p){return [p.fetch,p.image].some(function(s){return !['timeout','cancelled','unavailable'].includes(s.reason||'')&&s.ms>=floor;});});
    return {heuristicAllowed:!reacted,floor:floor,controls:controls};
  }
  async function cleanProbe(entry, options) {
    options=options||{};
    // Browser probes only TLS ports. Plain HTTP is never attempted from a secure page.
    if([443,2053,2083,2087,2096,8443].indexOf(entry.port)<0)return {ok:false,kind:'unsupported-port',ms:null,replies:0,attempts:0,scheme:'https'};
    var timeout=options.timeout||3000,cal=options.calibration||{heuristicAllowed:false,floor:20},pairs=[];
    for(var i=0;i<3;i++){if(options.signal&&options.signal.aborted)break;pairs.push(await edgeSignal('https://'+entry.host+':'+entry.port+'/cdn-cgi/trace',{timeout:timeout,signal:options.signal}));}
    var r=summary(pairs.map(function(p){return p.fetch;}));r.scheme='https';r.kind=r.ok?'response':'no-signal';
    var signals=[];
    pairs.forEach(function(p){var times=[p.fetch,p.image].filter(function(s){return !['timeout','cancelled','unavailable'].includes(s.reason||'')&&s.ms>=cal.floor&&s.ms<timeout*0.85;}).map(function(s){return s.ms;});if(times.length)signals.push(Math.max.apply(null,times));});
    if(!r.ok&&cal.heuristicAllowed&&signals.length>=2){r.kind='candidate';r.candidate=true;r.candidateMs=median(signals);r.signalJitter=median(signals.slice(1).map(function(v,i){return Math.abs(v-signals[i]);}));}
    if(!r.ok&&pairs.length&&pairs.every(function(p){return p.fetch.reason==='timeout'&&p.image.reason==='timeout';}))r.kind='timeout';
    if(!r.ok&&!cal.heuristicAllowed&&r.kind!=='timeout')r.kind='inconclusive';
    if(!r.ok&&r.replies>0){r.kind='unstable';r.candidate=true;r.candidateMs=r.ms;}
    r.channels=pairs;r.evidence=r.ok?'http':'browser-signal';return r;
  }
  async function bounded(items, count, fn, signal) {
    var output=new Array(items.length), next=0;
    async function work(){while(next<items.length && !(signal&&signal.aborted)){var i=next++;output[i]=await fn(items[i],i);}}
    await Promise.all(Array.from({length:Math.min(count,items.length)},work));
    return output.filter(Boolean);
  }
  function wsProbe(url, signal) {
    return new Promise(function(resolve){
      var ws, samples=[], started, expected='', done=false, timer;
      function finish(){if(done)return;done=true;clearTimeout(timer);if(signal)signal.removeEventListener('abort',finish);try{ws.close();}catch(e){}resolve(summary(samples));}
      function send(){if(done)return;if(samples.length>=5){finish();return;}expected='nl-'+samples.length+'-'+Math.random().toString(36).slice(2,10);started=performance.now();ws.send(JSON.stringify({type:'nl-ping',id:expected}));clearTimeout(timer);timer=setTimeout(function(){samples.push({ok:false,ms:2500});finish();},2500);}
      if(signal&&signal.aborted){finish();return;}
      try {ws=new WebSocket(url);}catch(e){finish();return;}
      timer=setTimeout(finish,3500);
      if(signal)signal.addEventListener('abort',finish,{once:true});
      ws.onopen=send;
      ws.onmessage=function(event){try{var d=JSON.parse(event.data);if(d.type==='nl-pong'&&d.id===expected){samples.push({ok:true,ms:Math.max(1,Math.round(performance.now()-started))});send();}}catch(e){}};
      ws.onerror=finish;ws.onclose=finish;
    });
  }
  function tunnelProbe(url,identity,options){
    options=options||{};identity=identity||{};
    return new Promise(function(resolve){
      var ws,done=false,start=performance.now(),buffer=new Uint8Array(0),signal=options.signal,opened=false;
      var trojan=identity.protocol==='trojan';
      var target='www.gstatic.com',request=new TextEncoder().encode('GET /generate_204?_nl='+Date.now()+' HTTP/1.1\r\nHost: '+target+'\r\nConnection: close\r\n\r\n');
      function finish(ok,reason,status){if(done)return;done=true;clearTimeout(timer);if(signal)signal.removeEventListener('abort',cancel);try{ws.close();}catch(e){}resolve({ok:ok,reason:reason,status:status||null,protocol:trojan?'trojan':'vless',ms:ok?Math.max(1,Math.round(performance.now()-start)):null,upgraded:opened});}
      function cancel(){finish(false,'cancelled');}
      var timer=setTimeout(function(){finish(false,opened?'tunnel-timeout':'websocket-timeout');},options.timeout||8000);
      if(signal){if(signal.aborted){cancel();return;}signal.addEventListener('abort',cancel,{once:true});}
      if(trojan?!/^[a-f0-9]{56}$/i.test(identity.trojanHash||''):!/^[a-f0-9]{32}$/i.test(String(identity.uuid||'').replace(/-/g,''))){finish(false,'no-identity');return;}
      var host=new TextEncoder().encode(target),header;
      if(trojan){header=new Uint8Array(56+2+2+1+host.length+2+2);header.set(new TextEncoder().encode(identity.trojanHash.toLowerCase()+'\r\n'));header[58]=1;header[59]=3;header[60]=host.length;header.set(host,61);header[61+host.length]=0;header[62+host.length]=80;header[63+host.length]=13;header[64+host.length]=10;}
      else{header=new Uint8Array(23+host.length);header.set(String(identity.uuid).replace(/-/g,'').match(/../g).map(function(h){return parseInt(h,16);}),1);header[18]=1;header[20]=80;header[21]=2;header[22]=host.length;header.set(host,23);}
      try{ws=new WebSocket(url);ws.binaryType='arraybuffer';}catch(e){finish(false,'websocket-error');return;}
      ws.onopen=function(){opened=true;var payload=new Uint8Array(header.length+request.length);payload.set(header);payload.set(request,header.length);ws.send(payload);};
      ws.onmessage=function(event){
        if(done)return;if(!(event.data instanceof ArrayBuffer)){finish(false,'invalid-response');return;}
        var part=new Uint8Array(event.data);if(buffer.length+part.length>16384){finish(false,'oversize-response');return;}
        var joined=new Uint8Array(buffer.length+part.length);joined.set(buffer);joined.set(part,buffer.length);buffer=joined;
        var offset=0;if(!trojan){if(buffer.length<2)return;if(buffer[0]!==0){finish(false,'invalid-vless-response');return;}offset=2+buffer[1];if(buffer.length<offset)return;}
        var text=new TextDecoder().decode(buffer.subarray(offset)),match=text.match(/^HTTP\/1\.[01] (\d{3})[^\r\n]*\r\n/);
        if(match){var status=Number(match[1]);finish(status>=200&&status<400,status>=200&&status<400?'http-response':'http-denied',status);}
        else if(text.length>512)finish(false,'invalid-http-response');
      };
      ws.onerror=function(){finish(false,'websocket-error');};ws.onclose=function(){finish(false,'closed-before-http');};
    });
  }
  root.NLNetwork={cidrIterator:cidrIterator,median:median,summary:summary,timed:timed,sample:sample,bounded:bounded,wsProbe:wsProbe,cleanProbe:cleanProbe,imageSignal:imageSignal,edgeSignal:edgeSignal,scannerCalibration:scannerCalibration,tunnelProbe:tunnelProbe};
})(globalThis);
