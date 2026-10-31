// (المالك seq 276) «المنتجات اللي بحذفها من الجرد تنحذف لحالها من المتجر» — GMTStoreSync.removeFor
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-31T10:00:00Z', categories: [{ id: 'c1', name: 'م', order: 1 }], products: [
    { id: 's1', name: 'محذوف', price: 5, images: [], category_id: 'c1', inv_id: 'INV-1' },
    { id: 's2', name: 'باقٍ', price: 9, images: [], category_id: 'c1', inv_id: 'INV-2' },
    { id: 's3', name: 'كفرات', price: 9, images: [], category_id: 'c1', options: [{ type: 'الكاميرا', values: [{ name: 'R50', inv_id: 'INV-1' }, { name: 'R8', inv_id: 'INV-3' }] }] }] }]);
  const { browser, pg, errs } = await H.open('inventory.html', { w: 1366, h: 900, wait: 4000, init: H.ADMIN_INIT });
  const r = await pg.evaluate(() => window.GMTStoreSync ? GMTStoreSync.removeFor('INV-1', 'https://x/store.html#product=s1') : null);
  const d = await H.call('/__dump', undefined, 'GET'); const sp = d.gmt_store[0].products;
  ok(r && r.removed === 1 && !sp.some(x => x.id === 's1') && sp.some(x => x.id === 's2'), 'حذف منتج الجرد ⇒ قائمته في المتجر حُذفت والباقي كما هو');
  const s3 = sp.find(x => x.id === 's3');
  ok(s3 && s3.options[0].values.length === 1 && s3.options[0].values[0].name === 'R8', 'وخرج من خيارات المنتجات الأخرى (خيار R50 حُذف وبقي R8)');
  ok((d.gmt_audit || []).some(x => x.action === 'store_remove' && x.entity_id === 's1'), 'القائمة المحذوفة محفوظة كاملة في سجلّ العمليات');
  // (المالك seq 291) الدمج: القائمة الباقية وقيم الخيارات تأخذ كود منتج الجرد الباقي
  await H.call('/rest/v1/gmt_store?id=eq.1', { updated_at: '2026-10-31T11:00:00Z', products: [
    { id: 'm1', name: 'محذوف', price: 5, images: ['a.jpg'], category_id: 'c1', inv_id: 'INV-7', barcode: '6200000000071' },
    { id: 'm2', name: 'عائلة', price: 9, images: [], category_id: 'c1', options: [{ type: 'ق', values: [{ name: 'x', inv_id: 'INV-7', barcode: '6200000000071' }] }] }] }, 'PATCH');
  const mr = await pg.evaluate(() => GMTStoreSync.mergeInto('INV-7', 'https://x/store.html#product=m1', 'INV-8', '', '6200000000088'));
  const d2 = await H.call('/__dump', undefined, 'GET'); const sp2 = d2.gmt_store[0].products;
  const m1 = sp2.find(x => x.id === 'm1'), m2 = sp2.find(x => x.id === 'm2');
  ok(mr && mr.moved && m1 && m1.inv_id === 'INV-8' && m1.barcode === '6200000000088', 'الدمج بلا قائمةٍ للباقي ⇒ القائمة انتقلت إليه بكوده لا بكود المحذوف: ' + (m1 && m1.barcode));
  ok(m2 && m2.options[0].values[0].inv_id === 'INV-8' && m2.options[0].values[0].barcode === '6200000000088', 'وقيمة الخيار المربوطة بالمحذوف أخذت منتج الباقي وكوده');
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
