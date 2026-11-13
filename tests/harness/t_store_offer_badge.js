// (TASK-0371 · المالك seq 653) «الأشياء اللي عليها عرض بيطلع علامة عرض وسعر مشطوب ومغيَّر»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const VISITOR = `try{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
const day = 864e5, iso = d => new Date(Date.now() + d).toISOString();
const store = { categories: [{ id: 'c0', name: 'قسم', order: 0 }], banners: [], offers: [], branches: [], products: [
  { id: 'o_1', inv_id: 'inv-1', name: 'منتج بعرض مؤقّت', price: 34.99, category_id: 'c0', images: [] },
  { id: 'o_2', inv_id: 'inv-2', name: 'منتج بسعر قديم', price: 15, old_price: 20, category_id: 'c0', images: [] },
  { id: 'o_3', inv_id: 'inv-3', name: 'منتج عرضه انتهى', price: 9.99, category_id: 'c0', images: [] },
  { id: 'o_4', inv_id: 'inv-4', name: 'منتج بلا عرض', price: 50, category_id: 'c0', images: [] },
  { id: 'o_5', inv_id: 'inv-5', name: 'عرضٌ أُرجع سعره', price: 60, category_id: 'c0', images: [] }] };
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-13T10:00:00Z', ...store }]);
  await H.call('/rest/v1/gmt_price_changes', [
    { product_id: 'inv-1', product_name: 'أ', old_price: 45, new_price: 35, ends_at: iso(2 * day), reverted_at: null },
    { product_id: 'inv-3', product_name: 'ج', old_price: 15, new_price: 10, ends_at: iso(-day), reverted_at: null },
    { product_id: 'inv-5', product_name: 'هـ', old_price: 80, new_price: 60, ends_at: iso(2 * day), reverted_at: iso(-3600e3) }]);
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 }); const pg = o.pg;
  await o.ctx.route(/\/storage\/v1\/object\/public\/products-images\/store\/home\.json/, r => r.fulfill({ status: 404, body: '' }));
  await pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(7000);
  const cards = await pg.evaluate(() => { const out = {}; document.querySelectorAll('[data-category-section] .min-w-\\[160px\\]').forEach(c => { const n = c.querySelector('h4').textContent.trim(); out[n] = { badge: (c.querySelector('.pc-offer') || {}).textContent || '', old: (c.querySelector('.pc-old') || {}).textContent || '', text: c.innerText.replace(/\s+/g, ' ') }; }); return out; });
  const A = cards['منتج بعرض مؤقّت'] || {}, B = cards['منتج بسعر قديم'] || {}, C = cards['منتج عرضه انتهى'] || {}, D = cards['منتج بلا عرض'] || {}, E = cards['عرضٌ أُرجع سعره'] || {};
  ok(A.badge === 'عرض −22%' && A.old === '$45.00' && /\$34\.99/.test(A.text), 'تخفيض مؤقّت سارٍ من الجرد ⇒ علامة «عرض −22%» والسعر القديم 45 مشطوباً بجانب الجديد: ' + JSON.stringify(A));
  ok(B.badge === 'عرض −25%' && B.old === '$20.00', 'منتج له سعر قديم أعلى ⇒ العلامة والسعر المشطوب: ' + B.badge + ' · ' + B.old);
  ok(!C.badge && !C.old, 'عرضٌ انتهت مدّته ⇒ لا علامة');
  ok(!E.badge && !E.old, 'عرضٌ أُرجع سعره ⇒ لا علامة');
  ok(!D.badge && !D.old && /\$49\.99/.test(D.text), 'منتج بلا عرض كما هو (49.99)');
  await pg.evaluate(() => openProductModal('o_1')); await pg.waitForTimeout(1200);
  ok(await pg.evaluate(() => { const e = document.getElementById('pm-oldprice'); return !!e && e.textContent === '$45.00' && getComputedStyle(e).display !== 'none' && getComputedStyle(e).textDecorationLine.indexOf('line-through') >= 0; }), 'صفحة المنتج: السعر القديم مشطوباً بجانب السعر');
  await pg.evaluate(() => { closeModal('product-modal'); openProductModal('o_4'); }); await pg.waitForTimeout(900);
  ok(await pg.evaluate(() => getComputedStyle(document.getElementById('pm-oldprice')).display === 'none'), 'صفحة منتج بلا عرض: لا سعر مشطوب');
  const real = o.errs.filter(x => !/status of (400|401|404|406|503)|Failed to load resource/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
