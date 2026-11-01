// (TASK-0296 · المالك seq 308 «لسع في قطع من الكفرات مو مندمجة؟») منتجٌ دُمج أو حُذف في الجرد كان يبقى ظاهراً في نقطة البيع
// على كل جهازٍ حمّله قبلها، لأنّ المزامنة الخلفية تحدّث الكميات فقط ولا تُسقط المحذوف. الآن يُزال من الشاشة ومن ذاكرة الجهاز.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  const { prods } = await H.seed();
  const { browser, pg, errs } = await H.open('pos.html', { w: 390, h: 844, mobile: true, wait: 6000, init: H.STAFF_INIT });
  const before = await pg.evaluate(() => allProducts.length);
  const victim = prods[1];
  ok(await pg.evaluate(id => allProducts.some(p => String(p.id) === String(id)), victim.id), 'المنتج ظاهرٌ في نقطة البيع قبل الحذف: ' + victim.name);
  await H.call('/rest/v1/products?id=eq.' + victim.id, undefined, 'DELETE');          // دُمج/حُذف في الجرد
  await pg.evaluate(() => _backgroundSync());
  await pg.waitForTimeout(600);
  const after = await pg.evaluate(id => ({ n: allProducts.length, still: allProducts.some(p => String(p.id) === String(id)) }), victim.id);
  ok(!after.still && after.n === before - 1, 'بعد المزامنة الخلفية: اختفى من الشاشة (' + before + ' ⇐ ' + after.n + ')');
  const inIdb = await pg.evaluate(id => new Promise(res => { const rq = indexedDB.open('gmt_pos_db'); rq.onsuccess = () => { try { const g = rq.result.transaction('products', 'readonly').objectStore('products').get(id); g.onsuccess = () => res(!!g.result); g.onerror = () => res('err'); } catch (e) { res('err:' + e.message); } }; rq.onerror = () => res('err'); }), victim.id);
  ok(inIdb === false, 'وأُزيل من ذاكرة الجهاز فلا يعود عند الفتح بلا إنترنت: ' + inIdb);
  const offers = await pg.evaluate(() => { allProducts.push({ id: 'OFFER_test', name: 'عرض' }); return _backgroundSync().then(() => allProducts.some(p => p.id === 'OFFER_test')); });
  ok(offers, 'منتجات العروض (OFFER_…) لا تُمسّ');
  const real = errs.filter(e => !/status of (400|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
