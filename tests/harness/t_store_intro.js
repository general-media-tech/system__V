// (TASK-0284 · المالك seq 224) «انترو المتجر عم يطول كتير كتير»
// كان: ٣٫٢ث حدّاً أدنى + انتظار كل صور الصفحة حتى ٥ث (≈٨ث). المطلوب: يظهر ثمّ يختفي سريعاً، وسقفٌ مهما بطؤ الاتصال.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function probe({ storeDelay = 0, cached = false } = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await ctx.route(/^https:\/\/(?!127)/, r => r.fulfill({ status: 404, body: '' }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '', headers: { 'Content-Type': 'text/css' } }));
  // صور المنتجات بطيئة جداً (١٠ث) — كانت تُبقي الانترو ٥ث إضافية
  await ctx.route(/^https:\/\/img\.slow\.test\//, async r => { await sleep(10000); r.fulfill({ status: 404, body: '' }).catch(() => {}); });
  await ctx.route('**/*.supabase.co/**', async route => {
    const u = route.request().url(); const i = u.indexOf('/rest/v1/');
    if (i < 0) return route.fulfill({ status: 200, body: '{}' });
    if (storeDelay && /\/rest\/v1\/gmt_store/.test(u)) await sleep(storeDelay);
    try { const r = await route.fetch({ url: H.M + u.slice(i) }); await route.fulfill({ response: r }); } catch (e) { try { await route.abort(); } catch (_) {} }
  });
  if (cached) {   // زيارة ثانية: الكتالوج في ذاكرة المتصفّح
    await pg.goto(H.BASE + 'store.html?skip_intro=1', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => document.querySelectorAll('[onclick*="openProductModal"], .product-card').length > 0, null, { timeout: 15000 }).catch(() => {});
  }
  const t0 = Date.now();
  await pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(600);
  const earlyVisible = await pg.evaluate(() => { const i = document.getElementById('intro-screen'); return !!i && !i.classList.contains('hide'); });
  await pg.waitForFunction(() => { const i = document.getElementById('intro-screen'); return !i || i.classList.contains('hide'); }, null, { timeout: 20000 }).catch(() => {});
  const ms = Date.now() - t0;
  await pg.waitForTimeout(storeDelay ? storeDelay : 300);
  const shown = await pg.evaluate(() => document.body.innerText.includes('عدسة كانون 50'));
  await browser.close();
  return { ms, earlyVisible, shown, errs };
}

(async () => {
  await H.seed();
  const products = Array.from({ length: 30 }, (_, k) => ({ id: 's_' + k, name: k ? 'منتج ' + k : 'عدسة كانون 50', price: 50 + k, images: ['https://img.slow.test/p' + k + '.jpg'], category_id: 'c1' }));
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-31T10:00:00Z', categories: [{ id: 'c1', name: 'عدسات', order: 1 }], products }]);

  const a = await probe();
  ok(a.earlyVisible, 'الانترو ما زال يظهر (الشعار والترحيب) عند ٠٫٦ث');
  ok(a.ms < 2800, 'أوّل زيارة · ٣٠ منتجاً صورها بطيئة: الانترو يختفي خلال ' + a.ms + ' مللي (كان ٤٣٠٠ في هذا الاختبار)');
  ok(a.shown, 'المنتجات ظاهرة بعده');

  const b = await probe({ cached: true });
  ok(b.ms < 2400, 'زيارة ثانية (الكتالوج محفوظ): يختفي خلال ' + b.ms + ' مللي');

  const c = await probe({ storeDelay: 7000 });
  ok(c.ms < 4800, 'الكتالوج بطيء (٧ث): السقف يُخفي الانترو خلال ' + c.ms + ' مللي');
  ok(c.shown, 'والمنتجات تظهر حين يصل الكتالوج');

  const real = a.errs.concat(b.errs, c.errs);
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
