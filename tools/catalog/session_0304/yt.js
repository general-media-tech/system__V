const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const [q] = process.argv.slice(2);
  const br = await chromium.launch();
  const pg = await (await br.newContext({ locale:'en-US', userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', viewport:{width:1366,height:900} })).newPage();
  await pg.goto('https://yandex.com/images/search?text=' + encodeURIComponent(q), { timeout: 60000, waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(5000);
  const r = await pg.evaluate(() => { const u=new Set(),o=[]; document.querySelectorAll('a[href*="img_url="]').forEach(a=>{try{const q=new URL(a.href,location.href).searchParams.get('img_url'); if(q&&!u.has(q)){u.add(q);o.push(q);}}catch(e){}}); return o; });
  console.log(r.slice(0, 16).join('\n'));
  await br.close();
})();
