// (TASK-A0552 · سجلّ الأخطاء: «تجمّدت الواجهة» نفسها بالمدّة نفسها في عدّة صفحات معاً = توقّف رسمٍ من الجهاز)
//  ① تجميدٌ حقيقي (عملٌ ثقيل ٣٫٥ث في الصفحة) ⇒ يُسجَّل مع مدّة المهامّ الطويلة
//  ② فجوةٌ بلا مهمّةٍ طويلة (توقّف الرسم من الجهاز) ⇒ لا تُسجَّل
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('weekly_report.html', { w: 1280, h: 900, mobile: false, wait: 5000 });
  const sup = await pg.evaluate(() => (PerformanceObserver.supportedEntryTypes || []).includes('longtask'));
  ok(sup, 'المتصفّح (كروم) يدعم المهامّ الطويلة');
  // ②: فجوةٌ وهمية بلا مهامّ طويلة
  const fake = await pg.evaluate(() => { const t = performance.now(); return window.__gmtFreezeCheck(t - 8000, t - 1000); });
  ok(fake === false, '② فجوة ٧ث بلا عملٍ ثقيل ⇒ ليست تجميداً');
  // ①: عملٌ ثقيل حقيقي
  const n0 = await pg.evaluate(() => GMTBug.list().filter(e => e.type === 'تجميد').length);
  /* مهمّةٌ من الصفحة نفسها (setTimeout) — ما يُنفَّذ من أداة الاختبار مباشرةً لا يُعدّ «مهمّة» عند المتصفّح */
  await pg.evaluate(() => { setTimeout(() => { const end = Date.now() + 3500; while (Date.now() < end) {} }, 0); });
  await sleep(5000);
  const fr = await pg.evaluate(() => GMTBug.list().filter(e => e.type === 'تجميد').map(e => JSON.stringify(e)));
  ok(fr.length === n0 + 1 && /مهامّ طويلة/.test(fr[fr.length - 1] || ''), '① التجميد الحقيقي سُجّل ' + (fr[fr.length - 1] || ''));
  const busy = await pg.evaluate(() => { const L = window.__gmtLongTasks; const x = L[L.length - 1]; return x ? window.__gmtFreezeCheck(x.s, x.s + x.d) : null; });
  ok(busy === true, '① الفجوة التي غطّتها مهمّةٌ طويلة = تجميد');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
