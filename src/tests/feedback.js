const {chromium}=require('playwright-core');
(async()=>{
 const br=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium'});
 async function run(name,token,status){
  const ctx=await br.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const posts=[];
  await p.route('https://api.github.com/**',async r=>{const u=r.request().url();
   if(u.includes('/issues')){posts.push(JSON.parse(r.request().postData()));return r.fulfill({status,body:'{}',contentType:'application/json'})}
   return r.fulfill({status:404,body:'{}'})});
  await p.route('**/sw.js',r=>r.abort());
  await p.goto('http://127.0.0.1:'+(process.env.PORT||8765)+'/index.html');
  if(token){await p.evaluate(t=>localStorage.setItem('pl-gh-token',t),token);await p.reload()}
  await p.waitForTimeout(500);
  await p.click('#fbk');await p.waitForTimeout(200);
  const bar=await p.textContent('#pickbar');
  const tgt=await p.$('h1, .h1, .hello, main h2, #app b');
  await p.mouse.click(195,200);await p.waitForTimeout(300);
  const snip=await p.textContent('.fbsnip');
  await p.fill('#fbtext','Test comment: the gloss is wrong');
  await p.click('#fbsend');await p.waitForTimeout(800);
  const msg=await p.textContent('#fbmsg').catch(()=>'(sheet closed)');
  const q=await p.evaluate(()=>localStorage.getItem('pl-fbq'));
  await p.screenshot({path:`/tmp/fb-${name}.png`});
  console.log(name,'| bar:',bar.trim().slice(0,40),'| snip:',snip.slice(0,50),'| msg:',msg.slice(0,90),'| posts:',posts.length,posts[0]?posts[0].title+' labels='+JSON.stringify(posts[0].labels):'','| queue:',q&&JSON.parse(q).length,'| errs:',errs);
  if(posts[0]&&name==='ok')console.log(posts[0].body);
  await ctx.close()}
 await run('ok','ghp_fake',201);
 await run('forbidden','ghp_fake',403);
 await run('notoken',null,201);
 await br.close()})();
