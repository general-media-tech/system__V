// (OWN-05#90) لا زرّ «تقرير الجلسة الأخيرة» في المركز، وبقيّة أزرار الوثائق سليمة، ولا زرّ مفتّش عائم «تقرير الجلسة»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('center.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 3000 });
  const r = await pg.evaluate(() => ({ docs: [...document.querySelectorAll('.docbtn')].map(b => b.dataset.doc), txt: document.body.innerText, fab: !!document.getElementById('gmt-inspect-fab') }));
  ok(r.docs.length > 5 && !r.docs.some(d => /تقرير_الجلسة/.test(d)), 'لا زرّ وثيقة «تقرير_الجلسة» · الأزرار المتبقّية ' + r.docs.length);
  ok(!/تقرير الجلسة الأخيرة/.test(r.txt), 'لا نصّ «تقرير الجلسة الأخيرة» في الصفحة');
  ok(!r.fab, 'لا زرّ مفتّش عائم «تقرير الجلسة»');
  ok(!errs.some(e => !/vibrate/.test(e)), 'بلا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/vibrate/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
