// Scoring rules, checked through the real answer screens. Usage: node scoring.js [PORT]  (exits 1 on any failure)
//  1. accent and hint slips never lower a level
//  2. multiple choice never lowers a level
//  3. a level only drops after 3 wrong written answers in a row (a right answer starts the count again)
const {chromium}=require('playwright-core');const PORT=process.argv[2]||'8765';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route('**/sw.js',r=>r.abort());
 await p.goto('http://127.0.0.1:'+PORT+'/');await p.waitForTimeout(400);
 await p.evaluate(()=>{localStorage.clear();S={};saveLocal()});
 const ID='v:mieć:1',fails=[];const F=(ok,m)=>{console.log((ok?'✓ ':'✗ ')+m);if(!ok)fails.push(m)};
 const lvl=()=>p.evaluate(id=>S[id]?S[id].b:null,ID);
 const set=b0=>p.evaluate(([id,b0])=>{S[id]={b:b0,n:4,w:0,f:dayKey(),due:0,lr:'r'};save()},[ID,b0]);
 /* one written answer on the real screen: mode right | wrong | accent | hint */
 const write=async mode=>{await p.evaluate(id=>{const it=ITEMS.find(x=>x.id===id);start([{it,st:'write',slot:'fix'}],'test',false)},ID);
  if(mode==='hint')await p.click('#hb');
  await p.evaluate(m=>{const q=sess.queue[sess.i].q;document.getElementById('ti').value=m==='wrong'?'qqq':q.accept[0]},mode);
  await p.click('#tf .check');return p.evaluate(()=>sess.log[sess.log.length-1].res)};
 /* one multiple-choice warm-up on the real screen */
 const pick=async right=>{await p.evaluate(id=>{const it=ITEMS.find(x=>x.id===id);start([{it,st:'pick',slot:'fix'}],'test',false)},ID);
  await p.evaluate(ok=>{const q=sess.queue[sess.i].q;const good=q.valid||[q.mcAnswer||q.answer];const j=q.options.findIndex(o=>ok?good.includes(o):!good.includes(o));document.querySelectorAll('.opt')[j].click()},right);
  return p.evaluate(()=>sess.log[sess.log.length-1].res)};
 // 1. accent and hint slips
 await set(3);
 const r1=await write('hint');F(r1==='hint'&&await lvl()===3,`hint slip keeps the level (res ${r1}, level ${await lvl()})`);
 for(let k=0;k<5;k++)await write('hint');F(await lvl()===3,`5 more hint slips: level still 3 (${await lvl()})`);
 // an accent slip: “masz” written as “mażz”-style wrong ogonek is graded “accent” by the app; use strip(answer) when it differs
 const r2=await (async()=>{await p.evaluate(()=>{const it=ITEMS.find(x=>x.id==='v:być:1');start([{it,st:'write',slot:'fix'}],'test',false)});await p.fill('#ti','jestes');await p.click('#tf .check');return p.evaluate(()=>sess.log[sess.log.length-1].res)})();
 const before=await p.evaluate(()=>{S['v:być:1']={b:4,n:4,w:0,f:dayKey(),due:0,lr:'r'};save();return 4});
 for(let k=0;k<6;k++){await p.evaluate(()=>{const it=ITEMS.find(x=>x.id==='v:być:1');start([{it,st:'write',slot:'fix'}],'test',false)});await p.fill('#ti','jestes');await p.click('#tf .check')}
 const lb=await p.evaluate(()=>S['v:być:1'].b);F(r2==='accent'&&lb===before,`6 accent slips (jestes for jesteś) keep the level (res ${r2}, level ${before} → ${lb})`);
 // 2. multiple choice (a warm-up only comes before a term is written, so the term has no written answer yet)
 await p.evaluate(id=>{S[id]={b:2,n:0,w:0,f:dayKey(),due:0};save()},ID);for(let k=0;k<6;k++){const r=await pick(false);if(r!=='wrong')F(false,'wrong option should be graded wrong')}
 F(await lvl()===2,`6 wrong multiple-choice picks keep the level (${await lvl()})`);
 // 3. three wrong written answers in a row
 await set(3);await write('wrong');await write('wrong');F(await lvl()===3,`2 wrong written answers: level stays 3 (${await lvl()})`);
 await write('wrong');F(await lvl()===2,`3rd wrong written answer in a row: level drops by one, 3 → ${await lvl()}`);
 await write('wrong');await write('wrong');F(await lvl()===2,`2 more wrong: still ${await lvl()} (the count started again)`);
 await set(3);await write('wrong');await write('wrong');await write('right');await write('wrong');await write('wrong');
 F(await lvl()===4,`wrong, wrong, right, wrong, wrong: no drop (level ${await lvl()}, up one for the right answer)`);
 // the same rules hold in record() itself
 const rec=await p.evaluate(()=>{const id='n:3';S[id]={b:2,n:3,w:0,f:dayKey(),due:0};const out=[];record(id,'accent');record(id,'hint');out.push(S[id].b);
  record(id,'wrong');record(id,'accent');record(id,'wrong');out.push(S[id].b);record(id,'wrong');out.push(S[id].b);return out});
 F(rec[0]===2&&rec[1]===2&&rec[2]===1,`record(): slips keep 2, two wrong keep 2, third wrong drops to 1 (${rec.join(' → ')})`);
 console.log(fails.length?`✗ ${fails.length} scoring rules broken`:'✓ scoring rules hold');if(errs.length)console.log('errors',errs);
 await b.close();process.exitCode=fails.length||errs.length?1:0})();
