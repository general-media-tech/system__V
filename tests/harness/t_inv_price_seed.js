// (TASK-0338 · المالك seq 570) «منتجات موجودة في فاتورة قديمة وفي الجديدة — ليش ما عم تتعرّف أو ما عم ينحطّ نفس التسعيرات للجملة والحد الأدنى»
//  ① إضافة منتج بلا أسعار إلى فاتورة جديدة ⇐ يأخذ مبيع/جملة/حدّ أدنى آخر فاتورة سابقة له (الاستيراد والفوري)
//  ② منتج له أسعار ⇐ أسعاره هو · ③ استيراد إكسل: «8819 stand ستاند» يُعرَف بـ «stand 8819 ستاند» (نفس الكلمات) لا منتج مكرّر
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [
    { name: 'stand 8819 ستاند', barcode: 'PS8819', price: 0, wholesale_price: 0, net_cost: 0, china: 0 },
    { name: 'رأس له أسعار', barcode: 'PS0002', price: 50, wholesale_price: 45, net_cost: 40, china: 0 }]);
  await H.call('/rest/v1/import_log', [{ id: 851, inv_number: 'IMP-2026-0051', inv_type: 'china', status: 'arrived', inv_date: '2026-10-01',
    items_snapshot: [{ id: A.id, name: A.name, qty: 5, unit_price: 2, sale_price: 15, whole_price: 12, min_price: 10 }] }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  const r = await pg.evaluate(([a, b]) => { openAddModal(); addToCart(a); addToCart(b);
    const ca = cart.find(c => c.product.id === a), cb = cart.find(c => c.product.id === b);
    insCart = []; insAddToCart(a); const ia = insCart[0];
    return { ca: [ca.salePrice, ca.wholePrice, ca.minPrice], cb: [cb.salePrice, cb.wholePrice, cb.minPrice], ia: [ia.salePrice, ia.wholePrice, ia.minPrice] }; }, [A.id, B.id]);
  ok(JSON.stringify(r.ca) === '[15,12,10]', '① منتج بلا أسعار ⇐ أسعار آخر فاتورة له (15/12/10) ' + JSON.stringify(r.ca));
  ok(JSON.stringify(r.ia) === '[15,12,10]', '① وفي الشراء الفوري كذلك ' + JSON.stringify(r.ia));
  ok(JSON.stringify(r.cb) === '[50,45,40]', '② منتج له أسعار ⇐ أسعاره هو ' + JSON.stringify(r.cb));
  const m = await pg.evaluate(() => { const p = prodByTokens('8819 stand ستاند'); return p ? p.name : null; });
  ok(m === 'stand 8819 ستاند', '③ نفس الكلمات بترتيب آخر تُعرَف: ' + m);
  const n = await pg.evaluate(() => prodByTokens('8806 stand ستاند'));
  ok(!n, '③ كلمات مختلفة (8806) لا تُربط خطأً');
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
