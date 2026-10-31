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
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
