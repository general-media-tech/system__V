// (seq B1043 · الفحص الشامل «منتج له مخزون بلا استلام مسجَّل») الشراء الفوريّ مصدرُ مخزون ⇒ يكتب دفتر الاستلام (stock_receipts · kind=instant)
//   بالكمية والفرع ورقم الفاتورة — كالترحيل تماماً — فلا يراه الفحص «مخزوناً من عدم»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const P = await H.call('/rest/v1/products', [{ name: 'فلتر ND تجربة', barcode: 'IR01', price: 20, cost_price: 5, haleb: 0 }, { name: 'حامل تجربة', barcode: 'IR02', price: 10, cost_price: 3, haleb: 1 }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  pg.on('dialog', d => d.accept()); const bad = []; pg.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + decodeURIComponent(r.url()).slice(-40) + ' ' + (r.request().postData() || '').slice(0, 160)); });
  await pg.evaluate(ids => { openInstantModal(); document.getElementById('ins-branch').value = 'haleb'; ids.forEach(id => insAddToCart(id)); insCart.forEach(c => { const a = String(c.product.id) === String(ids[0]); c.qty = a ? 3 : 2; c.unitPrice = a ? 5 : 3; }); }, [P[0].id, P[1].id]);
  await pg.evaluate(() => saveInstantPurchase()); await pg.waitForTimeout(2500);
  const D = await H.call('/__dump', undefined, 'GET');
  const iv = (D.import_log || []).find(x => x.inv_type === 'instant');
  const rc = (D.stock_receipts || []).filter(r => r.kind === 'instant');
  const q = id => rc.filter(r => r.product_id === String(id)).reduce((s, r) => s + Number(r.qty), 0);
  ok(!!iv && /^PO-/.test(iv.inv_number), 'الفاتورة الفوريّة محفوظة: ' + (iv && iv.inv_number));
  ok(rc.length === 2 && q(P[0].id) === 3 && q(P[1].id) === 2, 'دفتر الاستلام: سطر لكلّ بند بكمّيته: ' + JSON.stringify(rc.map(r => [r.qty, r.branch_key])));
  ok(rc.every(r => r.branch_key === 'haleb' && String(r.import_id) === String(iv && iv.id) && /PO-/.test(r.note || '')), 'بالفرع ورقم الفاتورة: ' + (rc[0] && rc[0].note));
  const pr = (D.products || []).find(x => x.id === P[0].id);
  ok(pr && Number(pr.haleb) === 3, 'المخزون نفسه زاد كما كان (3)');
  const realBad = bad.filter(b => !/__probe__/.test(b)); ok(!realBad.length && errs.filter(e => !/favicon|404|400/.test(e)).length === 0, 'لا أخطاء JS: ' + JSON.stringify(errs.slice(0, 2)) + ' ' + JSON.stringify(realBad) + ' (فحص وجود الدالّة __probe__ متوقَّع)');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
