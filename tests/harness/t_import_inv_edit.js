// (TASK-0335 · المالك seq 564) «فاتورة الشراء الصينية … لا يمكنني تعديل الأسعار البيع والجملة والحد الأدنى من الفاتورة … ولا يمكنني تعديل المنتجات منها»
// فاتورة استيراد مفتوحة من القائمة · رقمها مكرّر مع فاتورة أخرى (IMP-2026-0001 صينية وأوروبية):
//  ① التعديل يصل للمنتج: الاسم + المبيع + الجملة + الحد الأدنى
//  ② بنود الفاتورة تبقى مربوطة بمنتجاتها (id) وحقولها الأصلية (linked_by · merged_from) لا تضيع
//  ③ الفاتورة الأخرى بنفس الرقم لا تُمسّ
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [A, B, C] = await H.call('/rest/v1/products', [
    { name: 'stand 8819 ستاند', barcode: 'IM0001', price: 0, wholesale_price: 0, net_cost: 0, cost_price: 2.24, china: 50 },
    { name: 'رأس BD-600X', barcode: 'IM0002', price: 65, wholesale_price: 60, net_cost: 60, cost_price: 7.28, china: 20 },
    { name: 'منتج الفاتورة الأوروبية', barcode: 'IM0003', price: 100, cost_price: 50, germany: 3 }]);
  const [CN, EU] = await H.call('/rest/v1/import_log', [
    { inv_number: 'IMP-2026-0001', inv_type: 'china', supplier: 'وايمن شنزن', status: 'transit', items_snapshot: [
      { id: A.id, name: A.name, qty: 50, unit_price: 2.24, orig_unit_price: 2.0, linked_by: 'المالك seq 450', barcode: 'IM0001' },
      { id: B.id, name: B.name, qty: 20, unit_price: 7.28, sale_price: 65, whole_price: 60, min_price: 60, merged_from: 'old-1', barcode: 'IM0002' }] },
    { inv_number: 'IMP-2026-0001', inv_type: 'germany', supplier: 'EU', status: 'transit', items_snapshot: [{ id: C.id, name: C.name, qty: 3, unit_price: 50 }] }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  await pg.evaluate(id => { openInvFromList(id); toggleInvEdit(); }, CN.id);
  await pg.waitForTimeout(500);
  const ed = await pg.evaluate(() => {
    const rows = document.querySelectorAll('#inv-items-tbl tbody tr'); const r0 = rows[0].querySelectorAll('td');
    const nm = r0[2].querySelector('[contenteditable]'); const sale = r0[7].querySelector('[contenteditable]');
    return { nameEditable: !!nm && nm.isContentEditable, saleEditable: !!sale && sale.isContentEditable };
  });
  ok(ed.nameEditable && ed.saleEditable, 'في وضع التعديل: اسم المنتج المربوط والمبيع قابلان للتحرير ' + JSON.stringify(ed));
  await pg.evaluate(() => {
    const r0 = document.querySelectorAll('#inv-items-tbl tbody tr')[0].querySelectorAll('td');
    r0[2].querySelector('[contenteditable]').textContent = 'ستاند 8819 بالاسم الجديد';
    r0[5].querySelector('[contenteditable]').textContent = '4.5';   // الحد الأدنى
    r0[6].querySelector('[contenteditable]').textContent = '5';     // الجملة
    r0[7].querySelector('[contenteditable]').textContent = '6';     // المبيع
    saveInvEdits();
  });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => { if (document.getElementById('conflictModal').classList.contains('open')) applyAllFromInv(); });
  await pg.waitForTimeout(1500);
  const d = await H.call('/__dump', undefined, 'GET');
  const pA = d.products.find(p => p.id === A.id);
  ok(pA && pA.name === 'ستاند 8819 بالاسم الجديد' && +pA.price === 6 && +pA.wholesale_price === 5 && +pA.net_cost === 4.5,
    'المنتج تحدّث من الفاتورة: الاسم + المبيع 6 + الجملة 5 + الحد الأدنى 4.5 ' + JSON.stringify(pA && { n: pA.name, p: pA.price, w: pA.wholesale_price, m: pA.net_cost }));
  const cn = d.import_log.find(r => r.id === CN.id), eu = d.import_log.find(r => r.id === EU.id);
  const it = cn.items_snapshot;
  ok(it.length === 2 && it[0].id === A.id && it[1].id === B.id, 'بنود الفاتورة بقيت مربوطة بمنتجاتها ' + JSON.stringify(it.map(x => x.id && x.id.slice(0, 8))));
  ok(it[0].linked_by === 'المالك seq 450' && it[1].merged_from === 'old-1' && +it[0].orig_unit_price === 2, 'حقول البند الأصلية لم تضِع (linked_by · merged_from · السعر الأصلي)');
  ok(it[0].name === 'ستاند 8819 بالاسم الجديد' && +it[0].sale_price === 6, 'البند في الفاتورة يحمل الاسم والسعر الجديدين');
  ok(eu.items_snapshot.length === 1 && eu.items_snapshot[0].id === C.id && eu.items_snapshot[0].name === 'منتج الفاتورة الأوروبية', 'الفاتورة الأوروبية بنفس الرقم IMP-2026-0001 لم تُمسّ');
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})();
