const {chromium}=require('playwright-core');
const PORT=process.argv[2]||'8792';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:390,height:844}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+PORT+'/');await p.waitForTimeout(500);
// start from the merged real progress (as on the phone)
await p.evaluate(()=>{localStorage.removeItem('pl-test1-round');home()});
const V={};const v=(rule,msg)=>{(V[rule]=V[rule]||[]).push(msg)};
let wrote=new Set(await p.evaluate(()=>Object.keys(S).filter(k=>S[k]&&S[k].lr))),screens=0;
const rnd=Math.random;
for(let r=0;r<14;r++){
 if(!(await p.$('#go-resume')))await p.click('#go-learn');else await p.click('#go-resume');
 const counted=new Set();
 for(let k=0;k<400;k++){
  if(await p.$('.score'))break;screens++;
  // occasionally quit and reopen the app mid-round
  if(rnd()<0.03){await p.reload();await p.waitForTimeout(250);if(await p.$('#go-resume'))await p.click('#go-resume');continue}
  const st=await p.evaluate(()=>{const c=sess.queue[sess.i];const t=S[c.it.id];return {id:c.it.id,stEntry:c.st,kind:c.q?c.q.kind:null,eyebrow:c.q?c.q.eyebrow:'',reveal:!!(c.q&&c.q.reveal),practice:!!c.practice,retry:!!c.retry,
    t:t?{...t}:null,slot:c.slot,round:round(),pattern:!!c.it.pattern,card:!!document.querySelector('.btab')&&!!document.getElementById('got')}});
  if(st.card){await p.click('#got');continue}
  if(await p.$('#got')){ // word intro card
   if(wrote.has(st.id))v('1 card for written term',st.id);
   if(rnd()<0.15)await p.click('#knowit');else await p.click('#got');continue}
  if(st.kind==='mc'){
   const t=st.t;if(wrote.has(st.id)&&!(t&&t.dr))v('2 warm-up for written term',`${st.id} ${JSON.stringify(t)}`);
   const right=rnd()<0.8;await p.evaluate(ok=>{const q=sess.queue[sess.i].q;const good=q.valid||[q.mcAnswer||q.answer];const j=q.options.findIndex(o=>ok?good.includes(o):!good.includes(o));document.querySelectorAll('.opt')[Math.max(0,j)].click()},right);
   await p.click('#nx');continue}
  if(st.kind==='reveal'){v('3 easy direction counted',st.id+' '+st.eyebrow);await p.click('#rv');await p.click('#kn');continue}
  if(/which number|What does it mean/i.test(st.eyebrow))v('3 easy direction counted',st.id+' '+st.eyebrow);
  if(st.slot==='rev'&&!st.practice&&st.t&&(st.t.due??0)>st.round&&!st.retry)v('6 review not due',`${st.id} due ${st.t.due} round ${st.round}`);
  const x=rnd();const mode=x<0.65?'right':x<0.8?'wrong':x<0.9?'accent':'hint';
  if(mode==='hint'&&await p.$('#hb'))await p.click('#hb');
  await p.evaluate(m=>{const q=sess.queue[sess.i].q;let a=q.accept?q.accept[0]:q.valid?q.valid[0]:(q.mcAnswer||q.answer);if(/^\d+$/.test(a)&&q.check)a='0123 456 789';
   if(m==='wrong')a='qqq';if(m==='accent')a=a.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ł/g,'l');document.getElementById('ti').value=a},mode);
  const before=await p.evaluate(()=>{const c=sess.queue[sess.i];return {id:c.it.id,counts:!c.retry&&!c.practice&&!c.it.tmp&&!(sess.done&&sess.done.has(c.it.id))}});
  await p.click('#tf .check');
  if(before.counts){if(counted.has(before.id))v('4 counted twice',before.id);counted.add(before.id);wrote.add(before.id)}
  if(rnd()<0.05&&await p.$('#easy'))await p.click('#easy');else await p.click('#nx');
 }
 // rule 5: same answers in the planned round
 await p.click('#hm');
}
// rule 5 separately over many planned rounds
const dup=await p.evaluate(()=>{let n=0,ex=[];for(let r=0;r<100;r++){const q=buildRound(vis()).queue.filter(e=>!e.practice);const m=new Map();q.forEach(e=>{const k=answerKey(e.it);if(k&&m.has(k)&&m.get(k)!==e.it.id){n++;ex.push(m.get(k)+'='+e.it.id)}if(k)m.set(k,e.it.id)})}return {n,ex:[...new Set(ex)].slice(0,6)}});
if(dup.n)v('5 same answer twice in a round',JSON.stringify(dup));
console.log('screens played:',screens);
const rules=['1 card for written term','2 warm-up for written term','3 easy direction counted','4 counted twice','5 same answer twice in a round','6 review not due'];
rules.forEach(r=>{const l=V[r]||[];console.log((l.length?'✗ ':'✓ ')+r+(l.length?`: ${l.length}× e.g. `+[...new Set(l)].slice(0,4).join(' | '):''))});
console.log('errors',errs);await b.close()})();
