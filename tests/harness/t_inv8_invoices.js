// (TASK-0330 · المالك seq 530/531) «ليش الى الان في 226 منتج غير مرتبطه بفاتوره شراء؟» · «صلح كل الفواتير … والمنتجات المرتبطه
//  سواء كميتها صفر بالنسبه للي عرفناها جديدا فلا مشكله»
//  ① «فرز المنتجات القديمة» يعرض فقط ما عليه كمية بلا فاتورة (الكمية صفر لا تحتاج فاتورة ولا تُحدَّد).
//  ② الدمج ينقل بنود فواتير الشراء (import_log.items_snapshot) من المحذوف إلى الباقي.
//  ③ (TASK-0326) ورقة الملصقات الجماعية موجودة في الجرد.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const real = (errs) => errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon/.test(e));
(async () => {
  // ── ① أداة الفرز ──
  await H.seed();
  const [STOCK, ZERO, INV] = await H.call('/rest/v1/products', [
    { name: 'منتج عليه كمية بلا فاتورة', barcode: 'IV0001', price: 5, cost_price: 0, haleb: 4, daraa: 0 },
    { name: 'منتج معرّف للمتجر بكمية صفر', barcode: 'IV0002', price: 9, cost_price: 0, haleb: 0, daraa: 0 },
    { name: 'منتج له فاتورة', barcode: 'IV0003', price: 7, cost_price: 3, haleb: 2, daraa: 0 }]);
  await H.call('/rest/v1/import_log', [{ inv_number: 'PO-2026-0001', inv_type: 'instant', supplier: 'X', status: 'arrived', items_snapshot: [{ id: INV.id, name: INV.name, qty: 2, unit_price: 3 }] }]);
  let { browser, pg, errs } = await H.open('inventory.html', { w: 390, h: 844, mobile: true, wait: 5000, init: H.ADMIN_INIT });
  await pg.evaluate(() => window.openAthenaeumTool && window.openAthenaeumTool());
  await pg.waitForTimeout(1500);
  const a = await pg.evaluate(() => ({ cnt: (document.getElementById('ath-count') || {}).textContent || '', list: (document.getElementById('ath-list') || {}).innerText || '', cbs: document.querySelectorAll('.ath-cb').length, labels: !!window.GMTLabels,
    expect: (window.allProducts || []).filter(p => p.id !== undefined && String(p.id) !== '' && ['haleb','daraa','homs','germany','china','kurani','sarmada','fakhouri','hny_sbyl'].reduce((s, k) => s + (Number(p[k]) || 0), 0) > 0).length - 1 }));
  ok(a.cbs === a.expect && /منتج عليه كمية بلا فاتورة/.test(a.list), 'الأداة تعرض فقط ما عليه كمية بلا فاتورة (' + a.cbs + ' = ' + a.expect + ' من بيانات الاختبار)');
  ok(!/منتج معرّف للمتجر بكمية صفر/.test(a.list.replace(/ℹ️[^\n]*/, '')) && /1 منتجاً بلا فاتورة كميتها صفر/.test(a.list), 'المنتج بكمية صفر لا يُعرض ولا يُحدَّد — سطر يذكر عدده');
  ok(!/منتج له فاتورة/.test(a.list), 'المنتج المربوط بفاتورة لا يظهر');
  ok(a.cnt.trim() === a.cbs + ' منتج عليه كمية بلا فاتورة', 'العدّاد يطابق القائمة: «' + a.cnt + '»');
  ok(a.labels, '(TASK-0326) ورقة الملصقات الجماعية GMTLabels محمّلة في الجرد');
  ok(real(errs).length === 0, 'لا أخطاء JS ' + real(errs).join(' | '));
  await browser.close();

  // ── ② الدمج ينقل بنود فواتير الشراء ──
  await H.seed();
  const [KEEP, DUP] = await H.call('/rest/v1/products', [
    { name: 'Tripod 330A ترايبود', barcode: 'MV0001', price: 10, haleb: 3, daraa: 0, invoice_names: [] },
    { name: 'STAND FOR CAMERA 3110', barcode: 'MV0002', price: 0, haleb: 0, daraa: 0, invoice_names: [] }]);
  await H.call('/rest/v1/import_log', [
    { inv_number: 'PO-2026-0020', inv_type: 'instant', supplier: 'شركة مدى', status: 'arrived', items_snapshot: [{ id: 'other-1', name: 'شيء آخر', qty: 1 }, { id: DUP.id, name: 'STAND FOR CAMERA 3110', qty: 3, unit_price: 4 }] },
    { inv_number: 'PO-2026-0021', inv_type: 'instant', supplier: 'شركة مدى', status: 'arrived', items_snapshot: [{ id: 'other-2', name: 'لا علاقة', qty: 1 }] }]);
  await H.call('/rest/v1/gmt_merge_review', [{ kind: 'merge', prio: 1, status: 'pending', subject_id: DUP.id, cands: [{ id: KEEP.id, label: 'عندك في الجرد' }], title: 'هل 3110 هو 330A؟' }]);
  ({ browser, pg, errs } = await H.open('home.html', { w: 1366, h: 900, mobile: false, wait: 5000, init: H.ADMIN_INIT }));
  await pg.waitForSelector('.mr-ov [data-mr="merge"]', { timeout: 12000 }).catch(() => {});
  await pg.click('.mr-ov [data-mr="merge"]').catch(() => {});
  await pg.waitForTimeout(800);
  for (const b of await pg.$$('.gmtask-ov button')) { if (/نعم/.test(await b.textContent())) { await b.click(); break; } }
  await pg.waitForTimeout(1800);
  const d = await H.call('/__dump', undefined, 'GET');
  const l20 = (d.import_log || []).find(r => r.inv_number === 'PO-2026-0020'), l21 = (d.import_log || []).find(r => r.inv_number === 'PO-2026-0021');
  ok(!d.products.find(p => p.id === DUP.id), 'المكرّر حُذف بعد الدمج');
  const it = l20 && l20.items_snapshot.find(x => x.name === 'STAND FOR CAMERA 3110');
  ok(it && it.id === KEEP.id && it.merged_from === DUP.id, 'بند فاتورة الشراء صار على المنتج الباقي (merged_from محفوظ)');
  ok(l20 && l20.items_snapshot.find(x => x.id === 'other-1'), 'بقية بنود الفاتورة كما هي');
  ok(l21 && l21.items_snapshot[0].id === 'other-2', 'فاتورة لا علاقة لها لم تُمسّ');
  ok(real(errs).length === 0, 'لا أخطاء JS ' + real(errs).join(' | '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})();
