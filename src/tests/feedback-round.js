const {chromium}=require('playwright-core');
(async()=>{
 const br=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium'});
 const p=await (await br.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let body='';await p.route('https://api.github.com/**',async r=>{if(r.request().url().includes('/issues')){body=JSON.parse(r.request().postData()).body;return r.fulfill({status:201,body:'{}'})}return r.fulfill({status:404,body:'{}'})});
 await p.route('**/sw.js',r=>r.abort());
 await p.goto('http://127.0.0.1:'+(process.env.PORT||8765)+'/index.html');await p.evaluate(()=>localStorage.setItem('pl-gh-token','x'));await p.reload();await p.waitForTimeout(400);
 await p.locator('button.go2, button.go').first().click();await p.waitForTimeout(400);
 // advance until a typing screen
 for(let i=0;i<12&&!(await p.$('#ti'));i++){const b=await p.$('button.check, .opt');if(!b)break;await b.click();await p.waitForTimeout(250);const n=await p.$('#next, button.next');if(n){await n.click();await p.waitForTimeout(250)}}
 if(await p.$('#ti'))await p.fill('#ti','moja odpowiedź');
 await p.screenshot({path:'/tmp/fb-round0.png'});
 await p.tap('#fbk');await p.waitForTimeout(200);await p.screenshot({path:'/tmp/fb-round1.png'});
 const pr=await p.$('.prompt, h2, .q');await (pr||await p.$('main')).tap();await p.waitForTimeout(300);
 await p.fill('#fbtext','Prompt is ambiguous');await p.screenshot({path:'/tmp/fb-round2.png'});
 await p.tap('#fbsend');await p.waitForTimeout(900);
 console.log(body,'\nerrs',errs);await br.close()})();
