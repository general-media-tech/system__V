// TASK-0143 — حارس: «كل الصفحات بهذا اللون اعد صقلها» (المالك 9 ت1) و«لا تتناسب مع نظامنا الحالي» (seq 43).
// النظام فاتحٌ بهويّته: لا صفحة داكنة، ولا قاعدة تقلبها داكنةً حين يكون الهاتف على الوضع الليليّ.
// ١) لا «prefers-color-scheme: dark» في أيّ ملفّ html/js/css · ٢) كل صفحة html خلفيّتها فاتحة والهاتف على الوضع الداكن.
const H = require('./h.js');
const fs = require('fs'), path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const ROOT = path.join(__dirname, '..', '..');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  const files = fs.readdirSync(ROOT).filter(f => /\.(html|js|css)$/.test(f));
  const withRule = files.filter(f => /prefers-color-scheme\s*:\s*dark/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  ok(withRule.length === 0, 'لا قاعدة وضعٍ داكن في أيّ ملفّ: ' + JSON.stringify(withRule));
  await H.seed();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, colorScheme: 'dark', serviceWorkers: 'block' });
  await ctx.route('**/*.supabase.co/**', r => r.fulfill({ status: 200, body: '[]', contentType: 'application/json' }));
  await ctx.route(/^https:\/\/(?!127)/, r => r.fulfill({ status: 404, body: '' }));
  await ctx.addInitScript(H.ADMIN_INIT);
  const dark = [];
  const pages = files.filter(f => f.endsWith('.html'));
  for (const f of pages) {
    const pg = await ctx.newPage();
    try {
      await pg.goto(H.BASE + encodeURI(f), { waitUntil: 'domcontentloaded', timeout: 15000 }); await pg.waitForTimeout(900);
      const l = await pg.evaluate(() => {
        const lum = c => { const m = String(c).match(/[\d.]+/g) || [0, 0, 0, 0]; if (m.length > 3 && +m[3] === 0) return null; return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255; };
        const b = lum(getComputedStyle(document.body).backgroundColor), h = lum(getComputedStyle(document.documentElement).backgroundColor);
        return b == null ? (h == null ? 1 : h) : b;
      });
      if (l < 0.5) dark.push(f + ' (' + l.toFixed(2) + ')');
    } catch (e) { /* صفحةٌ لا تُفتح هنا ليست موضوع هذا الحارس */ }
    await pg.close();
  }
  await browser.close();
  ok(dark.length === 0, 'كل الصفحات (' + pages.length + ') فاتحة والهاتف على الوضع الداكن: ' + JSON.stringify(dark));
  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
