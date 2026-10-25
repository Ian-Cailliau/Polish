// Twardy orzech and the answer log, through the real screens. Usage: node nut.js [PORT]  (exits 1 on any failure)
//  1. progress from before the log is seeded once per term, and S is not touched
//  2. the round is drawn from the met terms, weighted toward low chances, and differs from draw to draw
//  3. drill to criterion: a miss comes back after 2 others, a right retry is checked after 6 more, then it is cracked
//  4. every answer is logged (term, result, round id, attempt number, mode)
//  5. closing the app mid-round resumes with the drill state intact
//  6. “Była dobra” takes the repeat back out, logs a correction, and the term counts as cracked
//  7. the round counts as a round (counter +1) but does not set the accuracy that cuts new terms
//  8. with nothing below the bar, new terms come in; with nothing met at all, the round teaches new terms
const {chromium}=require('playwright-core');const fs=require('fs');const PORT=process.argv[2]||'8765';
const ids=JSON.parse(fs.readFileSync(__dirname+'/terms-fixture.json','utf8')).ids;
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route('**/sw.js',r=>r.abort());
 const fails=[];const F=(ok,m)=>{console.log((ok?'✓ ':'✗ ')+m);if(!ok)fails.push(m)};
 await p.goto('http://127.0.0.1:'+PORT+'/');await p.waitForTimeout(300);
 /* 40 met terms: the first 20 weak (mistakes, low level), the next 20 solid */
 const met=ids.filter(id=>!/^(city:|ile:)/.test(id)).slice(0,40);
 const S0={};met.forEach((id,k)=>{S0[id]=k<20?{b:0,n:4,w:3,ws:2,f:'2026-10-23',due:0,lr:'w'}:{b:5,n:8,w:0,f:'2026-10-22',due:30,lr:'r'}});Object.assign(S0,{_r:7});
 await p.evaluate(S0=>{localStorage.clear();localStorage.setItem('pl-test1',JSON.stringify(S0))},S0);
 await p.reload();await p.waitForTimeout(500);
 // 1. seeds
 const s1=await p.evaluate(()=>({n:AL.count(),seeds:AL.events().filter(e=>e.ev==='seed').length,S:JSON.parse(localStorage.getItem('pl-test1'))}));
 F(s1.seeds===40&&s1.n===40,`one seed per met term (${s1.seeds} seeds, ${s1.n} events)`);
 F(Object.keys(S0).every(k=>JSON.stringify(S0[k])===JSON.stringify(s1.S[k])),'the old progress itself is untouched');
 await p.reload();await p.waitForTimeout(300);F(await p.evaluate(()=>AL.count())===40,'reloading does not seed again');
 const tile=await p.textContent('#go-nut');F(!/gotowość|\d+%/.test(tile),`the Twardy orzech button stays clean, no readiness on it: “${tile.trim().replace(/\s+/g,' ')}”`);
 // 2. selection
 const sel=await p.evaluate(()=>{const cnt={},orders=new Set();let fresh=0;for(let k=0;k<150;k++){const r=planNut(ENGINE.pick.rng(k+1));orders.add(r.queue.map(e=>e.it.id).join());
  r.queue.forEach(e=>{cnt[e.it.id]=(cnt[e.it.id]||0)+1;if(e.st==='intro')fresh++})}return {cnt,orders:orders.size,fresh}});
 const weak=met.slice(0,20).reduce((s,id)=>s+(sel.cnt[id]||0),0),solid=met.slice(20).reduce((s,id)=>s+(sel.cnt[id]||0),0);
 F(weak>solid*3,`weak terms drawn far more often than solid ones (${weak} vs ${solid} draws over 150 rounds)`);
 F(sel.orders>140,`a different round nearly every time (${sel.orders} distinct of 150)`);
 F(sel.fresh===0,'with 20 terms under the bar, no new terms come in');
 // play helpers
 const cur=()=>p.evaluate(()=>{const c=sess.queue[sess.i];return c?{id:c.it.id,i:sess.i,st:c.st,kind:c.q&&c.q.kind,retry:!!c.retry,confirm:!!c.confirm,tries:c.tries||1,len:sess.queue.length}:null});
 const answer=async mode=>{const c=await cur();
  if(await p.$('#got')){await p.click('#got');return 'card'}
  if(c.kind==='mc'){await p.evaluate(()=>{const q=sess.queue[sess.i].q,good=q.valid||[q.mcAnswer||q.answer];document.querySelectorAll('.opt')[q.options.findIndex(o=>good.includes(o))].click()});await p.click('#nx');return 'mc'}
  if(c.kind==='reveal'){await p.click('#rv');await p.click('#kn');return 'reveal'}
  await p.evaluate(m=>{const q=sess.queue[sess.i].q;let a=q.accept?q.accept[0]:q.valid?q.valid[0]:(q.mcAnswer||q.answer);if(/^\d+$/.test(a)&&q.check)a='0123 456 789';if(m==='wrong')a='qqq';document.getElementById('ti').value=a},mode);
  await p.click('#tf .check');return 'type'};
 const nextQ=async()=>{if(await p.$('#nx'))await p.click('#nx')};
 // 3. drill to criterion
 await p.click('#go-nut');await p.waitForTimeout(200);
 const st0=await p.evaluate(()=>({nut:!!sess.nut,mode:sess.mode,len:sess.queue.length,sid:sess.sid,ready0:sess.ready0}));
 F(st0.nut&&st0.mode==='nut'&&st0.len===20&&st0.ready0>0,`a Twardy orzech round of ${st0.len} terms starts (readiness ${Math.round(st0.ready0*100)}%)`);
 // get to the first written question
 let c=await cur();while(c.kind!=='type'){await answer('right');c=await cur()}
 const T=c.id,at0=c.i;await answer('wrong');
 const q1=await p.evaluate(T=>sess.queue.map((e,k)=>({k,id:e.it.id,retry:!!e.retry,confirm:!!e.confirm,tries:e.tries||1})).filter(e=>e.id===T&&e.k>sess.i),T);
 F(q1.length===1&&q1[0].k===at0+3&&q1[0].retry&&!q1[0].confirm&&q1[0].tries===2,`a miss comes back after 2 others (at ${q1[0]&&q1[0].k-at0} places on, attempt ${q1[0]&&q1[0].tries})`);
 await nextQ();
 while((c=await cur()).id!==T){const k=await answer('right');if(k==='type')await nextQ()}
 F(c.retry&&!!(await p.$('.mx.r')),'the repeat is shown as the 2nd attempt');
 await answer('right');
 const q2=await p.evaluate(T=>sess.queue.map((e,k)=>({k,id:e.it.id,confirm:!!e.confirm})).filter(e=>e.id===T&&e.k>sess.i),T),at1=(await cur()).i;
 F(q2.length===1&&q2[0].confirm&&q2[0].k===at1+7,`right on the repeat: one check later, after 6 others (${q2[0]&&q2[0].k-at1} places on)`);
 await nextQ();
 // 5. resume in the middle, with the check still to come
 await answer('right');await nextQ();await p.reload();await p.waitForTimeout(400);
 if(await p.$('#go-resume'))await p.click('#go-resume');
 const rs=await p.evaluate(T=>({nut:!!sess.nut,sid:sess.sid,check:sess.queue.some((e,k)=>k>=sess.i&&e.it.id===T&&e.confirm),extra:sess.extra,status:sess.nutStatus&&sess.nutStatus[T]}),T);
 F(rs.nut&&rs.sid===st0.sid&&rs.check&&rs.extra===2&&rs.status==='pending',`after closing the app the round resumes with its drill state (check pending, ${rs.extra} repeats used)`);
 while((c=await cur()).id!==T){const k=await answer('right');if(k==='type')await nextQ()}
 F(c.confirm&&/sprawdzenie/.test(await p.textContent('.lab')),'the check is labelled as a check');
 await answer('right');await nextQ();
 F(await p.evaluate(T=>sess.nutStatus[T],T)==='cracked','right on the check: cracked');
 // 4. the log of that term in this round
 const lg=await p.evaluate(([T,sid])=>AL.events().filter(e=>e.term===T&&e.sid===sid&&e.ev==='answer').map(e=>[e.res,e.att,e.mode,e.kind].join(':')),[T,st0.sid]);
 F(lg.join(' ')==='wrong:1:nut:type right:2:nut:type right:3:nut:type',`every answer is logged with result, attempt and round type (${lg.join(' ')})`);
 // 6. Była dobra on a first miss
 c=await cur();while(c&&(c.kind!=='type'||c.retry)){const k=await answer('right');if(k==='type')await nextQ();c=await cur()}
 if(c){const U=c.id,len=c.len;await answer('wrong');const after=(await cur()).len;
  const ov=await p.$('#ov');
  if(ov){await ov.click();const r=await p.evaluate(([U,len])=>({len:sess.queue.length,back:sess.queue.some((e,k)=>k>=sess.i&&e.it.id===U),status:sess.nutStatus[U],amend:AL.events().filter(e=>e.ev==='amend'&&e.term===U).length,st:ENGINE.model.states(AL.events(),MEM.model()).get(U)}),[U,len]);
   F(after===len+1&&r.len===len&&!r.back&&r.status==='cracked'&&r.amend===1,`“Była dobra”: the repeat is taken out again (${after} → ${r.len}), a correction is logged, and the term is cracked`)}
  else F(false,'“Była dobra” button shown after a first written miss')}
 // 7. finish the round
 for(let k=0;k<120&&!(await p.$('.score'));k++){const k2=await answer('right');if(k2==='type')await nextQ()}
 const fin=await p.evaluate(()=>({r:S._r,acc:S._acc||null,more:document.getElementById('more').textContent,lede:document.querySelector('.lede').textContent}));
 F(fin.r===8&&!fin.acc,`it counts as a round (round ${fin.r}) and leaves the new-term budget alone`);
 F(/Następny orzech/.test(fin.more)&&/Readiness for the test: \d+% → \d+%/.test(fin.lede),`results: readiness before → after (“${(fin.lede.match(/Readiness[^.]*/)||[''])[0]}”)`);
 await p.screenshot({path:'/tmp/nut-results.png',fullPage:true});
 // 8. new terms: nothing under the bar → new terms come in; nothing met → the round teaches new terms
 const nw=await p.evaluate(()=>{const keep=JSON.stringify(S);
  const t0=Date.now();Object.keys(S).forEach(k=>{if(k[0]!=='_')S[k]={b:6,n:9,w:0,f:'2026-10-20',due:99,lr:'r'}});
  /* all met terms just answered right many times, spread over the last days: high chance at the test */
  const ev=[];Object.keys(S).filter(k=>k[0]!=='_').forEach(id=>{for(let d=6;d>=0;d--)ev.push({id:'x'+id+d,t:t0-d*864e5-36e5,term:id,ev:'answer',kind:'type',res:'right'})});
  AL.mergeWire(ENGINE.log.encode({v:1,resetAt:0,events:ev}));
  const r=planNut(ENGINE.pick.rng(3)),below=r.plan.below,fresh=r.queue.filter(e=>e.st==='intro').length;
  S={};AL.reset();const r2=planNut(ENGINE.pick.rng(4));S=JSON.parse(keep);
  return {below,fresh,met2:r2.plan.met,fresh2:r2.queue.filter(e=>e.st==='intro').length,len2:r2.queue.length}});
 F(nw.fresh>0,`with ${nw.below} met terms under the bar, new terms come in (${nw.fresh} new)`);
 F(nw.met2===0&&nw.fresh2>0,`with nothing met yet, the round teaches new terms (${nw.fresh2} cards)`);
 // 9. the fit: with enough answers after a break it fits in the background, and the settings show it
 await p.evaluate(()=>{const t0=Date.now(),ev=[];Object.keys(S).filter(k=>k[0]!=='_').forEach((id,k)=>{for(let d=6;d>=1;d--)ev.push({id:'f'+k+'.'+d,t:t0-d*864e5+k*6e4,term:id,ev:'answer',kind:'type',res:(k+d)%4?'right':'wrong'})});AL.mergeWire(ENGINE.log.encode({v:1,resetAt:0,events:ev}));MEM.ensure(false)});
 let fitted=null;for(let k=0;k<40&&!fitted;k++){await p.waitForTimeout(250);fitted=await p.evaluate(()=>{const m=MEM.model();return m&&m.chosen!=='default'?{chosen:m.chosen,n:m.report.n,where:MEM.where()}:null})}
 F(!!fitted,`with enough answers after a break the model is fitted to them (${fitted?`${fitted.chosen}, ${fitted.n} answers, in the ${fitted.where}`:'not fitted'})`);
 F(fitted&&fitted.where==='worker','…in a background worker, so the screen never waits for it');
 await p.click('#hm').catch(()=>{});await p.click('#t-set');await p.click('#modeld summary');await p.waitForTimeout(200);
 const mt=await p.textContent('#model');F(/Fitted to your \d+ answers/.test(mt)&&/Readiness/.test(mt),'the settings show the fitted model and readiness');
 F(!errs.length,'no errors'+(errs.length?': '+errs.join(' | '):''));
 console.log(fails.length?`✗ ${fails.length} Twardy orzech checks failed`:'✓ Twardy orzech checks hold');
 await b.close();process.exitCode=fails.length?1:0})();
