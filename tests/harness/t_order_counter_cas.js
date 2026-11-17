// (ARC-MD-04#62) ذرّية عدّاد الأوردر: حين تغيب الدالة increment_settings_counter (كالمحاكي) ⇒ المسار الاحتياطي
// كتابةٌ مشروطة (compare-and-swap) فلا يأخذ أوردران متزامنان الرقم نفسه، ويُنبَّه الموظّف مرّةً واحدة.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_settings', { key: 'order_serial_counter', value: '41' });
  const { browser, pg, errs } = await H.open('orders.html', { w: 1366, h: 900, mobile: false, wait: 5000 });
  const r = await pg.evaluate(async () => {
    const nums = await Promise.all(Array.from({ length: 6 }, () => getNextSerialCounter()));
    const toast = document.body.innerText.includes('المسار الاحتياطي');
    return { nums, toast, fb: window.__gmtSerialFallback || 0 };
  });
  const uniq = new Set(r.nums);
  ok(uniq.size === r.nums.length, 'ستّة أوردرات متزامنة ⇒ ستّة أرقام مختلفة: ' + r.nums.join(','));
  ok(Math.min(...r.nums) === 42, 'الترقيم يكمل من القاعدة (41 ⇒ 42…): ' + Math.min(...r.nums));
  const d = await H.call('/__dump', undefined, 'GET');
  const row = (d.gmt_settings || []).find(x => x.key === 'order_serial_counter');
  ok(row && +row.value === Math.max(...r.nums), 'القيمة المحفوظة = أكبر رقم مُنح: ' + (row && row.value));
  ok(r.fb >= 1 && r.toast, 'غياب الدالة الذرّية لم يعد صامتاً: تنبيهٌ للموظّف (' + r.toast + ') · المحاولات ' + r.fb);
  const t2 = await pg.evaluate(async () => { await getNextSerialCounter(); return document.querySelectorAll('.toast, #toast').length; });
  ok(t2 <= 1, 'التنبيه مرّة واحدة في الجلسة لا مع كل أوردر');
  /* مفتاحٌ غير موجود بعد ⇒ يُنشأ */
  await H.call('/__reset', {}); await H.seed();
  const n1 = await pg.evaluate(async () => getNextSerialCounter());
  ok(n1 === 1, 'لا عدّاد في القاعدة ⇒ يبدأ من 1 ويُنشأ المفتاح: ' + n1);
  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|favicon|vibrate/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
