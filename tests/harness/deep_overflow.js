// مسح عميق: يضغط كل تبويب/وضع/لوحة بكل صفحة على هاتف ٣٦٠px ويقيس اتّساع إطار الصفحة (innerWidth) بعد كل ضغطة
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./h.js');
const ROOT = '/home/user/system__V';
const SKIP = /^(index|full_docs|deploy_plan|plan|معاينة_فاتورة|guard_bots_19)\.html$/;
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !SKIP.test(f)).sort();
const W = 360;
async function probe(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  await ctx.route('**/*.supabase.co/**', async route => {
    const u = route.request().url(); const i = u.indexOf('/rest/v1/'); if (i < 0) return route.fulfill({ status: 200, body: '{}' });
    try { const r = await route.fetch({ url: H.M + u.slice(i) }); await route.fulfill({ response: r }); } catch (e) { try { await route.abort(); } catch (_) {} }
  });
  await ctx.route(/^https:\/\/(?!127)/, r => r.fulfill({ status: 200, body: '', headers: { 'Content-Type': 'text/plain' } }));
  await ctx.addInitScript(H.ADMIN_INIT);
  const found = [];
  try {
    await pg.goto(H.BASE + encodeURI(url), { waitUntil: 'domcontentloaded', timeout: 20000 });
    await pg.waitForTimeout(3000);
    const sels = await pg.evaluate(() => {
      const bad = /delete|remove|logout|reset|clear|drain|حذف|خروج|تفريغ|save|submit|print|confirm|location|href|window\.open|reload/i;
      const good = /(switch|show|set|open|select|go|toggle)\w*(Mode|Tab|Panel|Section|View|Page|Sub)\w*\(|data-tab|data-mode|role="tab"/i;
      const out = []; const seen = new Set();
      document.querySelectorAll('[onclick],[data-tab],[data-mode],[role=tab]').forEach((e, i) => {
        const oc = e.getAttribute('onclick') || ''; const sig = oc || e.outerHTML.slice(0, 80);
        if (bad.test(oc) || !good.test(oc + ' ' + e.outerHTML.slice(0, 200)) || seen.has(sig)) return;
        seen.add(sig); e.setAttribute('data-sw', String(out.length)); out.push(oc.slice(0, 60) || sig.slice(0, 60));
      });
      return out.slice(0, 40);
    });
    for (let k = 0; k < sels.length; k++) {
      const before = pg.url();
      const r = await pg.evaluate((k) => {
        const e = document.querySelector(`[data-sw="${k}"]`); if (!e) return null;
        try { e.click(); } catch (_) {}
        return true;
      }, k).catch(() => null);
      await pg.waitForTimeout(450);
      if (pg.url() !== before) { await pg.goto(H.BASE + encodeURI(url), { waitUntil: 'domcontentloaded' }).catch(() => {}); await pg.waitForTimeout(2000); break; }
      const m = await pg.evaluate((W) => {
        if (innerWidth <= W + 2 && document.documentElement.scrollWidth <= W + 2) return null;
        const culprits = [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > W + 4 && s.display !== 'none' && s.position !== 'fixed'; })
          .slice(0, 4).map(e => e.tagName + '#' + e.id + '.' + String(e.className).slice(0, 24) + ' w' + Math.round(e.getBoundingClientRect().width));
        return { iw: innerWidth, sw: document.documentElement.scrollWidth, culprits };
      }, W).catch(() => null);
      if (m) found.push({ state: sels[k], ...m });
    }
  } catch (e) { found.push({ err: String(e).slice(0, 100) }); }
  await ctx.close(); return found;
}
(async () => {
  await H.seed();
  const browser = await chromium.launch(); const res = {}; let i = 0;
  async function worker() { while (i < pages.length) { const p = pages[i++]; res[p] = await probe(browser, p); } }
  await Promise.all(Array.from({ length: 4 }, worker));
  fs.writeFileSync(__dirname + '/deep_overflow.json', JSON.stringify(res, null, 1));
  const bad = Object.entries(res).filter(([, v]) => v.length);
  console.log('pages', pages.length, 'with overflow states:', bad.length);
  bad.forEach(([p, v]) => console.log(p, JSON.stringify(v.slice(0, 3))));
  await browser.close();
})();
