// Term snapshot: every term id and what it asks / accepts, under a fixed random seed.
// Usage: node terms.js PORT write FILE   (record)   ·   node terms.js PORT FILE   (compare; exits 1 on any difference)
const {chromium}=require('playwright-core');const fs=require('fs');
const PORT=process.argv[2]||'8765',WRITE=process.argv[3]==='write',FILE=WRITE?process.argv[4]:process.argv[3]||__dirname+'/terms-fixture.json';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium'});const p=await b.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://127.0.0.1:'+PORT+'/');await p.waitForTimeout(400);
 const snap=await p.evaluate(()=>{let s=1;const R=Math.random;Math.random=()=>{s=(s*16807)%2147483647;return (s-1)/2147483646};
  const n=x=>x==null?null:String(x).toLowerCase().replace(/[.,!?;:…]/g,'').replace(/\s+/g,' ').trim();
  const out={ids:ITEMS.map(it=>it.id),order:ORDER.map(it=>it.id),terms:{}};
  ITEMS.forEach(it=>{const runs=[];for(let k=0;k<4;k++){s=1000+k*7919;for(const st of ['write','pick']){const q=it.make(st);
   runs.push({st,eyebrow:q.eyebrow,prompt:q.prompt,sub:q.sub||null,answer:q.answer,mc:q.mcAnswer||null,accept:q.accept?q.accept.map(n).sort():null,valid:q.valid||null,options:q.options||null,say:q.sayAns||null,note:q.note||null,group:it.group||null,block:it.block||null,kind:it.kind,stage:it.stage})}}
   out.terms[it.id]=runs});
  Math.random=R;return out});
 if(WRITE){fs.writeFileSync(FILE,JSON.stringify(snap));console.log('recorded',snap.ids.length,'terms →',FILE);}
 else{const old=JSON.parse(fs.readFileSync(FILE,'utf8'));let bad=0;const say=m=>{bad++;if(bad<=25)console.log('✗',m)};
  if(JSON.stringify(old.ids)!==JSON.stringify(snap.ids))say('term ids differ: missing '+old.ids.filter(i=>!snap.ids.includes(i)).join(', ')+' · new '+snap.ids.filter(i=>!old.ids.includes(i)).join(', '));
  if(JSON.stringify(old.order)!==JSON.stringify(snap.order))say('learning order differs');
  old.ids.forEach(id=>{const a=old.terms[id],c=snap.terms[id];if(!c)return;a.forEach((r,k)=>Object.keys(r).forEach(f=>{if(JSON.stringify(r[f])!==JSON.stringify(c[k][f]))say(`${id} [${r.st}] ${f}: ${JSON.stringify(r[f])} → ${JSON.stringify(c[k][f])}`)}))});
  console.log(bad?`✗ ${bad} differences`:`✓ all ${old.ids.length} term ids, the learning order and every term's prompts and accepted answers are unchanged`);
  if(errs.length)console.log('errors',errs);process.exitCode=bad||errs.length?1:0}
 await b.close()})();
