// The learning engine on its own (no browser): the answer log, the memory model and its fit, Thompson sampling and the
// Twardy orzech drill rule. Reads the ENGINE block out of app.html. Usage: node engine.js   (exits 1 on any failure)
//  log      encode / decode round trip, merge is a union (idempotent, commutative), reset time, seeds, trimming, newer versions
//  model    the forgetting curve, what a right / wrong / spaced / massed answer does, corrections
//  fit      a simulated learner with known forgetting rates: the fit finds them back; families are used when they differ and
//           pulled to the global rate when they do not; too few answers → defaults
//  pick     Thompson sampling: weighted toward low chances, still random, repeatable with a seed
//  nut      the drill-to-criterion sequence
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(__dirname+'/../app.html','utf8');
const m=src.match(/\/\* ========== ENGINE:BEGIN[\s\S]*?\/\* ========== ENGINE:END ========== \*\//);
if(!m){console.log('✗ ENGINE block not found in app.html');process.exit(1)}
const ctx={};vm.createContext(ctx);vm.runInContext(m[0]+'\nthis.ENGINE=ENGINE;',ctx);const E=ctx.ENGINE;
const fails=[];const F=(ok,msg)=>{console.log((ok?'✓ ':'✗ ')+msg);if(!ok)fails.push(msg)};
const DAY=864e5,T0=Date.UTC(2026,9,20,7);

/* ---------- log ---------- */
{const ev=(id,t,term,more)=>({id,t,term,ev:'answer',kind:'type',res:'right',sid:'s1',att:1,mode:'nut',...more});
 const A={v:1,resetAt:0,events:[ev('a1',T0,'v:być:0'),ev('a2',T0+1000,'v:być:1',{res:'wrong'}),ev('a3',T0+2000,'kr:Polska:g',{kind:'mc',res:'accent',mode:'zzz-new-mode'})]};
 const B={v:1,resetAt:0,events:[ev('a2',T0+1000,'v:być:1',{res:'wrong'}),ev('b1',T0+500,'n:3',{ev:'seen'})]};
 const rt=E.log.decode(JSON.parse(JSON.stringify(E.log.encode(E.log.merge(A,null)))));
 F(JSON.stringify(rt.events)===JSON.stringify(E.log.merge(A,null).events),'encode → JSON → decode gives the same events (an unknown mode passes through)');
 const ab=E.log.merge(A,B),ba=E.log.merge(B,A);
 F(ab.events.length===4&&JSON.stringify(ab)===JSON.stringify(ba),'merge is a union, the same in both directions (4 events, a2 once)');
 F(JSON.stringify(E.log.merge(ab,ab))===JSON.stringify(ab)&&JSON.stringify(E.log.merge(ab,B))===JSON.stringify(ab),'merging again changes nothing');
 F(ab.events.map(e=>e.id).join()==='a1,b1,a2,a3','events are kept in time order');
 const R=E.log.merge(ab,{v:1,resetAt:T0+800,events:[]});
 F(R.resetAt===T0+800&&R.events.map(e=>e.id).join()==='a2,a3','a reset on one device drops everything before it on every device');
 const s1={id:'seed:v:być:0',t:T0,term:'v:być:0',ev:'seed',x:{b:2,n:5,w:1}},s2={...s1,t:T0+9,x:{b:3,n:8,w:1}};
 F(E.log.merge({v:1,resetAt:0,events:[s1]},{v:1,resetAt:0,events:[s2]}).events[0].x.n===8&&E.log.merge({v:1,resetAt:0,events:[s2]},{v:1,resetAt:0,events:[s1]}).events[0].x.n===8,'the same seed from two devices: the more-practised copy wins, in both directions');
 const many={v:1,resetAt:0,events:[s1,...Array.from({length:30},(_,i)=>ev('m'+i,T0+i*1000,'n:'+(i%10)))]};
 const tr=E.log.trim(many,10);F(tr.events.length===10&&tr.events.some(e=>e.ev==='seed')&&tr.events[tr.events.length-1].id==='m29','trimming keeps the newest events and every seed');
 F(E.log.decode({v:2,terms:[],e:[]})===null&&E.log.decode('x')===null&&E.log.decode(null)===null,'a log from a newer version, or not a log, decodes to null (it must not be overwritten)');
 const junk=E.log.decode({v:1,terms:['n:1'],e:[['ok',T0,0,'a','t','r'],'junk',[null,T0,0],['bad','x',0,'a']]});
 F(junk.events.length===1&&junk.events[0].res==='right','broken rows are skipped, good rows kept');
 const size=JSON.stringify(E.log.encode({v:1,resetAt:0,events:Array.from({length:1000},(_,i)=>ev('k3x9'+i.toString(36)+'abcde',T0+i*6e4,'qa:skad:form',{sid:'s'+(i>>4).toString(36)}))})).length;
 F(size<60000,`compact on the wire: 1000 answers in ${(size/1000).toFixed(0)} kB`)}

/* ---------- model ---------- */
{const M=E.model,P=M.DEFAULTS;
 F(Math.abs(M.recall(3,3)-0.9)<1e-9&&Math.abs(M.recall(M.HALF*3,3)-0.5)<1e-9&&M.recall(0,1)===1,'forgetting curve: 90% after S days, 50% after the half-life, 100% right away');
 const st=(g,t)=>({g,t});
 const run=steps=>M.replayTerm(steps,P,1,0.25,[]);
 const first=run([st('seen',0),st('ok',0.01)]);
 const spaced=run([st('seen',0),st('ok',0.01),st('ok',2)]),massed=run([st('seen',0),st('ok',0.01),st('ok',0.012),st('ok',0.014)]);
 F(spaced.S>first.S*2&&massed.S<first.S*1.05,`a right answer after 2 days grows S a lot (${first.S.toFixed(2)} → ${spaced.S.toFixed(2)} d); repeating within minutes hardly does (${massed.S.toFixed(3)} d)`);
 const miss=run([st('seen',0),st('ok',0.01),st('ok',2),st('lapse',5)]),slip=run([st('seen',0),st('ok',0.01),st('ok',2),st('near',5)]);
 F(miss.S<spaced.S&&miss.S<=P.s0+1e-9&&slip.S>miss.S,`a miss drops S below its starting value (${miss.S.toFixed(2)} d); an ogonek slip drops it less (${slip.S.toFixed(2)} d)`);
 F(miss.D>spaced.D,'a miss raises the difficulty');
 const pts=[];M.replayTerm([st('seen',0),st('ok',0.01),st('ok',0.02),st('lapse',1),st('ok',1.001)],P,1,0.25,pts);
 F(pts.length===1&&pts[0].y===0,'only answers after an hour away from the term are evidence of forgetting');
 const evs=[{id:'x1',t:T0,term:'n:1',ev:'seen'},{id:'x2',t:T0+2*DAY,term:'n:1',ev:'answer',kind:'type',res:'wrong'},{id:'x3',t:T0+2*DAY+1,term:'n:1',ev:'amend',ref:'x2',res:'right'}];
 const s=M.states(evs,null).get('n:1'),s0=M.states(evs.slice(0,2),null).get('n:1');
 F(s.S>s0.S&&s.D<s0.D,'“Była dobra” (amend) turns the corrected answer into a right one');
 const seeded=M.states([{id:'seed:n:2',t:T0,term:'n:2',ev:'seed',x:{b:4,n:6,w:0,last:T0-DAY/2}}],null).get('n:2');
 F(seeded&&seeded.S>P.s0*8&&Math.abs(seeded.last-(T0-DAY/2)/DAY)<1e-9,'progress from before the log starts each term from its level and assumed last practice');
 const lapsedSeed=M.states([{id:'seed:n:2',t:T0,term:'n:2',ev:'seed',x:{b:4,n:6,w:2,lr:'w',last:T0-DAY/2}}],null).get('n:2');
 F(lapsedSeed.S<seeded.S*0.5&&lapsedSeed.D>seeded.D,'…and a term whose last old answer was wrong starts lower and harder');
 F(M.predict(null,T0,null)===0,'a term never met: chance 0');
 F(M.states([{id:'q',t:T0,term:'n:1',ev:'future-kind'}],null).size===0,'kinds of event from a newer version are ignored')}

/* ---------- fit: a simulated learner ---------- */
function simulate(truth,days,seed){const r=E.pick.rng(seed),events=[],steps=new Map(),terms=[];
 const fams=[['v:być:',8],['kr:K',8],['cl:',8],['w:',8],['n:',8]];fams.forEach(([pre,k])=>{for(let i=0;i<k;i++)terms.push(pre+i)});
 const mult=id=>truth.mult[E.families.of(id)]||1;
 const p=(id,t)=>{const s=E.model.replayTerm(steps.get(id)||[],truth.P,mult(id),0.25,null);return s?(1-truth.P.slip)*E.model.recall(t/DAY-s.last,s.S):0};
 let n=0;const add=(t,id,ev,res)=>{const e={id:'e'+(n++).toString(36),t,term:id,ev,...(ev==='answer'?{kind:'type',res,sid:'s',att:1,mode:'learn'}:{})};events.push(e);
  if(!steps.has(id))steps.set(id,[]);steps.get(id).push({t:t/DAY,g:ev==='seen'?'seen':res==='right'?'ok':'lapse'})};
 const met=[];let next=0;
 for(let d=0;d<days;d++)for(const h of [8,13,19]){let t=T0+d*DAY+h*36e5+r()*36e5;
  for(let k=0;k<4&&next<terms.length;k++){const id=terms[next++];met.push(id);add(t,id,'seen');t+=6e4;add(t,id,'answer',r()<p(id,t)?'right':'wrong');t+=6e4}
  const pick=met.slice().sort(()=>r()-0.5).slice(0,16);
  for(const id of pick){t+=40e3;const ok=r()<p(id,t);add(t,id,'answer',ok?'right':'wrong');if(!ok){t+=120e3;add(t,id,'answer',r()<p(id,t)?'right':'wrong')}}}
 return events}
/* families that really differ (verb forms forgotten 3× faster, countries 3× slower). The data says less about forgetting
   speed than one might hope (part of it shows up as difficulty), so the estimates are pulled toward the global rate; what
   must hold is the direction, the honest choice, calibration, and that fitting beats the defaults on answers it has not seen. */
{const truth={P:{s0:0.25,gain:2.0,lapse:0.25,slip:0.03},mult:{'verb-form':0.3,'country':3}};
 for(const seed of [1,2,3]){const ev=simulate(truth,21,seed),t0=Date.now(),fit=E.model.fit(ev),ms=Date.now()-t0,R=fit.report;
  const est=fit.chosen==='family'?fit.mult:R.familyIfUsed;
  F(est['verb-form']<0.85&&est['country']>1.2,`seed ${seed}: per-family estimates point the right way: verb forms ×${est['verb-form'].toFixed(2)} (true 0.3), countries ×${est['country'].toFixed(2)} (true 3), classroom ×${est.classroom.toFixed(2)} (true 1)`);
  F(!!R.test&&(fit.chosen==='family')===(R.test.family<R.test.global),`seed ${seed}: per-family rates used only if they predicted the newest 20% better (${fit.chosen}: global ${R.test.global.toFixed(4)}, per family ${R.test.family.toFixed(4)}, ${R.test.n} answers)`);
  const cal=R.calib.filter(b=>b.n>=60);
  F(cal.length>=2&&cal.every(b=>Math.abs(b.p-b.y)<0.1),`seed ${seed}: calibrated: `+cal.map(b=>`predicted ${Math.round(b.p*100)}% → ${Math.round(b.y*100)}% right (${b.n})`).join(' · '));
  const cut=ev[Math.floor(ev.length*0.8)].t,early=E.model.fit(ev.filter(e=>e.t<cut)),by=E.model.prepare(ev);
  const lf=E.model.loglik(by,early.params,early.mult,early.D,cut/DAY,Infinity),ld=E.model.loglik(by,E.model.DEFAULTS,{},E.model.dPriors(by,cut/DAY),cut/DAY,Infinity);
  F(lf.ll>ld.ll,`seed ${seed}: fitted on the first 80%, it predicts the rest better than the defaults (log loss ${(-lf.ll/lf.n).toFixed(4)} vs ${(-ld.ll/ld.n).toFixed(4)}) · ${ev.length} events in ${ms} ms`)}}
{const truth={P:{s0:0.4,gain:1.5,lapse:0.3,slip:0.04},mult:{}};
 const fit=E.model.fit(simulate(truth,14,11));const used=fit.chosen==='family'?fit.mult:fit.report.familyIfUsed;
 const far=Object.entries(used||{}).filter(([f,x])=>Math.abs(Math.log(x))>0.45);
 F(!far.length,`families that do not differ stay near the global rate (chosen: ${fit.chosen}; ${Object.entries(used||{}).map(([f,x])=>f+' ×'+x.toFixed(2)).join(', ')})`)}
{const fit=E.model.fit(simulate({P:E.model.DEFAULTS,mult:{}},1,3).slice(0,40));
 F(fit.chosen==='default'&&fit.params.s0===E.model.DEFAULTS.s0,`too few answers after a break (${fit.report.n}): the defaults are used`)}
{const big=[];for(let k=0;k<5;k++)simulate({P:E.model.DEFAULTS,mult:{}},20,20+k).forEach(e=>big.push({...e,id:k+e.id,t:e.t+k*30*DAY}));
 const t0=Date.now();const fit=E.model.fit(big);const ms=Date.now()-t0;
 F(ms<60000,`fit time with ${big.length} events: ${ms} ms (${fit.chosen})`);
 const t1=Date.now();E.model.states(big,fit);F(Date.now()-t1<1000,`every term's state from ${big.length} events: ${Date.now()-t1} ms`)}

/* ---------- pick ---------- */
{const cands=[{id:'hard',p:0.3,kappa:40},{id:'shaky',p:0.7,kappa:12},{id:'unsure',p:0.9,kappa:2},...Array.from({length:12},(_,i)=>({id:'solid'+i,p:0.98,kappa:40}))];
 const r=E.pick.rng(42),cnt={};for(let k=0;k<2000;k++)E.pick.thompson(cands,r).slice(0,3).forEach(c=>{const g=c.id.replace(/\d+$/,'');cnt[g]=(cnt[g]||0)+1});
 F(cnt.hard>1950&&cnt.shaky>1700,`the hard term is in the lowest 3 in ${(cnt.hard/20).toFixed(0)}% of rounds, the shaky one in ${(cnt.shaky/20).toFixed(0)}%`);
 F(cnt.unsure>300&&cnt.unsure<1900,`a term with no written answers yet is drawn often, since nothing says it is known: ${(cnt.unsure/20).toFixed(0)}%`);
 F((cnt.solid||0)<300,`each of the 12 solid terms rarely: ${((cnt.solid||0)/12/20).toFixed(1)}% of rounds each`);
 const a=E.pick.thompson(cands,E.pick.rng(5)).map(c=>c.id).join(),b=E.pick.thompson(cands,E.pick.rng(5)).map(c=>c.id).join(),c=E.pick.thompson(cands,E.pick.rng(6)).map(c=>c.id).join();
 F(a===b&&a!==c,'the same seed gives the same order; another seed another order')}

/* ---------- nut ---------- */
{const S=E.nut.step,seq=(fresh,results)=>{let e={fresh},extra=0,out=[];for(const r of results){const d=S(e,r,extra);out.push(d.status+(d.next?'+'+(d.next.gap-1):''));if(!d.next)break;e=d.next;extra++}return out.join(' ')};
 F(seq(false,['right'])==='cracked','right the first time: cracked');
 F(seq(false,['wrong','right','right'])==='pending+2 pending+6 cracked','wrong → back after 2 · right → check after 6 · right → cracked');
 F(seq(false,['wrong','right','wrong','right'])==='pending+2 pending+6 pending+2 unconfirmed','a missed check starts again; the 4th attempt is the last (right there, but not checked: unconfirmed)');
 F(seq(false,['wrong','wrong','wrong','wrong'])==='pending+2 pending+2 pending+2 failed','four misses: failed for this round');
 F(seq(true,['right','right'])==='pending+6 cracked','a term first met this round needs the later check too');
 F(seq(false,['accent','hint','right','right'])==='pending+2 pending+2 pending+6 cracked','ogonki and hints count as misses');
 F(S({},'wrong',20).status==='failed'&&S({retry:true},'right',20).status==='unconfirmed','when the round has used its 20 repeats, nothing more comes back')}

console.log(fails.length?`✗ ${fails.length} engine checks failed`:'✓ engine checks hold');process.exitCode=fails.length?1:0;
