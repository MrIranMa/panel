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
        var h=await res.json(); if(h.ok!==true || h.version!=='2.5.3')throw Error('health');
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
  async function cleanProbe(entry, options) {
    options=options||{};
    var plainPorts=[80,8080,8880,2052,2082,2086,2095];
    var scheme=options.transport==='http'||(options.transport!=='strict'&&plainPorts.indexOf(entry.port)>=0)?'http':'https';
    if(scheme==='http'&&options.pageProtocol==='https:')return {ok:false,kind:'mixed-content',ms:null,replies:0,attempts:0,scheme:scheme};
    var timeout=options.timeout||4000;
    var r=await sample(scheme+'://'+entry.host+':'+entry.port+'/cdn-cgi/trace',{
      mode:'no-cors',redirect:'manual',timeout:timeout,signal:options.signal
    },3);
    r.scheme=scheme;r.kind=r.ok?'response':'unconfirmed';
    var quick=r.samples.filter(function(s){return !s.ok&&s.reason==='browser-or-network'&&s.ms>=20&&s.ms<timeout*0.65;});
    if(!r.ok&&r.replies===0&&entry.isRawIp&&options.transport!=='strict'&&quick.length>=2){r.kind='candidate';r.candidateMs=median(quick.map(function(s){return s.ms;}));}
    else if(!r.ok&&r.samples.length&&r.samples.every(function(s){return s.reason==='timeout';}))r.kind='timeout';
    else if(!r.ok&&r.replies)r.kind='unstable';
    return r;
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
  root.NLNetwork={median:median,summary:summary,timed:timed,sample:sample,bounded:bounded,wsProbe:wsProbe,cleanProbe:cleanProbe,tunnelProbe:tunnelProbe};
})(globalThis);
