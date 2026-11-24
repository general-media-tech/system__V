// (seq B1060 · تقرير الصحّة «تعذّر التحقّق من 3 ملفّ (الشبكة) … الحل: رفع الملفات المفقودة» والملفّات موجودة)
//   ① ملفٌّ حمّلته الصفحة (gmt-oplog.js) وطلب فحصه تعثّر ⇒ موجود (سجلّ أداء المتصفّح) — لا تنبيه
//   ② ملفٌّ لم تردّ الشبكة عليه ⇒ «info» لا «warn» ⇒ لا يصل تقرير الصحّة 🟠 · ③ الناقص فعلاً (404) ⇒ 🔴 كما كان
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('home.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 5000 });
  await pg.route(/gmt-oplog\.js|zz_net_probe\.css/, r => r.request().method() === 'HEAD' || /zz_net/.test(r.request().url()) ? r.abort('failed') : r.continue());
  const addLink = h => pg.evaluate(h => { const l = document.createElement('link'); l.rel = 'prefetch'; l.href = h; document.head.appendChild(l); }, h);
  const runSC = () => pg.evaluate(async () => (await GMTSelfCheck.run(false)).map(r => ({ level: r.level, title: r.title, detail: r.detail })));
  await addLink('zz_net_probe.css'); await pg.waitForTimeout(800);
  const res1 = await runSC();
  await addLink('zz_missing_probe.css'); await pg.waitForTimeout(800);
  const res = await runSC();
  const all = JSON.stringify(res1);
  ok(!/gmt-oplog/.test(all), '① gmt-oplog.js حمّلته الصفحة ⇒ لا يُذكر رغم تعثّر طلب الفحص');
  const net = res1.find(r => /zz_net_probe/.test(r.detail || ''));
  ok(net && net.level === 'info', '② الشبكة لم تردّ ⇒ info: ' + JSON.stringify(net));
  const miss = res.find(r => /zz_missing_probe/.test(r.detail || ''));
  ok(miss && miss.level === 'bad', '③ الناقص فعلاً (404) ⇒ 🔴: ' + (miss && miss.title));
  const issues = res1.filter(r => r.level === 'bad' || r.level === 'warn').map(r => r.title).join(' | ');
  ok(!/تعذّر التحقّق/.test(issues), 'تقرير الصحّة (bad/warn فقط) لا يحمل «تعذّر التحقّق … الشبكة»: ' + issues);
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
