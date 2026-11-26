// (دستور الأداة الجديدة ١ · Q4 · seq B1117) زرّ رجوع الهاتف بنقطة البيع: بيسكّر النافذة المفتوحة (تفاصيل المنتج · المسح · سجلّ
// الفاتورة · العملة …) والكاشير بيضلّ بالصفحة — والسلّة ما بتضيع. النوافذ ثابتة بالصفحة (بتنظهر/بتنخفى) ⇒ data-gmt-modal="static".
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [P] = await H.call('/rest/v1/products', [{ name: 'كاميرا الرجوع', barcode: 'BACK1', price: 100, daraa: 5 }]);
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  const url0 = pg.url();
  ok(await pg.evaluate(() => ['product-detail-overlay', 'scanner-overlay', 'currency-modal', 'inv-detail-modal', 'barcode-modal', 'stockcount-modal', 'thermal-modal']
    .every(id => { const e = document.getElementById(id); return !e || (e.getAttribute('data-gmt-modal') === 'static' && typeof e._gmtClose === 'function'); })), 'كلّ نوافذ نقطة البيع موسومة (رجوع الهاتف بيسكّرها)');
  await pg.evaluate(id => { newInvoice(); addToCartFromDetail(id); }, P.id); await sleep(300);
  const cart0 = await pg.evaluate(() => (typeof cart !== 'undefined' ? Object.keys(cart).length : -1));
  await pg.evaluate(id => openProductDetail(id), P.id); await sleep(600);
  ok(await pg.evaluate(() => document.getElementById('product-detail-overlay').classList.contains('open')), 'فتحنا تفاصيل المنتج');
  await pg.goBack(); await sleep(600);
  ok(pg.url() === url0 && await pg.evaluate(() => !document.getElementById('product-detail-overlay').classList.contains('open')), 'رجوع الهاتف ⇐ تفاصيل المنتج انسكّرت وضلّينا بنقطة البيع');
  ok(await pg.evaluate(() => (typeof cart !== 'undefined' ? Object.keys(cart).length : -1)) === cart0 && cart0 > 0, 'السلّة ما ضاعت (' + cart0 + ')');
  await pg.evaluate(() => openCurrencyModal && openCurrencyModal()); await sleep(400);
  const cOpen = await pg.evaluate(() => document.getElementById('currency-modal').classList.contains('open'));
  if (cOpen) { await pg.goBack(); await sleep(500); }
  ok(!cOpen || (pg.url() === url0 && await pg.evaluate(() => !document.getElementById('currency-modal').classList.contains('open'))), 'نفس الشي لنافذة العملة');
  /* تسكير بـ✕ ⇐ ما في خطوات معلّقة (الرجوع بعدها ما بيعلق) */
  await pg.evaluate(id => openProductDetail(id), P.id); await sleep(500);
  await pg.evaluate(() => closeProductDetail()); await sleep(500);
  ok(pg.url() === url0 && await pg.evaluate(() => GMTBack._stack.length === 0), 'التسكير بـ✕ ⇐ بلا خطوات معلّقة بالتاريخ');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
