// (TASK-B0411 · طابور Sonnet) سعر الصرف الموحّد · اسم الموظّف المسجَّل · تهريب 0 · اسم ملف الصورة · أسماء العمليات العربية
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const real = e => e.filter(x => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(x));
(async () => {
  await H.seed();
  const o = await H.open('orders.html', { init: H.STAFF_INIT.replace("sessionStorage.removeItem('gmt_admin_mode');", "sessionStorage.removeItem('gmt_admin_mode'); localStorage.removeItem('gmt_operator_name');"), wait: 2500 });
  const r = await o.pg.evaluate(() => {
    const a = typeof GMTRate === 'function' ? GMTRate() : null;
    window.GMT_DEFAULT_RATE = 150; const b = GMTRate(); window.GMT_DEFAULT_RATE = 140;
    return { a, b, esc0: escHtmlOrders(0), esc1: escHtmlOrders('<a>'), op: getOperatorName() };
  });
  ok(r.a === 140 && r.b === 150, '① GMTRate يقرأ GMT_DEFAULT_RATE ' + JSON.stringify([r.a, r.b]));
  ok(r.esc0 === '0' && r.esc1 === '&lt;a&gt;', '② escHtmlOrders(0) = «0» والتهريب سليم');
  ok(r.op === 'سامر', '③ الموظّف المسجَّل بحسابه ⇒ getOperatorName يعيد اسم الحساب: ' + r.op);
  ok(!real(o.errs).length, 'لا أخطاء JS في الأوردرات ' + real(o.errs).slice(0, 2).join(' / '));
  await o.browser.close();
  const i = await H.open('inventory.html', { wait: 3000 });
  const n = await i.pg.evaluate(() => imgName('AB-12 عربي', 'PNG ').replace(/\d{10,}/, 'T'));
  ok(/^ab-12-T\.png$/.test(n), '④ imgName: لاتيني صغير بلا عربي: ' + n);
  ok(!real(i.errs).length, 'لا أخطاء JS في الجرد ' + real(i.errs).slice(0, 2).join(' / '));
  await i.browser.close();
  const p = await H.open('سجل_العمليات.html', { wait: 2500 }).catch(() => null);
  if (p) { ok(!real(p.errs).length, '⑤ سجل العمليات بلا أخطاء JS'); await p.browser.close(); }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})();
