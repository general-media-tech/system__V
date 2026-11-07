// (TASK-0338 · المالك seq 568) «عندما عدلت فاتورة سمارت ستور الفورية دخلت وكأنها في الطريق … وكأنها آتية من ألمانيا
//  وتكرّرت باسم الفاتورة الصينية … واختفت الفاتورة الصينية»
// نفس الخطوات بالضبط: افتح فاتورة صينية من القائمة ⇐ أغلقها ⇐ افتح الفورية من القائمة ⇐ عدّل ⇐ «حفظ التعديلات» ⇐ «حفظ سحابي»
//  ① الصينية لا تُمسّ أبداً  ② لا تُنشأ فاتورة جديدة  ③ الفورية تبقى فورية/واصلة وبنودها مربوطة  ④ مدخلات خاطئة تُرفض بلا كتابة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [A, B, C, D] = await H.call('/rest/v1/products', [
    { name: 'ستاند صيني 1', barcode: 'ID0001', price: 10, wholesale_price: 9, net_cost: 8, cost_price: 3, china: 40 },
    { name: 'رأس صيني 2', barcode: 'ID0002', price: 20, wholesale_price: 18, net_cost: 16, cost_price: 6, china: 10 },
    { name: 'بطارية سمارت', barcode: 'ID0003', price: 30, wholesale_price: 27, net_cost: 25, cost_price: 20, haleb: 2 },
    { name: 'كرت سمارت', barcode: 'ID0004', price: 15, wholesale_price: 13, net_cost: 12, cost_price: 9, haleb: 3 }]);
  const [CN, PO] = await H.call('/rest/v1/import_log', [
    { id: 801, inv_number: 'IMP-2026-0008', inv_type: 'china', supplier: 'شيشين', status: 'transit', source_branch: 'china', dest_branch: 'haleb', inv_date: '2026-10-23', cost_transport: 45, total_amount: 180,
      items_snapshot: [{ id: A.id, name: A.name, qty: 40, unit_price: 3, orig_unit_price: 3, barcode: 'ID0001', notes: 'بالفاتورة: X · بند 1' },
        { id: B.id, name: B.name, qty: 10, unit_price: 6, orig_unit_price: 6, barcode: 'ID0002' }] },
    { id: 802, inv_number: 'PO-2026-0002', inv_type: 'instant', supplier: 'سمارت ستور', status: 'arrived', source_branch: 'haleb', dest_branch: 'haleb', inv_date: '2026-11-07', total_amount: 67,
      items_snapshot: [{ id: C.id, name: C.name, qty: 2, unit_price: 20, orig_unit_price: 20, min_price: 25, whole_price: 27, sale_price: 30, barcode: 'ID0003', total: 40 },
        { id: D.id, name: D.name, qty: 3, unit_price: 9, orig_unit_price: 9, min_price: 12, whole_price: 13, sale_price: 15, barcode: 'ID0004', total: 27 }] }]);
  const before = await H.call('/__dump', undefined, 'GET');
  const nRows0 = before.import_log.length;
  const cn0 = JSON.stringify(before.import_log.find(r => r.id === 801));

  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  // ① الصينية أوّلاً من القائمة ثم إغلاقها
  await pg.evaluate(() => { openInvFromList('801'); closeInvModal(); });
  await sleep(300);
  // ② الفورية من القائمة ⇐ تعديل ⇐ حفظ التعديلات
  await pg.evaluate(() => { openInvFromList('802'); toggleInvEdit(); });
  await sleep(400);
  const st = await pg.evaluate(() => ({ open: window._invOpen, n: d_items_ref.length, ids: d_items_ref.map(i => i.id) }));
  ok(st.open && String(st.open.id) === '802' && st.open.kind === 'instant' && st.n === 2, 'الفاتورة المفتوحة معروفة بصفّها (802 فورية) ' + JSON.stringify(st.open));
  await pg.evaluate(() => {
    const r0 = document.querySelectorAll('#inv-items-tbl tbody tr')[0].querySelectorAll('td');
    r0[7].querySelector('[contenteditable]').textContent = '32';   // المبيع
    r0[6].querySelector('[contenteditable]').textContent = '28';   // الجملة
    saveInvEdits();
  });
  await sleep(800);
  await pg.evaluate(() => { if (document.getElementById('conflictModal').classList.contains('open')) applyAllFromInv(); });
  await sleep(1200);
  let d = await H.call('/__dump', undefined, 'GET');
  let po = d.import_log.find(r => r.id === 802), cn = d.import_log.find(r => r.id === 801);
  ok(d.import_log.length === nRows0, '«حفظ التعديلات»: لا فاتورة جديدة (' + d.import_log.length + '/' + nRows0 + ')');
  ok(JSON.stringify(cn) === cn0, '«حفظ التعديلات»: الفاتورة الصينية IMP-2026-0008 لم تُمسّ');
  ok(po.inv_type === 'instant' && po.status === 'arrived' && po.inv_number === 'PO-2026-0002' && po.supplier === 'سمارت ستور', 'الفورية بقيت فورية/واصلة وبرقمها ومورّدها ' + JSON.stringify({ t: po.inv_type, s: po.status, n: po.inv_number }));
  ok(po.items_snapshot.length === 2 && po.items_snapshot[0].id === C.id && po.items_snapshot[1].id === D.id, 'بنود الفورية بقيت مربوطة بمنتجاتها');
  ok(+po.items_snapshot[0].sale_price === 32 && +po.items_snapshot[0].whole_price === 28 && +po.items_snapshot[0].orig_unit_price === 20, 'التعديل محفوظ في الفورية (مبيع 32 ⇐ ناقص سنت 31.99 · جملة 28 · الأصلي 20) ' + po.items_snapshot[0].sale_price);
  const pC = d.products.find(p => p.id === C.id);
  ok(+pC.price === 32 && +pC.wholesale_price === 28, 'المنتج تحدّث (مبيع 31.99 · جملة 28) ' + pC.price);
  // ③ «حفظ سحابي» على نفس الفاتورة المفتوحة
  const st2 = await pg.evaluate(() => window._invOpen);
  ok(st2 && String(st2.id) === '802', 'بعد «حفظ التعديلات» ما زالت الفاتورة المفتوحة هي 802 ' + JSON.stringify(st2));
  await pg.evaluate(() => saveInvCloud());
  await sleep(1500);
  d = await H.call('/__dump', undefined, 'GET');
  po = d.import_log.find(r => r.id === 802); cn = d.import_log.find(r => r.id === 801);
  ok(d.import_log.length === nRows0, '«حفظ سحابي»: لا فاتورة جديدة (كانت تُنشأ «ألمانية في الطريق»)');
  ok(!d.import_log.some(r => r.id !== 801 && r.id !== 802 && /PO-2026-0002|—|IMP-2026-0008/.test(r.inv_number || '') && r.inv_type === 'germany'), 'لا فاتورة ألمانية مزيّفة');
  ok(JSON.stringify(cn) === cn0, '«حفظ سحابي»: الصينية لم تُمسّ');
  ok(po.inv_type === 'instant' && po.status === 'arrived' && po.items_snapshot.every(x => x.id), 'الفورية بقيت فورية/واصلة ومربوطة بعد «حفظ سحابي»');

  // ④ مدخلات خاطئة: فاتورة مفتوحة حُذف صفّها من القائمة ⇒ رفض بلا كتابة
  await pg.evaluate(() => { openInvFromList('802'); ships = ships.filter(s => String(s.id) !== '802'); });
  const n1 = (await H.call('/__dump', undefined, 'GET')).import_log.length;
  await pg.evaluate(() => saveInvCloud()); await sleep(800);
  await pg.evaluate(() => saveInvEdits()); await sleep(800);
  d = await H.call('/__dump', undefined, 'GET');
  ok(d.import_log.length === n1 && JSON.stringify(d.import_log.find(r => r.id === 801)) === cn0, 'صفّ غير موجود ⇒ رفض «حفظ سحابي» و«حفظ التعديلات» بلا أيّ كتابة');
  // مسودة فاتورة فورية (لم تُنزَل بعد) ⇒ «حفظ سحابي» يرفض ويوجّه لزرّ الإنزال
  await pg.evaluate(() => { window._invOpen = { draft: true, kind: 'instant' }; d_items_ref = [{ id: null, name: 'تجربة', qty: 1, unitPrice: 1 }]; saveInvCloud(); });
  await sleep(800);
  d = await H.call('/__dump', undefined, 'GET');
  ok(d.import_log.length === n1, 'مسودة فورية ⇒ «حفظ سحابي» لا يُنشئ صفّاً');
  // لا فاتورة مفتوحة إطلاقاً ⇒ رفض
  await pg.evaluate(() => { window._invOpen = null; saveInvCloud(); });
  await sleep(800);
  d = await H.call('/__dump', undefined, 'GET');
  ok(d.import_log.length === n1, 'لا فاتورة مفتوحة ⇒ رفض بلا كتابة');
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
