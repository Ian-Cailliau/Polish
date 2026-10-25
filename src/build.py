"""Build the standalone (GitHub Pages) version of the Polski Test 1 app from the artifact page."""
import json, sys, re, os
from PIL import Image
HERE=os.path.dirname(os.path.abspath(__file__))+'/'
OUT=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else HERE+'..')+'/'
src=open(HERE+'app.html').read()
# optional one-off import of progress (not needed any more: every device already merged it)
SEEDF=HERE+'seed.json'
seed=json.load(open(SEEDF)) if os.path.exists(SEEDF) else None
if seed: seed=seed.get('data',seed).get('s',{})
head='''<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Polski">
<meta name="theme-color" content="#F4F6FA" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#10151F" media="(prefers-color-scheme: dark)">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="manifest" href="manifest.webmanifest">
<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
html{-webkit-text-size-adjust:100%;background:#F4F6FA}
@media (prefers-color-scheme: dark){html{background:#10151F}}
body{margin:0;font:14px/1.4 system-ui,-apple-system,sans-serif}
img{max-width:100%}[hidden]{display:none!important}
</style>
</head><body>
'''
tail='''
<script>
/* ---------- sync between devices through a private GitHub gist ---------- */
(function(){
 const TK='pl-gh-token',GI='pl-gh-gist',DESC='polski-test-1 progress',API='https://api.github.com';
 const get=k=>{try{return localStorage.getItem(k)}catch(e){return null}},set=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}};
 let state={msg:'',busy:false,last:null},timer=null,form=false,showTok=false;
 const hdr=()=>({'Authorization':'Bearer '+get(TK),'Accept':'application/vnd.github+json','Content-Type':'application/json'});
 async function gh(path,opt){const r=await fetch(API+path,{...opt,headers:hdr()});if(!r.ok){const e=new Error(r.status===401?'The token was not accepted. Create a new one and paste it again.':r.status===403||r.status===404?'The token has no access to gists. Make sure the “gist” box is ticked.':'GitHub answered '+r.status+'.');e.status=r.status;throw e}return r.json()}
 async function findGist(){let id=get(GI);if(id)return id;
  const list=await gh('/gists?per_page=100');const g=list.find(x=>x.description===DESC);
  if(g){set(GI,g.id);return g.id}
  const c=await gh('/gists',{method:'POST',body:JSON.stringify({description:DESC,public:false,files:{'progress.json':{content:JSON.stringify(S)},'answers.json':{content:JSON.stringify(AL.wire())}}})});set(GI,c.id);return c.id}
 /* a gist file's text (GitHub cuts long files short in the API answer: the full text is at raw_url) */
 async function fileText(f){if(!f)return null;if(f.truncated){const r=await fetch(f.raw_url);if(!r.ok)throw new Error('GitHub answered '+r.status+'.');return r.text()}return f.content}
 async function syncNow(){if(!get(TK)||state.busy)return;state.busy=true;state.msg='Syncing…';draw();
  try{const id=await findGist();let g;try{g=await gh('/gists/'+id)}catch(e){if(e.status===404){set(GI,null);state.busy=false;return syncNow()}throw e}
   const f=g.files&&g.files['progress.json'];let remote={};
   if(f){const txt=await fileText(f);try{remote=JSON.parse(txt)||{}}catch(e){remote={}}}
   /* the answer log (answers.json): merged as a union of events, so no answer is lost or counted twice */
   const fa=g.files&&g.files['answers.json'];let ra=null,raTxt=null;
   if(fa){raTxt=await fileText(fa);try{ra=JSON.parse(raTxt)}catch(e){ra=null}}
   const merged=mergeS(S,remote);
   /* always take in the other device's progress (the more-practised copy of each term wins, so a running round is safe) */
   {const before=JSON.stringify(S),logV=AL.version();S=merged;saveLocal();
    var aw=AL.mergeWire(ra);AL.seedFrom(S);if(aw)aw=AL.wire();
    if((JSON.stringify(S)!==before||AL.version()!==logV)&&!sess&&view==='home')home()}
   const files={};
   if(JSON.stringify(merged)!==JSON.stringify(remote))files['progress.json']={content:JSON.stringify(merged)};
   /* aw is null when the remote log was written by a newer version of the app: it is left as it is */
   if(aw){const t=JSON.stringify(aw);if(t!==raTxt)files['answers.json']={content:t}}
   if(Object.keys(files).length)await gh('/gists/'+id,{method:'PATCH',body:JSON.stringify({files})});
   state.last=new Date();state.msg=''}
  catch(e){state.msg=e.message||'Could not reach GitHub. Progress is safe on this device and syncs next time.'}
  state.busy=false;draw()}
 window.onProgressSaved=()=>{if(!get(TK))return;clearTimeout(timer);timer=setTimeout(syncNow,4000)};
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncNow()});
 function draw(){const el=document.getElementById('sync');if(!el)return;const on=!!get(TK);
  if(form){el.innerHTML=`<span class="sy-box"><b>Sync between devices</b>
   <span>1. On GitHub, <a href="https://github.com/settings/tokens/new?scopes=gist&description=Polski%20sync" target="_blank" rel="noopener">create a token</a> with only the “gist” box ticked, then tap Generate token and copy it.</span>
   <span>2. Paste it here (it replaces any token saved before). Use the same token on your other device.</span>
   <input id="sy-in" type="password" autocomplete="off" placeholder="ghp_…" aria-label="GitHub token">
   <span class="sy-row"><button class="ghost" id="sy-save">Save and sync</button><button class="ghost" id="sy-x">Cancel</button></span></span>`;
   document.getElementById('sy-save').onclick=()=>{const v=document.getElementById('sy-in').value.trim();if(!v)return;set(TK,v);set(GI,null);form=false;syncNow()};
   document.getElementById('sy-x').onclick=()=>{form=false;draw()};return}
  const t=state.last?state.last.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):null;
  el.innerHTML=on?`${state.msg&&state.msg!=='Syncing…'?L('Problem z synchronizacją','sync problem')+': '+esc(state.msg):state.msg==='Syncing…'?L('Synchronizuję…','syncing…','synchronizować, ja-form'):L('Zsynchronizowano','synced between your devices','past passive form')+(t?' · '+L('ostatnio','last')+' '+t:'')}<br><button class="sy-link" id="sy-now">${L('Synchronizuj teraz','sync now','synchronizować, imperative')}</button> · <button class="sy-link" id="sy-tok">${L('Pokaż token','show token for another device','pokazać, imperative')}</button> · <button class="sy-link" id="sy-chg">${L('Zmień token','change token','zmienić, imperative')}</button> · <button class="sy-link" id="sy-off">${L('Wyłącz','turn off','wyłączyć, imperative')}</button>
   ${showTok?`<span class="sy-box"><b>Your sync token</b><span>Paste it on your other device under “Sync between devices”. Keep it private: it gives access to your gists.</span><input id="sy-tokv" type="text" readonly value="${esc(get(TK))}"><span class="sy-row"><button class="ghost" id="sy-copy">Copy</button><button class="ghost" id="sy-hide">Hide</button></span></span>`:''}`
   :`${L('Postęp tylko na tym urządzeniu.','progress is saved on this device only','na + locative: tym urządzeniu = this device')} <button class="sy-link" id="sy-on">${L('Ustaw synchronizację','set up sync','ustawić, imperative · synchronizację = accusative')}</button>`;
  const b1=document.getElementById('sy-on');if(b1)b1.onclick=()=>{form=true;draw()};
  const b2=document.getElementById('sy-now');if(b2)b2.onclick=syncNow;
  const bt=document.getElementById('sy-tok');if(bt)bt.onclick=()=>{showTok=true;draw()};
  const bh=document.getElementById('sy-hide');if(bh)bh.onclick=()=>{showTok=false;draw()};
  const bc=document.getElementById('sy-copy');if(bc)bc.onclick=()=>{const v=document.getElementById('sy-tokv');navigator.clipboard&&navigator.clipboard.writeText(v.value).then(()=>{bc.textContent='Copied'},()=>{v.select()})||v.select()};
  const bg=document.getElementById('sy-chg');if(bg)bg.onclick=()=>{form=true;draw()};
  const b3=document.getElementById('sy-off');if(b3)b3.onclick=()=>{set(TK,null);set(GI,null);state.last=null;state.msg='';draw()}}
 /* also sync each time the home screen is shown (at most every 20 s) */
 let lastHomeSync=0;const _home=window.home;window.home=function(){const r=_home.apply(this,arguments);
  if(!get(TK)){const a=document.getElementById('app');if(a&&!document.getElementById('sy-top')){a.insertAdjacentHTML('afterbegin','<button class="sybar" id="sy-top">'+ICON.nosync.replace('<svg','<svg class="sbi"')+L('Brak synchronizacji · ustaw','this device is not synced · set up sync','brak + genitive = no …, lack of …')+'</button>');document.getElementById('sy-top').onclick=()=>{settingsView();form=true;draw();const el=document.getElementById('sync');if(el)el.scrollIntoView({behavior:'smooth',block:'center'})}}}if(get(TK)&&Date.now()-lastHomeSync>20000){lastHomeSync=Date.now();setTimeout(syncNow,50)}return r};
 window.updSync=draw;if(!sess&&view==='home')window.home();draw();syncNow();
})();
</script>
<style>
.sy-link{background:none;border:0;padding:0;font:inherit;color:var(--blue);text-decoration:underline;cursor:pointer}
.sy-box{display:flex;flex-direction:column;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;color:var(--ink)}
.sy-box a{color:var(--blue)}
.sy-box input{font:inherit;font-size:16px;padding:9px 10px;border-radius:9px;border:1.5px solid var(--line);background:var(--paper);color:var(--ink)}
.sy-row{display:flex;gap:8px}
.sybar{display:flex;align-items:center;gap:8px;width:100%;border:0;border-radius:12px;background:var(--pen-soft);color:var(--pen);font-weight:700;font-size:14px;padding:8px 12px;text-align:left}.sybar .sbi{width:20px;height:20px;flex:none}
#sy-top{border-color:var(--pen);color:var(--pen);background:var(--pen-soft)}
#sy-tokv{font-family:ui-monospace,Menlo,monospace;font-size:13px}
</style>
<script>
/* ---------- feedback: tap the button, tap anything, comment; sent as an issue to the app's GitHub repo ---------- */
(function(){
 const FQ='pl-fbq',REPO='Ian-Cailliau/Polish',API='https://api.github.com';
 const getQ=()=>{try{return JSON.parse(localStorage.getItem(FQ)||'[]')}catch(e){return []}},setQ=q=>{try{localStorage.setItem(FQ,JSON.stringify(q))}catch(e){}};
 const tok=()=>{try{return localStorage.getItem('pl-gh-token')}catch(e){return null}};
 const b=document.createElement('button');b.id='fbk';b.setAttribute('aria-label','Feedback');b.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224,124h0a92,92,0,0,1-92,92H48a8,8,0,0,1-8-8V124a92,92,0,0,1,92-92h0A92,92,0,0,1,224,124Z" opacity="0.2"/><path d="M172,112a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h68A8,8,0,0,1,172,112Zm-8,24H96a8,8,0,0,0,0,16h68a8,8,0,0,0,0-16Zm68-12A100.11,100.11,0,0,1,132,224H48a16,16,0,0,1-16-16V124a100,100,0,0,1,200,0Zm-16,0a84,84,0,0,0-168,0v84h84A84.09,84.09,0,0,0,216,124Z"/></svg>';document.body.appendChild(b);
 const bar=document.createElement('div');bar.id='pickbar';bar.hidden=true;document.body.appendChild(bar);
 let picking=false,hov=null;
 const stopPick=()=>{picking=false;bar.hidden=true;document.body.classList.remove('picking');if(hov)hov.classList.remove('fbhov');hov=null};
 b.onclick=e=>{e.stopPropagation();if(picking)return stopPick();picking=true;document.body.classList.add('picking');
  bar.innerHTML=L('Wybierz, czego dotyczy uwaga','tap the thing you want to comment on','wybrać, imperative · uwaga = remark')+' <button class="sy-link" id="pick-x">'+L('Anuluj','cancel')+'</button>';bar.hidden=false;
  document.getElementById('pick-x').onclick=ev=>{ev.stopPropagation();stopPick()}};
 document.addEventListener('mouseover',e=>{if(!picking||e.target.closest('#fbk,#pickbar'))return;if(hov)hov.classList.remove('fbhov');hov=e.target;hov.classList.add('fbhov')});
 document.addEventListener('click',e=>{if(!picking||e.target.closest('#fbk,#pickbar,#fbsheet'))return;e.preventDefault();e.stopPropagation();const el=e.target;stopPick();openSheet(el)},true);
 function context(){const c=(typeof sess!=='undefined'&&sess&&sess.queue)?sess.queue[sess.i]:null,ti=document.getElementById('ti');
  return {screen:(sess&&c)?(sess.test?'mock test':sess.nut?'twardy orzech':'round'):view,round:sess?sess.title:null,item:c?c.it.id:null,prompt:c&&c.q?c.q.prompt:null,answer:c&&c.q?((c.q.accept&&c.q.accept[0])||c.q.mcAnswer||c.q.answer):null,typed:ti&&ti.value?ti.value:null,when:new Date().toISOString(),device:/iPhone|iPad/.test(navigator.userAgent)?'iPhone':/Mac|Windows|Linux/.test(navigator.userAgent)?'computer':'other'}}
 function openSheet(el){el.classList.add('fbsel');const snip=(el.innerText||el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,240)||'(element without text)';const ctx=context();
  const sh=document.createElement('div');sh.id='fbsheet';sh.innerHTML=`<div class="fbs"><b>${L('Uwaga','feedback','lit. “remark”')}</b>
   <p class="fbsnip">${esc(snip)}</p><textarea id="fbtext" rows="4" placeholder="What is wrong, or what would you like? (English is fine)"></textarea>
   <p class="note" id="fbmsg"></p><div class="sy-row"><button class="check" id="fbsend">${L('Wyślij','send','wysłać, imperative')}</button><button class="ghost" id="fbcancel">${L('Anuluj','cancel')}</button></div></div>`;
  document.body.appendChild(sh);const close=()=>{sh.remove();el.classList.remove('fbsel')};
  document.getElementById('fbcancel').onclick=close;document.getElementById('fbtext').focus();
  document.getElementById('fbsend').onclick=async()=>{const txt=document.getElementById('fbtext').value.trim();if(!txt)return;
   const q=getQ();q.push({snip,txt,ctx});setQ(q);const m=await flush();document.getElementById('fbmsg').innerHTML=m;
   if(/^Sent/.test(m))setTimeout(close,900);else{document.getElementById('fbsend').hidden=true;document.getElementById('fbcancel').textContent='OK'}}}
 async function flush(){const q=getQ();if(!q.length)return '';const t=tok();
  if(!t)return 'Saved on this device. It is sent automatically once sync is set up (Ustawienia → Synchronizacja).';
  const left=[];let msg='Sent. Thanks!';
  for(const f of q){const body='**Selected:** '+f.snip+'\\n\\n**Comment:** '+f.txt+'\\n\\n```json\\n'+JSON.stringify(f.ctx,null,1)+'\\n```';
   const post=labels=>fetch(API+'/repos/'+REPO+'/issues',{method:'POST',headers:{'Authorization':'Bearer '+t,'Accept':'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({title:'Feedback: '+f.txt.slice(0,70),body,...(labels?{labels:['feedback']}:{})})});
   try{let r=await post(1);if(r.status===422)r=await post(0);
    if(!r.ok){left.push(f);msg=(r.status===401||r.status===403||r.status===404)?'Saved, not sent yet: your token cannot create issues. On GitHub open <a href="https://github.com/settings/tokens" target="_blank" rel="noopener">Settings → Tokens</a>, open your token, tick <b>public_repo</b> and tap Update token (the token itself stays the same). It is then sent automatically.':'Saved, not sent yet (GitHub answered '+r.status+'). It is retried automatically.'}}
   catch(e){left.push(f);msg='Saved, not sent yet: no connection. It is retried automatically.'}}
  setQ(left);return msg}
 setTimeout(flush,3000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')flush()});
})();
</script>
<style>
#fbk{position:fixed;z-index:25;right:max(14px,env(safe-area-inset-right,0px));bottom:calc(86px + env(safe-area-inset-bottom,0px));width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--blue);display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,.12);padding:0}
#fbk svg{width:24px;height:24px}#nav[hidden]~#fbk{bottom:calc(16px + env(safe-area-inset-bottom,0px))}
body.has-sheet #fbk,body.has-sheet #nav[hidden]~#fbk{bottom:calc(var(--sheet-h,0px) + 12px)}
body.picking #fbk{background:var(--blue);color:var(--on-blue)}
#pickbar{position:fixed;z-index:26;left:0;right:0;top:0;padding:calc(10px + env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px));background:var(--blue);color:var(--on-blue);font-weight:700;font-size:14.5px}
#pickbar .sy-link{color:inherit}
.fbhov{outline:2px dashed var(--blue)!important;outline-offset:2px}.fbsel{outline:3px solid var(--blue)!important;outline-offset:2px}
#fbsheet{position:fixed;z-index:30;inset:auto 0 0 0;padding:0 max(12px,env(safe-area-inset-right,0px)) calc(12px + env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px))}
.fbs{max-width:560px;margin:0 auto;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:8px;box-shadow:0 -6px 30px rgba(0,0,0,.18)}
.fbsnip{margin:0;font-size:13.5px;color:var(--muted);background:var(--paper);border-radius:10px;padding:8px 10px;max-height:5.5em;overflow:auto}
#fbtext{font:inherit;font-size:16px;border:1.5px solid var(--line);border-radius:12px;padding:10px;background:var(--paper);color:var(--ink);resize:vertical}
</style>

<script>
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
if('serviceWorker' in navigator){addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{})})}
</script>
</body></html>
'''
body=src
a="drawNav();$('#t-home').onclick=()=>home();$('#t-sheet').onclick=sheet;$('#t-set').onclick=()=>settingsView();"
assert body.count(a)==1
import time
SEED_ID=str(int(time.time()))
if seed: body=body.replace(a,a+"\n/* progress carried over from the Claude version: merged once per seed, the more-practised copy of each term wins */\nconst SEED="+json.dumps(seed,ensure_ascii=False)+",SEED_ID='"+SEED_ID+"';\nif(S._seed!==SEED_ID){S=Object.keys(S).length?mergeS(S,SEED):JSON.parse(JSON.stringify(SEED));S._seed=SEED_ID;saveLocal()}")
import re as _re
body=_re.sub(r'<!--CLAUDE-ONLY-->.*?<!--/CLAUDE-ONLY-->','',body,flags=_re.S)
open(OUT+'index.html','w').write(head+body+tail)
im=Image.open(HERE+'icon.png').convert('RGB')
for n,sz in [('apple-touch-icon.png',180),('icon-192.png',192),('icon-512.png',512)]:
    im.resize((sz,sz),Image.LANCZOS).save(OUT+n,optimize=True)
json.dump({"name":"Polski · Test 1","short_name":"Polski","start_url":"./","scope":"./","display":"standalone",
 "background_color":"#F4F6FA","theme_color":"#2450C4",
 "icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png","purpose":"any maskable"}]},
 open(OUT+'manifest.webmanifest','w'),ensure_ascii=False,indent=1)
open(OUT+'sw.js','w').write('''// network first, so updates arrive straight away; cached copy when offline
const C='polski-v1';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','apple-touch-icon.png','icon-192.png','manifest.webmanifest'])))});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;
 const u=new URL(r.url);if(u.origin!==location.origin&&!/fonts\\.(googleapis|gstatic)\\.com$/.test(u.hostname))return;
 e.respondWith(fetch(r).then(res=>{if(res.ok||res.type==='opaque'){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))))});
''')
open(OUT+'.nojekyll','w').write('')
pass  # README.md is maintained by hand
print('built', OUT+'index.html', '(progress import: %d terms)' % (len(seed) if seed else 0))
