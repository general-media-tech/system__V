// (TASK-A0577 · المالك seq 975) «🧮 كيف تكوّن السعر» في تفاصيل المنتج: البند الجمركي · الوزن · الكرتونة · نصيب الجمارك والشحن من الباكينج ليست
//  · السعر الأساسي والواصل لكلّ فاتورة · الكلفة والجملة والمبيع والهامش · تنبيه «مرّتين أغلى» و«سعر 0» · الربط بالمعرّف وإن تغيّر الباركود
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [P] = await H.call('/rest/v1/products', [{ name: 'منتج كلفة A0577', barcode: 'NEWBC77', price: 30, wholesale_price: 24, cost_price: 12.5, haleb: 3 }]);
  await H.call('/rest/v1/import_log', [
    { inv_number: 'IMP-T-0007', inv_type: 'china', supplier: 'Shenzhen', status: 'arrived', currency: 'USD', cost_customs: 50, cost_shipping: 100, items_snapshot: [
      { id: P.id, barcode: 'OLDBC', name: 'منتج كلفة', qty: 10, unit_price: 10, alloc_unit: 12.5, alloc_qty: 10, alloc_orig: 10, alloc_tot: 150, alloc: { customs: 8, ship: 14, other: 3, kg: 2.4, ctn: [7], codes: ['8507.60'], basis: 'الوزن' } }] },
    { inv_number: 'IMP-T-0001', inv_type: 'syria', supplier: 'سوق دمشق', status: 'arrived', currency: 'USD', items_snapshot: [{ id: P.id, barcode: 'OLDBC', name: 'منتج كلفة', qty: 2, unit_price: 27 }] },
    { inv_number: 'IMP-T-0003', inv_type: 'germany', supplier: 'EU', status: 'arrived', currency: 'USD', cost_shipping: 20, items_snapshot: [{ id: P.id, barcode: 'OLDBC', name: 'منتج كلفة', qty: 1, unit_price: 0 }, { id: 'x', name: 'آخر', qty: 4, unit_price: 50 }] }]);
  const { browser, pg, errs } = await H.open('inventory.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  await pg.evaluate(async () => { try { localStorage.removeItem('gmt_purchase_barcodes_v2'); } catch (_) {} _purchaseBarcodes = null; await loadPurchaseBarcodeIndex(true); });
  const has = await pg.evaluate(id => hasPurchaseInvoice(allProducts.find(x => String(x.id) === String(id))), P.id);
  ok(has, 'زرّ «🧮 كيف تكوّن السعر» يظهر للمنتج المربوط بالمعرّف رغم تغيّر باركوده');
  await pg.evaluate(id => openPurchaseInvoiceFor(id), P.id); await pg.waitForTimeout(1500);
  const t = await pg.evaluate(() => (document.getElementById('pi-modal') || {}).innerText || '');
  ok(/كيف تكوّن السعر/.test(t) && /3 فاتورة شراء/.test(t), 'العنوان و٣ فواتير');
  ok(/البند الجمركي: 8507\.60/.test(t) && /0\.24 كغ للقطعة/.test(t) && /كرتونة 7/.test(t) && /جمارك 0\.80/.test(t) && /شحن 1\.40/.test(t), 'من الباكينج ليست: البند الجمركي · الوزن · الكرتونة · جمارك وشحن للقطعة');
  ok(/الكلفة الواصلة: 12\.50/.test(t) && /سعر الشراء الأساسي: 10\.00/.test(t), 'الأساسي 10 ⇐ الواصل 12.50');
  ok(/الكلفة الحاليّة\s*12\.50/.test(t) && /المبيع\s*30\.00/.test(t) && /الهامش: مبيع 58%/.test(t), 'الكلفة والجملة والمبيع والهامش');
  ok(/أسعار متباعدة/.test(t) && /سعر شراء 0/.test(t), 'تنبيه: اشتُري بأسعار متباعدة (12.5 ↔ 27) · وفاتورة بسعر 0');
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
