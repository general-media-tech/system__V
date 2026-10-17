const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./h.js');
const ROOT = '/home/user/system__V';
const SKIP = /^(index|full_docs|deploy_plan|plan|معاينة_فاتورة|guard_bots_19)\.html$/;
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !SKIP.test(f)).sort();
(async () => {
  await H.seed();
  const browser = await chromium.launch(); const out = {};
  for (const f of pages) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const pg = await ctx.newPage();
    await ctx.route('**/*.supabase.co/**', async route => { const u = route.request().url(); const i = u.indexOf('/rest/v1/'); if (i < 0) return route.fulfill({ status: 200, body: '{}' }); try { const r = await route.fetch({ url: H.M + u.slice(i) }); await route.fulfill({ response: r }); } catch (e) { try { await route.abort(); } catch (_) {} } });
    await ctx.route(/^https:\/\/(?!127)/, r => r.fulfill({ status: 200, body: '', headers: { 'Content-Type': 'text/plain' } }));
    await ctx.addInitScript(H.ADMIN_INIT);
    try {
      await pg.goto(H.BASE + encodeURI(f), { waitUntil: 'domcontentloaded', timeout: 20000 }); await pg.waitForTimeout(2500);
      const r = await pg.evaluate(() => {
        const res = [];
        document.querySelectorAll('body *').forEach(e => {
          if (!e.id) return; const cs = getComputedStyle(e); if (cs.position !== 'fixed') return;
          let anc = null; for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { if (getComputedStyle(p).display === 'none') { anc = (p.id || p.className || p.tagName).toString().slice(0, 40); break; } }
          if (anc) res.push({ id: e.id, hiddenBy: anc });
        });
        return res;
      });
      if (r.length) out[f] = r;
    } catch (e) { out[f] = [{ id: 'ERR', hiddenBy: String(e).slice(0, 60) }]; }
    await ctx.close();
  }
  fs.writeFileSync(__dirname + '/trap.json', JSON.stringify(out, null, 1)); console.log('done', Object.keys(out).length);
  await browser.close();
})();
