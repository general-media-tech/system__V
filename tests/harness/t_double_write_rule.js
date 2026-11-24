// (seq B1035/B1044) «كتابة مزدوجة» على gmt_orders: حقولٌ مختلفة على الصفّ نفسه ليست مضاعفة (PATCH قيمٌ مطلقة) ·
// القيمة نفسها مرّتين = تحذير · الحقل نفسه بقيمتين على جدول مخزون/مال = حرج · إدراج/حذف متكرّر = حرج
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [P] = await H.call('/rest/v1/products', [{ name: 'منتج كشف', barcode: 'DW1', price: 5, daraa: 2 }]);
  const [O] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون', phone: '0933000111', product: 'x', qty: 1, price: 5, status: 'pending' }]);
  const { browser, pg } = await H.open('orders.html', { w: 1366, h: 900, mobile: false, wait: 4000 });
  const run = (steps) => pg.evaluate(async steps => {
    try { localStorage.removeItem('gmt_bugs_v3'); } catch (_) {}
    if (window.GMTBugs && GMTBugs.clear) GMTBugs.clear();
    for (const [m, path, body] of steps) await fetch(SUPA_URL + path, { method: m, headers: Object.assign({}, SB_HEADERS, { 'Content-Type': 'application/json' }), body: body ? JSON.stringify(body) : undefined });
    await new Promise(r => setTimeout(r, 300));
    return JSON.parse(localStorage.getItem('gmt_bugs_v3') || '[]').filter(e => /مزدوجة|تكرار كتابة|تعديلان/.test(e.type)).map(e => e.sev + ':' + e.type);
  }, steps);
  let r = await run([['PATCH', '/rest/v1/gmt_orders?id=eq.' + O.id, { status: 'shipped' }], ['PATCH', '/rest/v1/gmt_orders?id=eq.' + O.id, { notified_ship_at: new Date().toISOString() }]]);
  ok(!r.some(x => /^crit/.test(x)) && !r.length, 'أوردر: الحالة ثمّ وقت التبليغ (حقلان مختلفان) ⇒ لا تنبيه: ' + JSON.stringify(r));
  r = await run([['PATCH', '/rest/v1/gmt_orders?id=eq.' + O.id, { status: 'done' }], ['PATCH', '/rest/v1/gmt_orders?id=eq.' + O.id, { status: 'done' }]]);
  ok(!r.some(x => /^crit/.test(x)), 'أوردر: القيمة نفسها مرّتين ⇒ تحذير لا حرج: ' + JSON.stringify(r));
  r = await run([['PATCH', '/rest/v1/products?id=eq.' + P.id, { daraa: 3 }], ['PATCH', '/rest/v1/products?id=eq.' + P.id, { daraa: 5 }]]);
  ok(r.some(x => /^crit:كتابة مزدوجة/.test(x)), 'مخزون: الحقل نفسه بقيمتين خلال ثانيتين ⇒ حرج (قد يكون حساباً من قراءةٍ قديمة): ' + JSON.stringify(r));
  r = await run([['PATCH', '/rest/v1/products?id=eq.' + P.id, { price: 6 }], ['PATCH', '/rest/v1/products?id=eq.' + P.id, { image_url: 'x.jpg' }]]);
  ok(!r.length, 'منتج: السعر ثمّ الصورة (حقلان مختلفان) ⇒ لا تنبيه (كان «كتابة مزدوجة» في الفاحص العميق): ' + JSON.stringify(r));
  r = await run([['DELETE', '/rest/v1/gmt_orders?id=eq.999999'], ['DELETE', '/rest/v1/gmt_orders?id=eq.999999']]);
  ok(r.some(x => /^crit/.test(x)), 'حذفٌ متكرّر على الصفّ نفسه ⇒ حرج: ' + JSON.stringify(r));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
