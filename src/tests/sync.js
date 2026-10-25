// Sync between two devices through a fake GitHub gist (progress.json + answers.json). Usage: node sync.js [PORT]  (exits 1 on failure)
//  1. the first device creates the gist with both files
//  2. the second finds it, takes in the first device's answers, and adds its own; afterwards both devices hold the same log
//  3. syncing again changes nothing (no rewrite when nothing is new)
//  4. a long log that GitHub cuts short in the API answer is read in full from raw_url
//  5. a log written by a newer app version is left alone
//  6. a reset on one device reaches the other (progress and log), instead of being undone by the next sync
const {chromium}=require('playwright-core');const PORT=process.argv[2]||'8765';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium'});
 const fails=[];const F=(ok,m)=>{console.log((ok?'✓ ':'✗ ')+m);if(!ok)fails.push(m)};const errs=[];
 /* the fake gist: one per test run; TRUNC = cut answers.json short in API answers above this many characters */
 const G={id:'g1',exists:false,files:{},patches:0,TRUNC:Infinity};
 async function device(name){const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(name+': '+e.message));
  await p.route('**/sw.js',r=>r.abort());
  await p.route('https://api.github.com/**',async r=>{const u=new URL(r.request().url()),m=r.request().method(),body=r.request().postData();
   const view=()=>({id:G.id,description:'polski-test-1 progress',files:Object.fromEntries(Object.entries(G.files).map(([k,v])=>[k,v.length>G.TRUNC&&k==='answers.json'?{content:v.slice(0,G.TRUNC),truncated:true,raw_url:'https://gist.githubusercontent.com/raw/'+k}:{content:v,truncated:false}]))});
   if(u.pathname==='/gists'&&m==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(G.exists?[{id:G.id,description:'polski-test-1 progress'}]:[])});
   if(u.pathname==='/gists'&&m==='POST'){G.exists=true;Object.entries(JSON.parse(body).files).forEach(([k,v])=>G.files[k]=v.content);return r.fulfill({status:201,contentType:'application/json',body:JSON.stringify(view())})}
   if(u.pathname==='/gists/'+G.id&&m==='GET')return r.fulfill({status:G.exists?200:404,contentType:'application/json',body:JSON.stringify(G.exists?view():{})});
   if(u.pathname==='/gists/'+G.id&&m==='PATCH'){G.patches++;Object.entries(JSON.parse(body).files).forEach(([k,v])=>G.files[k]=v.content);return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(view())})}
   return r.fulfill({status:404,body:'{}'})});
  await p.route('https://gist.githubusercontent.com/**',r=>{const k=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({status:200,contentType:'text/plain',body:G.files[k]||''})});
  await p.goto('http://127.0.0.1:'+PORT+'/');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('pl-gh-token','ghp_fake')});
  return {p,ctx}}
 const sync=async p=>{await p.reload();await p.waitForTimeout(1200)};
 /* a few answers on a device, through the answer log service, plus the progress they would leave */
 const practise=(p,terms,res)=>p.evaluate(([terms,res])=>{terms.forEach(id=>{S[id]=S[id]||{b:1,n:0,w:0,f:dayKey(),due:0};S[id].n++;AL.add({term:id,ev:'answer',kind:'type',res,sid:'t',att:1,mode:'learn'})});save()},[terms,res]);
 const state=p=>p.evaluate(()=>({ids:AL.events().map(e=>e.id).sort(),wire:JSON.stringify(AL.wire()),S:Object.keys(S).filter(k=>k[0]!=='_').sort()}));
 const A=await device('A'),B=await device('B');
 // 1.
 await sync(A.p);await practise(A.p,['v:być:0','v:być:1','n:3'],'right');await sync(A.p);
 const g1=G.files['answers.json']?JSON.parse(G.files['answers.json']):null;
 F(G.exists&&!!G.files['progress.json']&&g1&&g1.e.length===3,`the first device's sync puts progress.json and answers.json in the gist (${g1&&g1.e.length} events)`);
 // 2.
 await sync(B.p);const b1=await state(B.p);
 F(b1.ids.length===3&&b1.S.length===3,`the second device takes in the first one's answers (${b1.ids.length}) and progress (${b1.S.length} terms)`);
 await practise(B.p,['n:3','kr:Polska:g'],'wrong');await sync(B.p);await sync(A.p);
 const a2=await state(A.p),b2=await state(B.p);
 F(a2.ids.length===5&&a2.wire===b2.wire,`after both have synced, both hold the same log (${a2.ids.length} events, identical on the wire)`);
 F(a2.S.includes('kr:Polska:g'),'and the same progress');
 // 3.
 const before=G.patches;await sync(A.p);await sync(B.p);
 F(G.patches===before,`syncing again with nothing new writes nothing (${G.patches-before} writes)`);
 // 4.
 G.TRUNC=200;await practise(B.p,['w:1','w:2','w:3','w:4'],'right');await sync(B.p);await sync(A.p);
 const a4=await state(A.p);F(a4.ids.length===9,`a log cut short in the API answer is read in full from raw_url (${a4.ids.length} events)`);G.TRUNC=Infinity;
 // 5.
 const newer=JSON.stringify({v:99,resetAt:0,terms:[],e:[],future:'format'});G.files['answers.json']=newer;
 await practise(A.p,['w:5'],'right');await sync(A.p);
 F(G.files['answers.json']===newer,'a log written by a newer app version is not overwritten');
 F(!errs.length,'no errors'+(errs.length?': '+errs.join(' | '):''));
 G.files['answers.json']=JSON.stringify(await A.p.evaluate(()=>AL.wire()));
 // 6.
 await A.p.click('#t-set');await A.p.click('#reset');await A.p.click('#reset');await A.p.waitForTimeout(300);await sync(A.p);await sync(B.p);
 const a6=await state(A.p),b6=await state(B.p),gS=JSON.parse(G.files['progress.json']),gA=JSON.parse(G.files['answers.json']);
 F(!a6.S.length&&!b6.S.length&&!Object.keys(gS).some(k=>k[0]!=='_'),`a reset on one device reaches the other: no progress left anywhere (A ${a6.S.length}, B ${b6.S.length} terms)`);
 F(!a6.ids.length&&!b6.ids.length&&!gA.e.length&&gA.resetAt>0,`…and no answers left in any log (A ${a6.ids.length}, B ${b6.ids.length}, gist ${gA.e.length})`);
 await practise(B.p,['n:1'],'right');await sync(B.p);await sync(A.p);
 F((await state(A.p)).ids.length===1,'practice after the reset syncs as usual');
 F(!errs.length,'no errors'+(errs.length?': '+errs.join(' | '):''));
 console.log(fails.length?`✗ ${fails.length} sync checks failed`:'✓ sync checks hold');await b.close();process.exitCode=fails.length?1:0})();
