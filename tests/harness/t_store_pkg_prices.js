// (TASK-B0418 · المالك seq 727 «الأسعار مي زابطة») بنود الباقة في الطلب/الفاتورة: كلّ سطرٍ بسعرٍ بالسنت ومجموعها = سعر الباقة تماماً
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const st = { categories: [{ id: 'c0', name: 'قسم', order: 0 }], banners: [], offers: [], branches: [], products: [{ id: 'z', name: 'منتج منفرد', price: 79.99, category_id: 'c0', images: [] }] };
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  await H.call('/rest/v1/gmt_offers', { name: 'باقة', offer_type: 'bundle', offer_price: 300, original_price: 525, is_active: true, targets: { store: true, cats: ['c0'] }, products: JSON.stringify([{ id: 'a', name: 'منتج أ', qty: 3, price: 33.33 }, { id: 'b', name: 'منتج ب', qty: 7, price: 7.77 }]) });
  const o = await H.open('logo.jpg', { init: `try{localStorage.clear();localStorage.setItem('gmt_intro_seen_build','x')}catch(e){}`, w: 1366, h: 860, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(5500);
  for (const qty of [1, 2, 3]) {
    const r = await o.pg.evaluate(q => { store.cart = []; const p = store.packages[0]; addPackageToCart(p.id); store.cart[0].qty = q; store.cart.push({ id: 'z', _cartId: 'z', name: 'منتج منفرد', price: 79.99, qty: 1, images: [] });
      const lines = _orderLines(store.cart), cents = lines.reduce((t, x) => t + Math.round(x.price * 100) * x.qty, 0), cart = Math.round(store.cart.reduce((t, i) => t + i.price * i.qty, 0) * 100);
      return { cents, cart, twoDec: lines.every(l => Math.abs(l.price * 100 - Math.round(l.price * 100)) < 1e-9) }; }, qty);
    ok(r.cents === r.cart && r.twoDec, 'باقة × ' + qty + ': مجموع سطور الفاتورة بالسنت = مجموع السلّة (' + r.cents + ' = ' + r.cart + ') وكلّ سعر بخانتين');
  }
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
