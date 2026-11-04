// (TASK-0149) دالّتا المخزون الموحّدتان: الخصم فوق الرصيد يُرفض (false) في القاعدة ⇒ نقطة البيع تخصم المتاح كلّه وتُعلِّم «بِيع فوق المتاح»
// والنقل (GMTStock.move) يرى الرفض صريحاً ولا يكمل · والإضافة بفرقٍ سالب لا تنزل تحت الصفر.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const qty = async (id, k) => ((await H.call('/rest/v1/products?id=eq.' + id + '&select=' + k, undefined, 'GET')) || [])[0][k];
(async () => {
  await H.seed();
  const [P1, P2, P3] = await H.call('/rest/v1/products', [
    { name: 'Canon LP-E6', barcode: 'R1', price: 30, haleb: 2, daraa: 5 },
    { name: 'Canon 50mm', barcode: 'R2', price: 120, haleb: 0, daraa: 5 },
    { name: 'Rode Wireless', barcode: 'R3', price: 200, haleb: 4, daraa: 1 }]);
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 6000 });
  // ① بيع 5 والمتاح 2 ⇒ يُخصم المتاح (0) ويُعلَّم فوق المتاح
  const a = await pg.evaluate(id => adjustBranchStockAtomic(id, 'haleb', 5, 'dec', 2), P1.id);
  ok(a.ok && a.newQty === 0 && a.insufficient, 'بيع فوق المتاح ⇒ خصم المتاح كلّه + «فوق المتاح»: ' + JSON.stringify(a));
  ok(await qty(P1.id, 'haleb') === 0, 'القاعدة: الرصيد 0 لا سالب');
  // ② المتاح صفر ⇒ ok · 0 · insufficient
  const b = await pg.evaluate(id => adjustBranchStockAtomic(id, 'haleb', 1, 'dec', 0), P2.id);
  ok(b.ok && b.newQty === 0 && b.insufficient, 'المتاح صفر ⇒ لا خطأ ويُعلَّم: ' + JSON.stringify(b));
  // ③ بيع عادي ⇒ الكمية الجديدة من القاعدة
  const c = await pg.evaluate(id => adjustBranchStockAtomic(id, 'haleb', 3, 'dec', 4), P3.id);
  ok(c.ok && c.newQty === 1 && !c.insufficient, 'بيع عادي 4−3 = 1: ' + JSON.stringify(c));
  // ④ النقل: الرفض صريح ولا تغيير
  const d = await pg.evaluate(id => GMTStock.move('deduct', id, 'daraa', 9), P3.id);
  ok(!d.ok && d.refused, 'GMTStock.move فوق الرصيد ⇒ رفض صريح: ' + JSON.stringify(d));
  ok(await qty(P3.id, 'daraa') === 1, 'المصدر لم يتغيّر بعد الرفض');
  // ⑤ الإضافة بفرقٍ سالب (طرح جماعي) لا تنزل تحت الصفر
  const e = await H.call('/rest/v1/rpc/add_branch_stock', { p_product_id: P2.id, p_branch_key: 'daraa', p_qty: -9 });
  ok(Number(e) === 0 && await qty(P2.id, 'daraa') === 0, 'add_branch_stock(−9) على 5 ⇒ 0: ' + JSON.stringify(e));
  const real = errs.filter(x => !/Failed to load resource|status of (400|404|406)/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
