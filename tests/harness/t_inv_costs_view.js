// (TASK-0338 · المالك seq 568 «توزيع التكاليف على الفاتورة لا يعمل» · seq 571 «عرض السعر مع التكاليف ما عم يتغيّر سعر الشراء»)
// فاتورة صينية بتكاليف 100$ على قيمة 200$ ⇒ معامل 1.5
//  ① تُفتح من القائمة بسعر الشراء مع التكاليف (15 · 30 · مجموع 300)  ② الزرّ يبدّل للأصلي (10 · 20 · 200) وبالعكس
//  ③ وضع التعديل يُظهر الأصلي (هو ما يُعدَّل)  ④ الحفظ: البند يبقى بالأصلي (لا تُحسب التكاليف مرّتين) والمنتج يأخذ التكلفة الواصلة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [
    { name: 'محوّل تكاليف', barcode: 'CV0001', price: 40, wholesale_price: 35, net_cost: 30, cost_price: 10, china: 10 },
    { name: 'هود تكاليف', barcode: 'CV0002', price: 60, wholesale_price: 50, net_cost: 45, cost_price: 20, china: 5 }]);
  await H.call('/rest/v1/import_log', [{ id: 821, inv_number: 'IMP-2026-0021', inv_type: 'china', supplier: 'وايمن', status: 'arrived', cost_transport: 50, cost_shipping: 50, total_amount: 200,
    items_snapshot: [{ id: A.id, name: A.name, qty: 10, unit_price: 10, orig_unit_price: 10, sale_price: 40, whole_price: 35, min_price: 30 },
      { id: B.id, name: B.name, qty: 5, unit_price: 20, orig_unit_price: 20, sale_price: 60, whole_price: 50, min_price: 45 }] }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  const view = () => pg.evaluate(() => ({
    u: [...document.querySelectorAll('#inv-items-tbl tbody tr')].map(tr => tr.querySelectorAll('td')[4].querySelector('div').textContent.trim()),
    sum: (document.getElementById('inv-sum-purchase') || {}).textContent, btn: (document.getElementById('orig-price-btn') || {}).textContent }));
  await pg.evaluate(() => openInvFromList('821')); await sleep(400);
  let v = await view();
  ok(v.u[0] === '15.00' && v.u[1] === '30.00' && v.sum === '300.00', '① تُفتح بسعر الشراء مع التكاليف ' + JSON.stringify(v));
  await pg.evaluate(() => toggleOrigPrice()); await sleep(200);
  v = await view();
  ok(v.u[0] === '10.00' && v.u[1] === '20.00' && v.sum === '200.00' && /مع التكاليف/.test(v.btn), '② «عرض السعر الأصلي» يغيّر السعر فعلاً ' + JSON.stringify(v));
  await pg.evaluate(() => toggleOrigPrice()); await sleep(200);
  v = await view();
  ok(v.u[0] === '15.00' && v.sum === '300.00', '② «عرض السعر مع التكاليف» يعيده ' + JSON.stringify(v));
  await pg.evaluate(() => toggleInvEdit()); await sleep(200);
  v = await view();
  ok(v.u[0] === '10.00' && v.u[1] === '20.00', '③ وضع التعديل يُظهر السعر الأصلي (هو ما يُعدَّل) ' + JSON.stringify(v));
  // تعديل سعر البند الأوّل إلى 12 ⇒ قيمة 220 ⇒ معامل 1+100/220
  await pg.evaluate(() => { document.querySelectorAll('#inv-items-tbl tbody tr')[0].querySelectorAll('td')[4].querySelector('div').textContent = '12'; saveInvEdits(); });
  await sleep(800);
  await pg.evaluate(() => { if (document.getElementById('conflictModal').classList.contains('open')) applyAllFromInv(); });
  await sleep(1500);
  const d = await H.call('/__dump', undefined, 'GET');
  const r = d.import_log.find(x => x.id === 821), it = r.items_snapshot;
  ok(+it[0].unit_price === 12 && +it[0].orig_unit_price === 12 && +it[1].unit_price === 20 && +r.total_amount === 220, '④ البند يُحفظ بالسعر الأصلي (12 · 20 · قيمة 220) لا مع التكاليف ' + JSON.stringify(it.map(x => [x.unit_price, x.orig_unit_price]).concat([r.total_amount])));
  ok(+r.cost_transport === 50 && +r.cost_shipping === 50, '④ التكاليف بقيت في خاناتها');
  const pA = d.products.find(p => p.id === A.id), pB = d.products.find(p => p.id === B.id);
  ok(Math.abs(pA.cost_price - 12 * (1 + 100 / 220)) < 0.01 && Math.abs(pB.cost_price - 20 * (1 + 100 / 220)) < 0.01, '④ المنتج أخذ التكلفة الواصلة ' + JSON.stringify([pA.cost_price, pB.cost_price]));
  v = await view();
  ok(v.u[0] === (12 * (1 + 100 / 220)).toFixed(2) && v.sum === '320.00', '④ بعد الحفظ: العرض مع التكاليف ومجموعه = القيمة + التكاليف (320) بلا تكرار ' + JSON.stringify(v));
  const gt = await pg.evaluate(() => (document.getElementById('inv-grand-total') || {}).textContent);
  ok(gt === '320.00', '«المجموع الكلي» 320 (220 + 100) ' + gt);
  // فاتورة بلا تكاليف ⇒ الزرّ يقول ذلك والسعر نفسه
  await H.call('/rest/v1/import_log', [{ id: 822, inv_number: 'IMP-2026-0022', inv_type: 'germany', status: 'arrived', items_snapshot: [{ id: A.id, name: A.name, qty: 2, unit_price: 7 }] }]);
  await pg.reload(); await sleep(6000);
  await pg.evaluate(() => openInvFromList('822')); await sleep(400);
  v = await view();
  ok(v.u[0] === '7.00' && /لا تكاليف/.test(v.btn), 'فاتورة بلا تكاليف: السعر كما هو والزرّ يوضّح ' + JSON.stringify(v));
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
