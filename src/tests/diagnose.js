// Mistake explainer: realistic wrong answers and the explanation each must get. Usage: node diagnose.js [PORT]  (exits 1 on any failure)
// Each case: the term (an id from the app, or a made-up question {prompt, accept}), the wrong answer, and two patterns
// the explanation must match: its label (case, verb person, gender…) and its text. Patterns ignore upper / lower case.
const {chromium}=require('playwright-core');const PORT=process.argv[2]||'8765';
const S=(prompt,...accept)=>({prompt,accept});
/* 1. the 12 original cases, on the real terms (third value: text the answer must contain, to pick a variant) */
const TERMS=[
 ['qa:imie:en','Jaki masz na imię','','jaki / jak','jak = how'],
 ['qa:adres:en','Jak masz adres','','jak / jaki','adres, which is masculine'],
 ['qa:adres:en','Jaka masz adres','','^gender$','jaka is feminine; it agrees with adres, which is masculine'],
 ['qa:imie:form','Jak masz pan na imię','pan ','verb person','subject is pan.*on / ona-form'],
 ['qa:ma:en','Jak masz się','','word order','się'],
 ['qa:nazywa:en','Jak nazywasz','','missing się','nazywać się'],
 ['qa:skad:a3','Ona jest z Polski','On ','he / she','on = he'],
 ['oni:1','One','','oni / one','Jacek is a man'],
 ['v:mieć:1','mam','','verb person','ja-form mam; the subject is ty'],
 ['qa:gdzie:a3','Ona mieszka w Warszawa','','^case$','Warszawa is the nominative.*after w .*locative'],
 ['kr:Polska:g','Polska','','^case$','Polska is the nominative.*after z .*genitive'],
 ['cl:21','Miło ja','','^case$','ja \\(I\\) is the nominative.*miło.*dative'],
 /* more real terms */
 ['kr:Belgia:g','Belgia','','^case$','Belgia is the nominative.*genitive'],
 ['kr:Hiszpania:g','Hiszpanji','','-ii / -ji','Hiszpania → z Hiszpanii'],
 ['city:Wrocław','Mieszkam w Wrocławiu','Mieszkam','z / ze, w / we','we Wrocławiu'],
 ['city:Kraków','Mieszkam w Krakówie','Mieszkam','stem change','ó becomes o'],
 ['vs:13','mieszkam','','verb person','Michael is one person'],
 ['vs:18','nazywasz','','verb person','subject is pani'],
 ['vs:2','jesteście','','verb person','subject is One'],
 ['oni:0','Oni','','oni / one','no man in the group'],
 ['oni:6','Oni','','oni / one','no man in the group'],
 ['qa:skad:form','Skąd pani jesteś?','pani','verb person','subject is pani'],
 ['qa:tel:en','Jaki masz numer telefon?','','^case$','telefon is the nominative.*genitive: numer telefonu'],
 ['cl:14','Do widzenie','','^case$','widzenie is the nominative.*do.*genitive'],
 ['cl:5','Prosze mowić wolniej','','accents','ę, not e'],
];
/* 2. one or more wrong answers for every grammatical feature, on made-up questions */
const SYN=[
 // case: prepositions
 [S("I'm from Belgium.",'Jestem z Belgii.'),'Jestem z Belgia','^case$','Belgia is the nominative.*genitive: z Belgii'],
 [S("I'm from Belgium.",'Jestem z Belgii.'),'Jestem w Belgii','z / w|w / z','z = from'],
 [S('Skąd jesteś?','Jestem z Polski.'),'Jestem w Polsce','w / z|z / w','Skąd'],
 [S("I'm from Poland.",'Jestem z Polski.'),'Jestem z Polskę','^case$','Polskę is the accusative.*genitive'],
 [S('Mieszkam ___ (Gandawa).','w Gandawie'),'w Gandawy','^case$','Gandawy is the genitive.*locative'],
 [S('He is from Germany.','On jest z Niemiec.'),'On jest z Niemcy','^case$','Niemcy is the nominative.*genitive: z Niemiec'],
 [S('x','Do widzenia.'),'Do widzenie','^case$','widzenie is the nominative.*do.*genitive'],
 [S('x','Wszystko w porządku.'),'Wszystko w porządek','^case$','porządek is the nominative.*locative'],
 // case: noun + genitive, mieć + accusative, nie + genitive
 [S("What's your phone number?",'Jaki masz numer telefonu?'),'Jaki masz numer telefon','^case$','telefon is the nominative.*“of …”.*genitive: numer telefonu'],
 [S('I have a sister.','Mam siostrę.'),'Mam siostra','^case$','siostra is the nominative.*mieć.*accusative'],
 [S("I don't have a problem.",'Nie mam problemu.'),'Nie mam problem','^case$','problem is the accusative.*nie.*genitive'],
 [S("I don't have a question.",'Nie mam pytania.'),'Nie mam pytanie','^case$','pytanie is the accusative.*nie.*genitive'],
 [S("I don't have coffee.",'Nie mam kawy.'),'Nie mam kawę','^case$','kawę is the accusative.*nie.*genitive'],
 // 2–4 / 5+
 [S('two houses','dwa domy'),'dwa dom','number','dom is singular.*2, 3, 4.*nominative plural'],
 [S('five houses','pięć domów'),'pięć domy','^case$','domy is the nominative plural.*5 and up.*genitive plural'],
 [S('five houses','pięć domów'),'pięć dom','case \\+ number','dom is the nominative singular.*genitive plural'],
 [S('three questions','trzy pytania'),'trzy pytań','^case$','pytań is the genitive plural.*nominative plural'],
 // subject and verb
 [S('Skąd pani jest?','Skąd pani jest?'),'Skąd pani jesteś','verb person','ty-form jesteś; the subject is pani'],
 [S('Jak się pani ___?','nazywa'),'nazywasz','verb person','subject is pani'],
 [S('Michael teraz ___ w Krakowie.','mieszka'),'mieszkam','verb person','Michael is one person'],
 [S('One ___ z Niemiec.','są'),'jesteście','verb person','subject is One'],
 [S('(my) ___ dom w Krakowie.','mamy'),'masz','verb person','ty-form masz; the subject is my'],
 [S('ty ___','masz'),'macie','verb number|verb person','wy-form macie'],
 [S('Skąd państwo ___?','są'),'jest','verb (person|number)','państwo, panowie and panie take'],
 [S('(Magda i Dominika) ___ są z Polski.','One'),'Oni','oni / one','no man in the group'],
 [S('(pan Kamil i pani Grażyna) ___ są z Polski.','Oni'),'One','oni / one','Kamil is a man'],
 // agreement
 [S('Do you have a new car?','Czy macie nowe auto?'),'Czy macie nowy auto','^gender$','nowy is masculine; it agrees with auto, which is neuter'],
 [S('x','Jakie masz imię?'),'Jaki masz imię','^gender$','agrees with imię, which is neuter'],
 [S('x','Jaka to ulica?'),'Jaki to ulica','^gender$','ulica, which is feminine'],
 // word order, się
 [S('x','Nazywam się Jan.'),'Się nazywam Jan','word order','się never comes first'],
 [S('x','Miło mi.'),'Mi miło','word order','mi never comes first'],
 [S('x','Mam na imię Jan.'),'Mam się na imię Jan','extra się','does not take'],
 // jak / jaki / co · być / mieć · dobry / dobrze
 [S('x','Jak masz na imię?'),'Co masz na imię','co / jak','co = what'],
 [S('x','Mam na imię Jan.'),'Jestem na imię Jan','być / mieć','I have as first name'],
 [S('x','Mam się dobrze.'),'Mam się dobry','dobry / dobrze','adverb'],
 [S('Please speak more slowly.','Proszę mówić wolniej.'),'Proszę mówisz wolniej','verb form','after proszę.*infinitive'],
 [S('Please repeat.','Proszę powtórzyć.'),'Proszę powtórz','ending','infinitive'],
 // z / ze, w / we
 [S('I live in Wrocław.','Mieszkam we Wrocławiu.'),'Mieszkam w Wrocławiu','z / ze, w / we','we Wrocławiu'],
 [S('x','Mieszkam w Gandawie.'),'Mieszkam we Gandawie','z / ze, w / we','w becomes we'],
 [S('USA','ze Stanów Zjednoczonych'),'z Stanów Zjednoczonych','z / ze, w / we','ze Stanów'],
 // missing words
 [S('x','Jestem z Belgii.'),'Jestem Belgii','missing z','genitive'],
 [S('x','Mieszkam w Gandawie.'),'Mieszkam Gandawie','missing w','locative'],
 [S('x','Mam na imię Jan.'),'Mam imię Jan','missing na','I have as first name'],
 [S('x','On jest z Polski.'),'On z Polski','missing verb','keeps the verb'],
 [S('ja ___','mam'),'ja mam','extra word','already in the sentence'],
 // spelling fallback
 [S('x','Dziękuję.'),'Dziekuje','accents','ę, not e'],
 [S('x','Mieszkam w Krakowie.'),'Mieszkam w Krakówie','stem change','ó becomes o'],
 [S('x','Mieszkam w Łodzi.'),'Mieszkam w Łódzi','stem change','ó becomes o'],
 [S('x','Kraków'),'Krakuw','ó / u','written with ó'],
 [S('x','Przepraszam.'),'Pszepraszam','rz / sz','rz'],
 [S('x','chleb'),'hleb','ch / h','written with ch'],
 [S('x','Jestem z Francji.'),'Jestem z Francii','-ii / -ji','Francja → z Francji'],
 [S('x','Jestem z Belgii.'),'Jestem z Belgji','-ii / -ji','Belgia → z Belgii'],
 [S('x','Mieszkam w Warszawie.'),'Mieszkam w Warszawu','ending','Right word, wrong ending.*locative'],
 [S('x','Mieszkam w Krakowie.'),'Mieszkam w Krakow','^case$','Kraków'],
 [S('x','Dziękuję.'),'Dźękuję','ci / ć','before a vowel'],
 [S('x','Mam pytanie!'),'Mam qqqq','different word','not a word from the course'],
 [S('x','Mieszkam w Gandawie.'),'Mieszkam w Brukseli','different word','means'],

];
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium'});const p=await b.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto('http://127.0.0.1:'+PORT+'/');await p.waitForTimeout(400);
 const R=await p.evaluate(([TERMS,SYN])=>{const plain=ns=>ns.map(x=>[x[0],x[1].replace(/<[^>]+>/g,'')]);const out=[];
  const check=(label,q,given,key,txt)=>{let ns;try{ns=plain(diagnose(given,q))}catch(e){out.push({label,given,ok:false,notes:['CRASH '+e.message]});return}
   const ok=ns.some(([k,t])=>new RegExp(key,'i').test(k)&&new RegExp(txt,'i').test(t));out.push({label,given,exp:(q.accept||[q.answer])[0],ok,notes:ns.map(([k,t])=>'['+k+'] '+t)})};
  TERMS.forEach(([id,given,need,key,txt])=>{const it=ITEMS.find(x=>x.id===id);if(!it){out.push({label:id,given,ok:false,notes:['TERM MISSING']});return}
   let q;for(let k=0;k<60;k++){q=it.make('write');if(!need||String((q.accept||[q.answer])[0]).includes(need))break}check(id,q,given,key,txt)});
  SYN.forEach(([q,given,key,txt])=>check('—',q,given,key,txt));
  /* 3. sweep: every term, typical slips made automatically; nothing may crash, and each slip must be named */
  const sweep={n:0,crash:[],miss:[]};const seen=new Set();
  ITEMS.forEach(it=>{for(let r=0;r<6;r++){const q=it.make('write');if(q.open||q.check||q.reveal||!q.accept)continue;const a=q.accept[0];if(seen.has(it.id+a))continue;seen.add(it.id+a);
   const T=tokens(a.replace(/[.!?]$/,''));const ctx=ctxOf(q,T.map(t=>t.w));const A=analyse(ctx.toks);
   const tries=[];
   if(strip(a)!==a)tries.push([strip(a),'accents|stem change|ó / u|.']);
   A.slice(ctx.off,ctx.off+T.length).forEach((x,k)=>{const an=x.an;if(!an||!an.e)return;const raw=T[k].raw;
    if((an.pos==='noun'||an.pos==='name')&&an.case!=='nom'&&x.rule&&!an.e.indecl&&lo(an.e.lemma)!==lo(raw)){const nomf=an.e.g==='pl'?an.e.pl[0]:an.e.sg[0];if(lo(nomf)!==lo(raw))tries.push([a.replace(raw,nomf),'case']);}
    if(an.pos==='verb'&&an.vf==='fin'){const f=an.e.f[(pi(an)+1)%6];if(lo(f)!==lo(raw)&&!q.accept.some(z=>norm(z)===norm(a.replace(raw,f))))tries.push([a.replace(raw,f),'verb']);}});
   tries.forEach(([given,key])=>{sweep.n++;let ns;try{ns=plain(diagnose(given,q))}catch(e){sweep.crash.push(`${it.id} ${given}: ${e.message}`);return}
    if(!ns.some(([k])=>new RegExp(key,'i').test(k)))sweep.miss.push(`${it.id} “${given}” → ${a}: ${ns.map(n=>'['+n[0]+'] '+n[1]).join(' ')||'(nothing)'}`)})}});
  return {out,sweep}},[TERMS,SYN]);
 let bad=0;R.out.forEach(r=>{if(!r.ok)bad++;if(!r.ok||process.env.VERBOSE)console.log((r.ok?'✓ ':'✗ ')+r.label.padEnd(14)+JSON.stringify(r.given).padEnd(30)+' → '+(r.exp||'')+'\n    '+(r.notes.join('\n    ')||'(no explanation)'))});
 console.log(`${R.out.length-bad} of ${R.out.length} wrong answers explained as expected`);
 console.log(`sweep: ${R.sweep.n} automatic slips over every term · ${R.sweep.crash.length} crashes · ${R.sweep.miss.length} not named`);
 [...R.sweep.crash,...R.sweep.miss].slice(0,30).forEach(m=>console.log('  ✗ '+m));
 console.log('errors',errs);await b.close();process.exitCode=bad||R.sweep.crash.length||R.sweep.miss.length||errs.length?1:0})();
