// (TASK-0342 · المالك seq 598) صور img/p (GitHub · نفس الموقع) تُحفظ في gmt-imgs لا في كاش الصفحات · وتظهر بلا إنترنت
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.BASE_PORT || 8765;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const pg = await ctx.newPage();
  await pg.goto('http://127.0.0.1:' + PORT + '/favicon.ico');
  await pg.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; });
  await pg.reload(); await pg.waitForTimeout(800);
  const img = '/img/p/lens_e362446c-ea14-42e3-8b2e-5cefd4b66933_1793468997134.jpg';
  let net = 0; pg.on('request', r => {}); ctx.on('request', r => { if (r.url().includes('/img/p/') && !r.serviceWorker()) {} });
  const r1 = await pg.evaluate(async u => { const r = await fetch(u); return [r.status, (await r.blob()).size]; }, img);
  await pg.waitForTimeout(500);
  const caches1 = await pg.evaluate(async () => { const o = {}; for (const k of await caches.keys()) { const c = await caches.open(k); o[k] = (await c.keys()).filter(r => r.url.includes('/img/p/')).length; } return o; });
  // offline: الصورة تُعرض من الجهاز
  await ctx.setOffline(true);
  const r2 = await pg.evaluate(async u => { try { const r = await fetch(u); return [r.status, (await r.blob()).size]; } catch (e) { return ['ERR', String(e)]; } }, img);
  const ok = r1[0] === 200 && caches1['gmt-imgs'] === 1 && !caches1['gmt-pages'] && r2[0] === 200 && r2[1] === r1[1];
  console.log((ok ? '  ✔ ' : '  ✘ ') + 'صورة img/p ⇐ gmt-imgs فقط وتظهر بلا إنترنت ' + JSON.stringify({ r1, caches1, offline: r2 }));
  await b.close();
  console.log(ok ? 'ALL PASS (1)' : 'FAIL 1 / 1'); process.exit(ok ? 0 : 1);
})();
