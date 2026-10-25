// “You said”: the wrong answer read back in English. Usage: node yousaid.js [PORT]  (exits 1 on any failure)
// The examples from the design board, on the real terms where the app has one, and made-up questions otherwise.
// Each case: the term id (or a question {prompt, sub, accept}), the wrong answer, the text that picks a variant
// of the term, the kind ('meaning' | 'form' | 'spell') and the exact line (bold marks removed).
const {chromium}=require('playwright-core');const PORT=process.argv[2]||'8765';
const Q=(prompt,sub,...accept)=>({prompt,sub,accept,answer:accept[0]});
const CASES=[
 // the board
 [Q("I'm learning Polish.",null,'Uczę się polskiego.'),'Uczyć się Polska','','meaning','To learn Poland.'],
 ['city:Gandawa','Mieszkam z Gandawie','Mieszkam','meaning','I live from Ghent.'],
 [Q('Skąd jesteś?','Answer in Polish: “I\'m from Belgium.”','Jestem z Belgii.'),'Jestem w Belgii','','meaning',"I'm in Belgium."],
 ['qa:nazywa:en','Jak nazywasz','','meaning','How do you call?'],
 [Q('I speak Polish well.',null,'Mówię dobrze po polsku.','Mówię po polsku dobrze.'),'Mówię po polsku dobry','','meaning','I speak Polish good.'],
 ['cl:21','Miło ja','','meaning','Nice I.'],
 ['qa:skad:a3','Ona jest z Polski','On ','meaning','She is from Poland.'],
 ['oni:1','One','','meaning','They [no men] are from Poland.'],
 ['cl:5','Proszę mówisz wolniej','','meaning','Please you speak more slowly.'],
 ['qa:imie:ans','Jestem na imię Jan','','meaning','I am as first name Jan.'],
 ['qa:gdzie:a3','Ona mieszka w Warszawa','','form','Same meaning, only the ending.'],
 ['qa:gdzie:a3','Ona mieszka w Warsawie','','spell','Right word, one letter missing.'],
 // Ian's screenshot
 ['qa:gdzie:a3','Ona mieszka z Warszawie','','meaning','She lives from Warsaw.'],
 // more
 ['v:być:0','jesteś','','meaning','I are.'],
 ['pn:ja','ty','','meaning','you'],
 ['w:0','plac','','meaning','square'],
 ['kr:Polska:g','Polska','','form','Same meaning, only the ending.'],
 ['qa:imie:form','Jak masz pan na imię','pan ','form','Same meaning, only the form.'],
 ['oni:0','Oni','','meaning','They [incl. a man] are from Poland.'],
 ['city:Gandawa','Mieszkam Gandawie','Mieszkam','meaning','I live Ghent.'],
];
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium'});const p=await b.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto('http://127.0.0.1:'+PORT+'/');await p.waitForTimeout(400);
 const R=await p.evaluate(CASES=>{const out=[];
  CASES.forEach(([id,given,need,kind,line])=>{let q=id;
   if(typeof id==='string'){const it=ITEMS.find(x=>x.id===id);if(!it){out.push({id,given,ok:false,got:'TERM MISSING'});return}
    for(let k=0;k<80;k++){q=it.make('write');if(!need||String((q.accept||q.valid||[q.answer])[0]).includes(need))break}}
   let r;try{r=youSaid(given,q)}catch(e){r={kind:'CRASH',html:e.message}}
   const got=r?r.html.replace(/<[^>]+>/g,''):'(none)';out.push({id:typeof id==='string'?id:'—',given,ok:!!r&&r.kind===kind&&got===line.replace(/&/g,'&amp;')||!!r&&r.kind===kind&&got.replace(/&#39;/g,"'")===line,got:(r?r.kind+' · ':'')+got,want:kind+' · '+line,html:r&&r.html})});
  /* sweep: every term, automatic slips; nothing may crash, and a meaning line must never be empty */
  const sw={n:0,bad:[]};ITEMS.forEach(it=>{for(let k=0;k<4;k++){const q=it.make('write');if(!q.accept)continue;const a=q.accept[0];
   [strip(a),a.replace(/ę/g,'e'),a.split(' ').slice(1).join(' '),a.replace(/\bw\b/,'z'),a.replace(/\bz\b/,'w')].forEach(g=>{if(!g||norm(g)===norm(a))return;sw.n++;
    let r;try{r=youSaid0(g,q)}catch(e){sw.bad.push(`${it.id} “${g}”: CRASH ${e.message}`);return}
    if(r&&(!r.html||/undefined|null|\[object/.test(r.html)))sw.bad.push(`${it.id} “${g}”: ${r.html}`)})}});
  return {out,sw}},CASES);
 let bad=0;R.out.forEach(r=>{if(!r.ok)bad++;if(!r.ok||process.env.VERBOSE)console.log((r.ok?'✓ ':'✗ ')+r.id.padEnd(13)+JSON.stringify(r.given).padEnd(28)+' → '+r.got+(r.ok?'':'\n      want '+r.want))});
 console.log(`${R.out.length-bad} of ${R.out.length} “you said” lines as expected`);
 console.log(`sweep: ${R.sw.n} automatic slips · ${R.sw.bad.length} broken`);R.sw.bad.slice(0,20).forEach(m=>console.log('  ✗ '+m));
 console.log('errors',errs);await b.close();process.exitCode=bad||R.sw.bad.length||errs.length?1:0})();
