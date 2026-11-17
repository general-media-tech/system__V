// (TASK-B0417/B0419 · المالك seq 727) «تظهر الباقة في كل الفروع وكل نقاط البيع — كل ما نزّلنا عرضاً جديداً تظهر»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [{ name: 'منتج باقة أ', barcode: 'LV-A', price: 100, net_cost: 50, daraa: 0, homs: 5 }, { name: 'منتج باقة ب', barcode: 'LV-B', price: 50, net_cost: 20, daraa: 0, homs: 5 }]);
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 6000 });
  const n0 = await pg.evaluate(() => allProducts.filter(p => p._is_offer).length);
  ok(n0 === 0, 'لا عروض عند الفتح');
  await H.call('/rest/v1/gmt_offers', [{ name: 'باقة جديدة حيّة', offer_type: 'bundle', offer_price: 120, is_active: true, products: JSON.stringify([{ id: A.id, name: A.name, qty: 1 }, { id: B.id, name: B.name, qty: 1 }]), targets: { pos: true, store: true } }]);
  await H.call('/rest/v1/gmt_offers', [{ name: 'باقة للمتجر وحده', offer_type: 'bundle', offer_price: 90, is_active: true, products: JSON.stringify([{ id: A.id, name: A.name, qty: 1 }]), targets: { pos: false, store: true } }]);
  await pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await pg.waitForTimeout(2500);
  const offs = await pg.evaluate(() => allProducts.filter(p => p._is_offer).map(p => p.short));
  ok(offs.length === 1 && offs[0] === 'باقة جديدة حيّة', 'العرض الجديد يظهر في نقطة البيع المفتوحة دون إعادة تحميل (والمخصَّص للمتجر وحده لا): ' + JSON.stringify(offs));
  /* B0419: العرض الذي مكوّناته صفر في هذا الفرع يظهر في القائمة الافتراضية «مخزوني» */
  const shown = await pg.evaluate(() => { renderProds(); return [...document.querySelectorAll('#prodsGrid .prod-card')].map(c => c.textContent).filter(t => /باقة جديدة حيّة/.test(t)).length; });
  ok(shown === 1, 'العرض يظهر في «مخزوني» حتى لو مكوّناته غير متوفّرة بالفرع (daraa=0): ' + shown);
  const realErr = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|Estimating resolution|navigator.vibrate/.test(e));
  ok(!realErr.length, 'لا أخطاء JS ' + realErr.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
