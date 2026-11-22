// (TASK-A0555 · سجلّ الأخطاء «popup_blocked» في تتبّع الشحنة · وواتساب الطلب في المتجر بعد الحفظ بثانية)
//  ① النافذة مسموحة ⇒ تُفتح ولا تغادر الصفحة
//  ② النافذة ممنوعة ⇒ الصفحة نفسها تذهب لواتساب (لا شيء يضيع) · ولا يُسجَّل «popup_blocked»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('track_order.html', { w: 390, h: 800, wait: 4000 });
  await pg.route('https://wa.me/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>WA</title>واتساب' }));
  const r1 = await pg.evaluate(() => { const o = window.open; let got = null; window.open = (u) => { got = u; return {}; }; const w = GMTOpenExt('https://wa.me/963900000000?text=x'); window.open = o; return { got, here: location.href }; });
  ok(/wa\.me/.test(r1.got || '') && /track_order/.test(r1.here), '① مسموحة ⇒ نافذةٌ جديدة والصفحة باقية');
  await pg.evaluate(() => { window.open = () => null; setTimeout(() => GMTOpenExt('https://wa.me/963900000000?text=%D8%B7%D9%84%D8%A8'), 50); });
  await pg.waitForURL(/wa\.me/, { timeout: 8000 }).catch(() => {});
  ok(/wa\.me\/963900000000/.test(pg.url()), '② ممنوعة ⇒ الصفحة نفسها ذهبت لواتساب ' + pg.url().slice(0, 60));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
