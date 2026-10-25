// Look switch (Ustawienia → Wygląd): jasny / ciemny / systemowy. Usage: node theme.js [PORT]  (exits 1 on any failure)
//  1. with no choice the page follows the system (light and dark)
//  2. Jasny on a dark system and Ciemny on a light system win, and survive a reload
//  3. Systemowy forgets the choice and follows the system again
const {chromium}=require('playwright-core');const PORT=process.argv[2]||'8765';
const LIGHT='#f2ede5',DARK='#161a24';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium'});const fails=[];const F=(ok,m)=>{console.log((ok?'✓ ':'✗ ')+m);if(!ok)fails.push(m)};
 const page=async scheme=>{const p=await b.newPage({viewport:{width:390,height:844},colorScheme:scheme});p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await p.route('**/sw.js',r=>r.abort());
  await p.goto('http://127.0.0.1:'+PORT+'/');await p.waitForTimeout(300);return p};
 const look=p=>p.evaluate(()=>({paper:getComputedStyle(document.documentElement).getPropertyValue('--paper').trim().toLowerCase(),attr:document.documentElement.dataset.theme||null,
  saved:(()=>{try{return localStorage.getItem('pl-theme')}catch(e){return 'ERR'}})(),pressed:[...document.querySelectorAll('[data-theme-k][aria-pressed="true"]')].map(x=>x.dataset.themeK)}));
 const pick=async(p,k)=>{await p.click('#t-set');await p.waitForTimeout(150);await p.click(`[data-theme-k="${k}"]`);await p.waitForTimeout(150)};
 // 1
 for(const scheme of ['light','dark']){const p=await page(scheme);await p.evaluate(()=>{try{localStorage.removeItem('pl-theme')}catch(e){}});await p.reload();await p.waitForTimeout(300);
  const l=await look(p);F(l.paper===(scheme==='dark'?DARK:LIGHT)&&!l.attr,`no choice, ${scheme} system → ${scheme} colours (${l.paper})`);
  await p.click('#t-set');await p.waitForTimeout(150);const l2=await look(p);F(l2.pressed.join()==='system',`Systemowy is the one marked (${l2.pressed})`);
  F(!p.errs.length,'no errors '+JSON.stringify(p.errs));await p.close()}
 // 2
 for(const [scheme,k,want] of [['dark','light',LIGHT],['light','dark',DARK]]){const p=await page(scheme);
  await pick(p,k);let l=await look(p);F(l.paper===want&&l.attr===k&&l.saved===k&&l.pressed.join()===k,`${k} on a ${scheme} system → ${k} colours, saved, marked (${l.paper}, ${l.saved})`);
  await p.reload();await p.waitForTimeout(300);l=await look(p);F(l.paper===want&&l.attr===k,`… and still ${k} after a reload (${l.paper})`);
  // 3
  await pick(p,'system');l=await look(p);F(l.paper===(scheme==='dark'?DARK:LIGHT)&&!l.attr&&l.saved===null&&l.pressed.join()==='system',`Systemowy → back to the ${scheme} system colours, choice forgotten (${l.paper}, ${l.saved})`);
  F(!p.errs.length,'no errors '+JSON.stringify(p.errs));await p.close()}
 await b.close();console.log(fails.length?`✗ ${fails.length} problems`:'✓ look switch works');process.exitCode=fails.length?1:0})();
