const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ acceptDownloads: true }); const p = await c.newPage();
  await p.goto('http://127.0.0.1:8765/manifest.json');
  await p.evaluate(() => { document.body ? 0 : document.documentElement.appendChild(document.createElement('body')); });
  for (const name of ['rfq.xlsx', 'طلب_عرض_سعر_2026-10-10.xlsx']) {
    const [d] = await Promise.all([p.waitForEvent('download'), p.evaluate((n) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['x'])); a.download = n; document.body.appendChild(a); a.click(); }, name)]);
    console.log(name, '=>', d.suggestedFilename());
  }
  await b.close();
})();
