// (TASK-A0558 · سجلّ الأخطاء: ~٢٠ «صورة مفقودة (404)» من جهازٍ واحد معاً — وكلّها موجودة: انقطع الإنترنت)
//  ① صورةٌ غير موجودة فعلاً (404) ⇒ تُسجَّل «صورة مفقودة (404)»
//  ② صورةٌ موجودة فشل تحميلها (شبكة) ⇒ لا تُسجَّل «مفقودة»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('center.html', { w: 390, h: 800, wait: 4000 });
  /* «شبكة»: تحميل الصورة نفسها يُقطع، والفحص (HEAD) يجدها موجودة */
  await pg.route('**/logo.jpg?netfail*', r => r.request().method() === 'HEAD' ? r.fulfill({ status: 200, contentType: 'image/jpeg', body: '' }) : r.abort('internetdisconnected'));
  await pg.evaluate(() => {
    const a = document.createElement('img'); a.src = '/no-such-image-a0558.png'; document.body.appendChild(a);
    const b = document.createElement('img'); b.src = '/logo.jpg?netfail=1'; document.body.appendChild(b);
  });
  await sleep(2500);
  const L = await pg.evaluate(() => GMTBug.list().filter(e => e.type === 'missing_asset').map(e => e.msg));
  ok(L.some(m => /صورة مفقودة \(404\): no-such-image-a0558\.png/.test(m)), '① المفقودة فعلاً سُجّلت ' + JSON.stringify(L));
  ok(!L.some(m => /logo\.jpg/.test(m)), '② الموجودة التي سقطت بالشبكة لم تُسجَّل «مفقودة»');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
