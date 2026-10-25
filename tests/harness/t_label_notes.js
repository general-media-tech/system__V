// (25 ت1 · TASK-0160) المالك seq 72 + لقطة الكليشيه: «هي الجمل مالازم تنكتب — تم الإنشاء وما إلى آخره»
// كليشيه الأوردر (buildOrderSheetHTML — الطباعة · المشاركة · تيليغرام) لا يطبع ما يكتبه النظام في الملاحظات، ويطبع ما كتبه الموظّف.
// والملاحظات كاملةً باقيةٌ على بطاقة الأوردر (داخلية).
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const notes = ['اتصل قبل التوصيل', 'أجور شحن ضمن الإجمالي: $1 (المبلغ الأصلي $6)', 'أجور شحن مضافة على التحصيل: $2',
    '💲 المراد تحصيله ٠ — السبب: مدفوع شام كاش · أذن: فاحص', 'تم إنشاء هذا الأوردر بواسطة: فاحص النظام'].join('\n');
  const [o1] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون الكليشيه', phone: '0933000701', product: 'جلدة عين', qty: 2, price: 7, status: 'pending', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي', notes }]);
  const [o2] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون الحجز', phone: '0933000702', product: 'عدسة', qty: 1, price: 40, status: 'pending', branch: 'حلب', address: 'حمص', notes: 'لون أسود | منقول من الحجوزات | عربون مدفوع: $10' }]);
  const [o3] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون بلا ملاحظة', phone: '0933000703', product: 'حامل', qty: 1, price: 9, status: 'pending', branch: 'حلب', address: 'حماة', notes: 'تم إنشاء هذا الأوردر بواسطة: فاحص النظام' }]);
  for (const W of [390, 1366]) {
    const { browser, pg, errs } = await H.open('orders.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 4000 });
    const r = await pg.evaluate(ids => ids.map(id => { const o = orders.find(x => x.id == id); const d = document.createElement('div'); d.innerHTML = buildOrderSheetHTML(o, false); return d.textContent.replace(/\s+/g, ' '); }), [o1.id, o2.id, o3.id]);
    ok(r[0].includes('اتصل قبل التوصيل'), W + ': ملاحظة الموظّف تُطبع');
    ok(!/تم إنشاء هذا الأوردر|أجور شحن|السبب: مدفوع|أذن:/.test(r[0]), W + ': لا «تم إنشاء…» ولا أجور الشحن ولا سبب الصفر في الكليشيه');
    ok(r[1].includes('لون أسود') && !/منقول من الحجوزات|عربون مدفوع/.test(r[1]), W + ': «منقول من الحجوزات | عربون» لا يُطبع وملاحظة الموظّف تبقى');
    ok(!/تم إنشاء هذا الأوردر/.test(r[2]), W + ': أوردرٌ ملاحظته من النظام وحده ⇒ خانة الملاحظات فارغة (كما في القالب)');
    const card = await pg.evaluate(id => (document.getElementById('card-' + id) || {}).innerText || '', o1.id);
    ok(/تم إنشاء هذا الأوردر/.test(card) && /أجور شحن/.test(card), W + ': البطاقة (داخلية) تُبقي الملاحظات كاملة');
    ok(!errs.filter(e => !/status of (400|503)/.test(e)).length, W + ': لا أخطاء JS ' + errs.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
