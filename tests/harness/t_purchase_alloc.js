// (TASK-B0519 · المالك seq 832/840/841) توزيع التكاليف الحقيقيّ من الباكينج ليست:
// البند الذي عليه alloc_unit يُعرض ويُكتب سعر شرائه منه (لا بنسبة القيمة) · الأصل بلا باركود · أيّ تغييرٍ ⇒ يعود التوزيع العاديّ
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [
    { name: 'واقي مراوح اختبار', barcode: 'AL0001', price: 40, cost_price: 1, china: 0 },
    { name: 'حقيبة كاميرا اختبار', barcode: 'AL0002', price: 30, cost_price: 1, china: 0 }]);
  /* التكاليف 100$ · بنسبة القيمة كان: A (10×20=200) ⇒ 20×1.333=26.67 · B (10×10=100) ⇒ 13.33 · والأصل يأخذ حصّة */
  const [IV] = await H.call('/rest/v1/import_log', [{ inv_number: 'IMP-2026-0098', inv_type: 'china', supplier: 'Shenzhen Test', status: 'transit', total_amount: 350,
    items_count: 3, total_qty: 25, cost_shipping: 60, cost_customs: 40,
    items_snapshot: [
      { id: A.id, name: A.name, qty: 10, unit_price: 20, orig_unit_price: 20, barcode: 'AL0001', alloc_unit: 21, alloc_qty: 10, alloc_orig: 20, alloc_tot: 100, alloc: { customs: 4, ship: 6, other: 0, codes: ['3926.90.99'] } },
      { id: B.id, name: B.name, qty: 10, unit_price: 10, orig_unit_price: 10, barcode: 'AL0002', alloc_unit: 18.6, alloc_qty: 10, alloc_orig: 10, alloc_tot: 100, alloc: { customs: 32, ship: 54, other: 0, codes: ['4202.29.00'] } },
      { id: null, name: 'قارئ باركود (أصل)', qty: 5, unit_price: 10, orig_unit_price: 10, barcode: 'AL0003', asset: true, alloc_unit: 10.8, alloc_qty: 5, alloc_orig: 10, alloc_tot: 100, alloc: { customs: 4, ship: 0, other: 0 } }] }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  await pg.evaluate(id => { openInvFromList(id); }, IV.id); await pg.waitForTimeout(600);
  const shown = await pg.evaluate(() => [...document.querySelectorAll('#inv-items-tbl tbody tr')].map(tr => { const c = tr.querySelectorAll('td')[4]; return { v: (c.querySelector('div') || c).textContent.trim(), t: c.title }; }));
  ok(shown[0] && shown[0].v === '21.00', 'البند الأوّل يُعرض بكلفته الحقيقية 21.00 لا بنسبة القيمة: ' + (shown[0] && shown[0].v));
  ok(shown[1] && shown[1].v === '18.60', 'الحقيبة الثقيلة 18.60 (وزنها أكبر رغم رخصها): ' + (shown[1] && shown[1].v));
  ok(shown[2] && shown[2].v === '10.80' && /جمارك فقط/.test(shown[2].t), 'الأصل عليه جمارك فقط: ' + (shown[2] && shown[2].v + ' · ' + shown[2].t));
  ok(/جمارك 0\.40 \+ شحن 0\.60/.test(shown[0].t), 'التفصيل في تلميح الخانة: ' + shown[0].t);
  /* الباركود: الأصل لا يُطبع */
  const lbl = await pg.evaluate(() => { let got = null; const o = window.GMTLabels; window.GMTLabels = { openSheet: (items) => { got = items; return true; } }; printBarcodes(); window.GMTLabels = o; return got; });
  ok(lbl && lbl.length === 2 && !lbl.some(x => /أصل/.test(x.name)), 'ورقة الباركود بلا الأصل: ' + (lbl && lbl.map(x => x.name).join('، ')));
  /* الحفظ يكتب سعر الشراء الحقيقيّ للمنتج */
  await pg.evaluate(() => toggleInvEdit()); await pg.waitForTimeout(300);
  await pg.evaluate(() => saveInvEdits()); await pg.waitForTimeout(900);
  await pg.evaluate(() => { const m = document.getElementById('conflictModal'); if (m && m.classList.contains('open')) applyAllFromInv(); });
  await pg.waitForTimeout(1500);
  const d = await H.call('/__dump', undefined, 'GET');
  const pa = d.products.find(p => p.id === A.id), pb = d.products.find(p => p.id === B.id), row = d.import_log.find(r => r.id === IV.id);
  ok(pa && Math.abs(+pa.cost_price - 21) < 0.001, 'سعر شراء A في الجرد = 21 (كان التوزيع بالقيمة يعطي 26.67): ' + (pa && pa.cost_price));
  ok(pb && Math.abs(+pb.cost_price - 18.6) < 0.001, 'سعر شراء B = 18.6: ' + (pb && pb.cost_price));
  const snap = row && (typeof row.items_snapshot === 'string' ? JSON.parse(row.items_snapshot) : row.items_snapshot) || [];
  ok(snap[0] && snap[0].alloc_unit === 21 && snap[2] && snap[2].asset === true, 'التوزيع ووسم الأصل باقيان في الفاتورة بعد الحفظ');
  /* تغيير الكمية ⇒ يسقط التوزيع اليدويّ ويعود التوزيع العاديّ (لا رقم قديم كاذب) */
  const back = await pg.evaluate(() => { const it = d_items_ref[0]; const q = it.qty; it.qty = 11; const a = _allocOf(it); it.qty = q; return a; });
  ok(back === null, 'تغيّرت الكمية ⇒ لا يُستعمل التوزيع القديم');
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
