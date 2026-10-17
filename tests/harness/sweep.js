// مسح شامل: كل صفحة × (موبايل/كمبيوتر) × (أدمن/موظف) — أخطاء · طفح أفقي · إيموجي ظاهر · أزرار عائمة · نوافذ المتصفح
const fs = require('fs'), path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./h.js');
const ROOT = '/home/user/system__V';
const OUT = '/tmp/gmt-out/sweep_c.json';
const SKIP = /^(index|full_docs|deploy_plan|plan|معاينة_فاتورة|guard_bots_19)\.html$/;
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !SKIP.test(f)).sort();

async function probe(browser, url, init, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); const errs = []; const fail404 = [];
  pg.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  pg.on('response', r => { if (r.status() === 404 && r.url().startsWith(H.BASE)) fail404.push(r.url().replace(H.BASE, '')); });
  await ctx.route('**/*.supabase.co/**', async route => {
    const u = route.request().url(); const i = u.indexOf('/rest/v1/'); if (i < 0) return route.fulfill({ status: 200, body: '{}' });
    try { const r = await route.fetch({ url: H.M + u.slice(i) }); await route.fulfill({ response: r }); } catch (e) { try { await route.abort(); } catch (_) {} }
  });
  await ctx.route(/^https:\/\/(?!127)/, r => r.fulfill({ status: 200, body: '', headers: { 'Content-Type': 'text/plain' } }));
  await ctx.addInitScript(init);
  await ctx.addInitScript(() => { window.__native = []; ['alert', 'confirm', 'prompt'].forEach(k => { const o = window[k]; Object.defineProperty(window, '__orig_' + k, { value: o }); }); });
  let res = { ok: false };
  try {
    await pg.goto(H.BASE + encodeURI(url), { waitUntil: 'domcontentloaded', timeout: 20000 });
    await pg.waitForTimeout(3500);
    res = await pg.evaluate(() => {
      const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0; };
      const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B06}\u{2705}\u{274C}\u{2728}]/gu;
      let emoji = 0; const emojiSamples = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n; while ((n = walker.nextNode())) {
        const p = n.parentElement; if (!p || /SCRIPT|STYLE|TEXTAREA|OPTION/.test(p.tagName)) continue;
        const m = n.nodeValue.match(emojiRe); if (m && vis(p)) { emoji += m.length; if (emojiSamples.length < 4) emojiSamples.push(n.nodeValue.trim().slice(0, 24)); }
      }
      const fabs = [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); if (s.position !== 'fixed' || !vis(e)) return false; const r = e.getBoundingClientRect(); return r.width <= 90 && r.height <= 90 && r.width >= 28 && (r.bottom > innerHeight * .5) && !e.closest('nav,header'); }).map(e => (e.id || e.className || e.tagName).toString().slice(0, 30) + ':' + (e.textContent || '').trim().slice(0, 8)).slice(0, 4);
      return { ok: true, hscroll: document.documentElement.scrollWidth > innerWidth + 2, emoji, emojiSamples, fabs, title: document.title.slice(0, 40), bodyLen: document.body.innerText.length };
    });
  } catch (e) { res = { ok: false, err: String(e).slice(0, 100) }; }
  res.errs = errs.slice(0, 3); res.n404 = [...new Set(fail404)].slice(0, 3);
  await ctx.close(); return res;
}

(async () => {
  await H.seed();
  const browser = await chromium.launch();
  const jobs = []; const results = {};
  for (const p of pages) for (const [w, h, d] of [[390, 800, 'mob'], [1366, 820, 'desk']]) for (const [role, init] of [['admin', H.ADMIN_INIT], ['staff', H.STAFF_INIT]]) {
    if (role === 'staff' && d === 'desk') continue;
    jobs.push({ p, w, h, d, role, init });
  }
  let i = 0; const CONC = 4;
  async function worker() { while (i < jobs.length) { const j = jobs[i++]; const r = await probe(browser, j.p, j.init, j.w, j.h); results[`${j.p}|${j.role}|${j.d}`] = r; } }
  await Promise.all(Array.from({ length: CONC }, worker));
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  await browser.close(); console.log('done', Object.keys(results).length);
})();
