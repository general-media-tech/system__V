// (TASK-A0565 · سجلّ الأخطاء ٢٢ ت2: «فشل تحميل IMG» لصورةٍ موجودة (200) من متصفّح إنستغرام · «فشل تحميل SCRIPT gmt-whatsnew» لحظة النشر)
//  ① صورة/سكربت غير موجود فعلاً ⇒ «فشل تحميل IMG (404)» يُسجَّل   ② موجودٌ سقط بالشبكة ⇒ لا يُسجَّل
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('center.html', { w: 390, h: 800, wait: 4000 });
  await pg.route('**/img/p/s/*netfail*', r => r.request().method() === 'HEAD' ? r.fulfill({ status: 200, contentType: 'image/png', body: '' }) : r.abort('internetdisconnected'));
  await pg.route('**/gmt-netfail-a0565.js*', r => r.request().method() === 'HEAD' ? r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }) : r.abort('internetdisconnected'));
  await pg.evaluate(() => {
    const mk = (tag, src) => { const e = document.createElement(tag); e.src = src; document.body.appendChild(e); };
    mk('img', '/img/p/s/no-such-a0565.png'); mk('img', '/img/p/s/x_netfail.png');
    mk('script', '/no-such-a0565.js'); mk('script', '/gmt-netfail-a0565.js');
  });
  await sleep(2500);
  const L = await pg.evaluate(() => JSON.parse(localStorage.getItem('gmt_bugs_v3') || '[]').filter(e => e.type === 'مورد').map(e => e.msg));
  ok(L.some(m => /فشل تحميل IMG \(404\): no-such-a0565\.png/.test(m)), '① صورة غير موجودة سُجّلت بالرمز ' + JSON.stringify(L));
  ok(L.some(m => /فشل تحميل SCRIPT \(404\): no-such-a0565\.js/.test(m)), '① سكربت غير موجود سُجّل بالرمز');
  ok(!L.some(m => /netfail/.test(m)), '② الموجود الذي سقط بالشبكة لم يُسجَّل');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
