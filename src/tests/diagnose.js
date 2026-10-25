// Mistake-explainer cases: each wrong answer and the explanation it gets. Usage: node diagnose.js [PORT]
const {chromium}=require('playwright-core');const PORT=process.argv[2]||'8765';
const CASES=[['qa:imie:en','Jaki masz na imię'],['qa:adres:en','Jak masz adres'],['qa:adres:en','Jaka masz adres'],
 ['qa:imie:form','Jak masz pan na imię','pan '],['qa:ma:en','Jak masz się'],['qa:nazywa:en','Jak nazywasz'],
 ['qa:skad:a3','Ona jest z Polski','On '],['oni:1','One'],['v:mieć:1','mam'],['qa:gdzie:a3','Ona mieszka w Warszawa'],
 ['kr:Polska:g','Polska'],['cl:21','Miło ja']];
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium'});const p=await b.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto('http://127.0.0.1:'+PORT+'/');await p.waitForTimeout(400);
 for(const [id,given,need] of CASES){const r=await p.evaluate(([id,given,need])=>{let q;const it=ITEMS.find(x=>x.id===id);if(!it)return {missing:1};
   for(let k=0;k<40;k++){q=it.make('write');if(!need||(q.answer||'').includes(need))break}
   return {exp:q.accept?q.accept[0]:q.answer,notes:diagnose(given,q).map(x=>'['+x[0]+'] '+x[1].replace(/<[^>]+>/g,''))}},[id,given,need||'']);
  console.log(id.padEnd(14),JSON.stringify(given).padEnd(28),'→',r.missing?'ITEM MISSING':r.exp,'\n   ',r.notes?(r.notes.join('\n    ')||'(no explanation)'):'')}
 console.log('errors',errs);await b.close()})();
