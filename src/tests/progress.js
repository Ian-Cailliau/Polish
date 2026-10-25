// Your progress survives the update: a copy of saved progress (every term id with a level, plus an open round)
// is loaded into the new build. Usage: node progress.js [PORT]  (exits 1 on any failure)
// Checks: every saved term id is still a term, levels are untouched, the open round resumes, nothing throws.
const {chromium}=require('playwright-core');const fs=require('fs');const PORT=process.argv[2]||'8765';
const ids=JSON.parse(fs.readFileSync(__dirname+'/terms-fixture.json','utf8')).ids;
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route('**/sw.js',r=>r.abort());
 /* a copy of progress as the old app saved it: every term, mixed levels and mistakes, day / round counters, settings */
 const S={};ids.forEach((id,k)=>{S[id]={b:k%5,n:3+k%4,w:k%3,ws:k%2,f:'2026-10-22',due:k%7,lr:k%4?'r':'w'}});
 Object.assign(S,{_r:12,_d:{d:'2026-10-24',n:40},_mix:{n:6,m:10,c:4},_hide:{'city:Gandawa':1},_show:{'city:Kraków':1},_bk:{'verb:być:sg':1,'kraje:ii':1}});
 const round={title:'Nauka',test:false,i:1,fresh:0,queue:[{id:'v:mieć:1',st:'write',slot:'fix'},{id:'kr:Polska:g',st:'write',slot:'rev'},{id:'qa:imie:form',st:'write',slot:'fix'}],log:[{id:'v:mieć:1',res:'right',given:'masz',counts:true,firstTry:true,slot:'fix'}],done:['v:mieć:1'],at:Date.now()};
 await p.goto('http://127.0.0.1:'+PORT+'/');
 await p.evaluate(([S,round])=>{localStorage.setItem('pl-test1',JSON.stringify(S));localStorage.setItem('pl-test1-round',JSON.stringify(round))},[S,round]);
 await p.reload();await p.waitForTimeout(600);
 const r=await p.evaluate(saved=>{const now=JSON.parse(localStorage.getItem('pl-test1'));const terms=new Set(ITEMS.map(i=>i.id));
  const orphan=Object.keys(saved).filter(k=>k[0]!=='_'&&!terms.has(k));const changed=Object.keys(saved).filter(k=>k[0]!=='_'&&JSON.stringify(saved[k])!==JSON.stringify(now[k]));
  return {orphan,changed,resumed:!!sess&&sess.i===1&&sess.queue[sess.i].it.id==='kr:Polska:g',screen:!!document.getElementById('ti'),round:now._r,hidden:hidden('city:Gandawa'),shown:!hidden('city:Kraków')}},S);
 const F=(ok,m)=>{console.log((ok?'✓ ':'✗ ')+m);return ok};
 const ok=[F(!r.orphan.length,`every saved term id is still a term (${ids.length} ids${r.orphan.length?'; orphans: '+r.orphan.join(', '):''})`),
  F(!r.changed.length,`saved levels untouched on load${r.changed.length?': '+r.changed.slice(0,5).join(', '):''}`),
  F(r.resumed&&r.screen,'the open round resumes at the same exercise'),F(r.round===12&&r.hidden&&r.shown,'round counter and hidden / shown terms kept'),
  F(!errs.length,'no errors'+(errs.length?': '+errs.join(' | '):''))].every(Boolean);
 await b.close();process.exitCode=ok?0:1})();
