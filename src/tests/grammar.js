// The word list and the rules: checks that the grammar data is complete and consistent. Usage: node grammar.js [PORT]  (exits 1 on any failure)
//  · every verb's six forms have the endings of its pattern (-am / -asz, -em / -esz, -ę / -esz, -ę / -isz / -ysz)
//  · every noun has all its case forms, and the accusative behaves as its gender says (people and animals: = genitive, things: = nominative…)
//  · generated adjective forms are right (dobry, polski, jaki)
//  · every word in every term is in the word list, every rule a word or preposition points to exists
//  · every Polish word on the teaching screens gets a gloss (meaning | form | why)
const {chromium}=require('playwright-core');const PORT=process.argv[2]||'8765';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium'});const p=await b.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto('http://127.0.0.1:'+PORT+'/');await p.waitForTimeout(400);
 const R=await p.evaluate(()=>{const fail=[],info=[];const F=(ok,m)=>{if(!ok)fail.push(m)};
  /* verbs */
  const END={am:['am','asz','a','amy','acie','ają'],em:['em','esz','e','emy','ecie','eją'],esz:['ę','esz','e','emy','ecie','ą'],isz:['ę','[iy]sz','[iy]','[iy]my','[iy]cie','ą']};
  LEX.filter(e=>e.pos==='verb').forEach(e=>{F(e.f.length===6,`${e.lemma}: needs 6 forms`);F(VCLASS[e.cls],`${e.lemma}: unknown pattern ${e.cls}`);
   if(END[e.cls])e.f.forEach((f,k)=>F(new RegExp(END[e.cls][k]+'$').test(f),`${e.lemma} (${e.cls}): ${f} does not end in -${END[e.cls][k]}`))});
  /* nouns */
  const C=x=>CASES.indexOf(x);
  LEX.filter(e=>e.pos==='noun'&&!e.indecl).forEach(e=>{
   if(e.sg){F(e.sg.length===7,`${e.lemma}: needs 7 singular forms, has ${e.sg.length}`);F(lo(e.sg[0])===lo(e.lemma),`${e.lemma}: first form must be the dictionary form`);
    const acc=e.sg[C('acc')];
    if((e.g==='m1'||e.g==='m2')&&!/a$/.test(e.lemma))F(acc===e.sg[C('gen')],`${e.lemma} (${e.g}): accusative must equal genitive`);
    if(e.g==='m3'||e.g==='n')F(acc===e.sg[0],`${e.lemma} (${e.g}): accusative must equal nominative`);
    if(e.g==='f'||/a$/.test(e.lemma))F(/[ęą]$/.test(acc)||acc===e.sg[0],`${e.lemma} (f): accusative ${acc}`)}
   if(e.pl){F(e.pl.length===6,`${e.lemma}: needs 6 plural forms, has ${e.pl.length}`);const vir=e.g==='m1'||e.vir;
    F(vir?e.pl[C('acc')]===e.pl[C('gen')]:e.pl[C('acc')]===e.pl[0],`${e.lemma}: plural accusative must equal ${vir?'genitive (men)':'nominative'}`);
    F(/ach$|ech$/.test(e.pl[C('loc')])||e.g==='pl'&&/ach$|ech$|u$/.test(e.pl[C('loc')]),`${e.lemma}: plural locative ${e.pl[C('loc')]}`);
    F(/(om|u)$/.test(e.pl[C('dat')]),`${e.lemma}: plural dative ${e.pl[C('dat')]}`)}
   F(['m1','m2','m3','f','n','pl'].includes(e.g),`${e.lemma}: gender ${e.g}`)});
  /* generated adjectives */
  const A=(l,c,g,a)=>{const r=adjTable(LEMMA.get(l)).find(x=>x[1]===c&&x[2]===g&&(!a||x[3]===a));return r&&r[0]};
  [['dobry','gen','m','dobrego'],['dobry','acc','f','dobrą'],['dobry','nom','vir','dobrzy'],['dobry','nom','nonvir','dobre'],['dobry','acc','m','dobrego','anim'],['dobry','acc','m','dobry','inan'],
   ['polski','gen','m','polskiego'],['polski','nom','n','polskie'],['polski','loc','f','polskiej'],['polski','nom','vir','polscy'],['jaki','nom','f','jaka'],['jaki','nom','n','jakie'],['nowy','loc','m','nowym'],['zjednoczony','gen','pl','zjednoczonych']]
   .forEach(([l,c,g,want,a])=>F(A(l,c,g,a)===want,`${l} ${c} ${g}${a?' '+a:''}: ${A(l,c,g,a)} ≠ ${want}`));
  /* rules */
  LEX.filter(e=>e.pos==='prep').forEach(e=>Object.values(e.cases).forEach(r=>F(RULES[r],`${e.lemma}: rule ${r} missing`)));
  Object.entries(RULES).forEach(([k,r])=>{F(r.sub?RULES[r.sub]:r.t&&r.x,`rule ${k}: needs a name and an explanation`);F(r.sub||r.L===1||r.L==='later',`rule ${k}: lesson`);F(r.sub||r.m,`rule ${k}: module`)});
  /* every word in every term is in the word list */
  const missing=new Map();const isEn=t=>/^(Say it|Zaimki ·|Formal|Ask a|Ask about|Skąd jesteś\? ·|Skąd on|Gdzie mieszka|Liczby · write)/.test(t||'');
  const chk=(t,id)=>tokens(String(t||'').replace(/^For example: /,'')).forEach(z=>{if(!lookup(z.w).length&&!/^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(z.raw)){if(!missing.has(z.w))missing.set(z.w,id)}});
  ITEMS.forEach(it=>{for(let k=0;k<12;k++)for(const st of ['write','pick']){const q=it.make(st);if(q.reveal)continue;
   if(!isEn(q.eyebrow))chk(q.prompt,it.id);[...(q.accept||[]),...(q.valid||[]),q.mcAnswer,q.sayAns].forEach(a=>chk(a,it.id));if(q.also&&!/^Say /.test(q.also))chk(q.also.replace(/\[[^\]]*\]|\(\+ dziękuję\)|\+ (genitive|locative|name|number)/g,''),it.id)}});
  missing.forEach((id,w)=>fail.push(`not in the word list: “${w}” (term ${id})`));
  /* every Polish word on a teaching screen gets a gloss */
  const noGloss=new Set();
  [...QA.flatMap(q=>[q.inf,q.form,q.third,q.ans,q.ans3]),...SENT.map(x=>x[0].replace('___',x[1])),...COUNTRIES.map(c=>c[2]),...CITIES.map(c=>c[2]),...CLASS.map(c=>c[0]),...WORDS.map(w=>w[0]),...NUMS]
   .forEach(t=>{const d=document.createElement('div');d.innerHTML=gl(t);const n=tokens(t).length,g=d.querySelectorAll('.gw').length;if(g<n)tokens(t).forEach(z=>{if(!GLW(z.w)&&!/^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(z.raw))noGloss.add(z.w+' («'+t+'»)')})});
  noGloss.forEach(w=>fail.push('no gloss: '+w));
  info.push(`${LEX.length} words · ${FORMS.size} distinct forms · ${LEX.filter(e=>e.L===1).length} in lessons 0–1 · ${Object.values(RULES).filter(r=>r.t).length} rules (${Object.values(RULES).filter(r=>r.t&&r.L===1).length} for lessons 0–1)`);
  return {fail,info}});
 R.info.forEach(m=>console.log(m));R.fail.forEach(m=>console.log('✗ '+m));
 console.log(R.fail.length?`✗ ${R.fail.length} problems`:'✓ word list and rules consistent; every word of every term is in the word list and has a gloss');
 if(errs.length)console.log('errors',errs);await b.close();process.exitCode=R.fail.length||errs.length?1:0})();
