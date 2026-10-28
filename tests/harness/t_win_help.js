// (TASK-0235 · المالك seq 163) «على الكمبيوتر التطبيق عم ينحضر» — ويندوز يمنع الاختصار القديم ⇒ دليل التثبيت الجديد/إلغاء الحظر في بطاقة الجهاز
const H = require('./h.js');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const b = await chromium.launch(), errs = [];
  for (const [ua, w, want] of [['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 1366, true],
                               ['Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36', 390, false]]) {
    const ctx = await b.newContext({ userAgent: ua, viewport: { width: w, height: 844 }, serviceWorkers: 'block' });
    await ctx.addInitScript(H.ADMIN_INIT);
    const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(String(e)));
    await pg.goto(H.BASE + 'home.html', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(5000);
    const has = await pg.evaluate(() => !!document.querySelector('[data-act="win-help"]'));
    ok(has === want, (want ? 'ويندوز (1366)' : 'هاتف أندرويد') + ': زرّ «💻 الكمبيوتر» في بطاقة التثبيت ' + (want ? 'ظاهر' : 'غير ظاهر'));
    if (want) {
      await pg.evaluate(() => document.querySelector('[data-act="win-help"]').click()); await pg.waitForTimeout(500);
      const t = await pg.evaluate(() => (document.querySelector('.gmtask-ov') || {}).innerText || '');
      ok(/إعدادات أمان الإنترنت/.test(t) && /تثبيت الصفحة كتطبيق/.test(t) && /إلغاء الحظر/.test(t), 'النافذة: السبب · التثبيت من Chrome/Edge · «إلغاء الحظر» من خصائص الاختصار');
    }
    await ctx.close();
  }
  ok(!errs.length, 'لا أخطاء JS ' + errs.slice(0, 2).join(' / '));
  await b.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
