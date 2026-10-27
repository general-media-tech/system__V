// (TASK-0197 · المالك seq 133) «اذا كان صورتها في الجرد غير في المتجر فتنتقل للصوره اللي في الجرد للمتجر … تصير بين مجموعه الصور ·
// في الجرد ممكن اكبس عليها او في نقطه البيع تعرض لي باقي الصور»
// ① الجرد: النقر على صورة المنتج ⇒ عارضٌ بكلّ صوره (الجرد + المتجر المربوط) وشارة «🖼️ N صور» ② نقطة البيع: الشيء نفسه
// ③ صورةٌ جديدة في الجرد لمنتجٍ مربوط ⇒ تنضمّ لصور المتجر (بلا تكرار) ④ الجسر: الربط يضمّها · «أضفها كلّها للمتجر»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const store = () => H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET').then(r => r[0]);
async function setup() {
  const { prods } = await H.seed();
  const A = prods[0], B = prods.find(p => p.barcode && String(p.id) !== String(A.id));
  await H.call('/rest/v1/products?id=eq.' + A.id, { store_url: 'https://x/store.html#product=s_a', image_url: 'https://img.example/inv-a.png' }, 'PATCH');
  await H.call('/rest/v1/products?id=eq.' + B.id, { image_url: 'https://img.example/inv-b.png' }, 'PATCH');
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-17T21:08:21.137229+00:00', categories: [{ id: 'c1', name: 'كاميرات', order: 1 }],
    products: [{ id: 's_a', name: 'متجر أ', price: 10, images: ['https://img.example/s1.png', 'https://img.example/s2.png'], category_id: 'c1' },
               { id: 's_b', name: 'متجر ب', price: 10, barcode: B.barcode, images: ['https://img.example/sb.png'], category_id: 'c1' }] }]);
  return { A, B };
}
async function imgRoutes(ctx) { await ctx.route('https://img.example/**', r => r.fulfill({ status: 200, body: PNG, headers: { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' } })); }
(async () => {
  for (const W of [390, 1366]) {
    // ── الجرد ──
    let { A, B } = await setup();
    let o = await H.open('inventory.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 5000, init: H.ADMIN_INIT });
    await imgRoutes(o.ctx);
    await o.pg.evaluate(id => openDetailModal(id), A.id); await o.pg.waitForTimeout(1200);
    const bd = await o.pg.evaluate(() => (document.querySelector('#detail-modal-body .gmt-gal-in .gi-n') || {}).textContent || '');
    ok(bd === '1 من 3', W + ': الجرد: «1 من 3» داخل صورة المنتج (TASK-0208): ' + bd);
    await o.pg.evaluate(() => document.querySelector('#detail-modal-body [data-gal-wrap] img').click()); await o.pg.waitForTimeout(500);
    let g = await o.pg.evaluate(() => { const r = document.getElementById('gmt-gal'); return r && { n: r.querySelector('.gg-n').textContent, th: r.querySelectorAll('.gg-thumbs button').length, src: r.querySelector('.gg-stage img').getAttribute('data-orig-src') || r.querySelector('.gg-stage img').src }; });
    ok(g && g.th === 3 && g.n === '1 من 3' && /inv-a\.png/.test(g.src), W + ': النقر ⇒ عارضٌ بثلاث صور (الجرد أوّلاً ثمّ المتجر): ' + JSON.stringify(g));
    await o.pg.keyboard.press('ArrowLeft'); await o.pg.waitForTimeout(150);
    g = await o.pg.evaluate(() => ({ n: document.querySelector('#gmt-gal .gg-n').textContent, src: document.querySelector('#gmt-gal .gg-stage img').getAttribute('data-orig-src') || document.querySelector('#gmt-gal .gg-stage img').src }));
    ok(g.n === '2 من 3' && /s1\.png/.test(g.src), W + ': السهم ⇒ التالية: ' + JSON.stringify(g));
    await o.pg.keyboard.press('Escape'); await o.pg.waitForTimeout(150);
    ok(!(await o.pg.$('#gmt-gal')), W + ': Esc يغلق العارض');
    // ③ صورةٌ جديدة لمنتجٍ مربوط ⇒ تُضاف لصور المتجر · ومرّةً ثانية لا تتكرّر · وغير المربوط بالرابط يُعرف بالباركود
    await o.pg.evaluate(id => invImageToStore(allProducts.find(p => String(p.id) === String(id)), 'https://img.example/new-a.png'), A.id); await o.pg.waitForTimeout(400);
    await o.pg.evaluate(id => invImageToStore(allProducts.find(p => String(p.id) === String(id)), 'https://img.example/new-a.png'), A.id); await o.pg.waitForTimeout(400);
    let st = await store(); const ia = st.products.find(p => p.id === 's_a').images;
    ok(JSON.stringify(ia) === JSON.stringify(['https://img.example/s1.png', 'https://img.example/s2.png', 'https://img.example/new-a.png']), W + ': صورةٌ جديدة ⇒ آخر صور المتجر (الأولى كما هي · بلا تكرار): ' + JSON.stringify(ia));
    await o.pg.evaluate(id => invImageToStore(allProducts.find(p => String(p.id) === String(id)), 'https://img.example/inv-b.png'), B.id); await o.pg.waitForTimeout(400);
    st = await store();
    ok(st.products.find(p => p.id === 's_b').images.includes('https://img.example/inv-b.png'), W + ': المربوط بالباركود ⇒ يصل أيضاً');
    ok(!o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e)).length, W + ': الجرد: لا أخطاء JS ' + o.errs.slice(0, 2).join(' / '));
    await o.browser.close();
    // ── نقطة البيع ──
    ({ A } = await setup());
    o = await H.open('pos.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 7000, init: H.STAFF_INIT });
    await imgRoutes(o.ctx);
    const opened = await o.pg.evaluate(id => { if (typeof openProductDetail !== 'function') return 'no-fn'; openProductDetail(id); return !!document.querySelector('#pd-content [data-gal-wrap] img'); }, A.id);
    await o.pg.waitForTimeout(1200);
    const pb = await o.pg.evaluate(() => (document.querySelector('#pd-content .gmt-gal-in .gi-n') || {}).textContent || '');
    if (opened === true) await o.pg.evaluate(() => document.querySelector('#pd-content [data-gal-wrap] img').click());
    await o.pg.waitForTimeout(600);
    const pg2 = await o.pg.evaluate(() => { const r = document.getElementById('gmt-gal'); return r ? r.querySelectorAll('.gg-thumbs button').length : 0; });
    ok(opened === true && pb === '1 من 3' && pg2 === 3, W + ': نقطة البيع: تفاصيل المنتج ⇒ «1 من 3» داخل الصورة والنقر ⇒ العارض بثلاث: ' + JSON.stringify({ opened, pb, pg2 }));
    ok(!o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e)).length, W + ': نقطة البيع: لا أخطاء JS ' + o.errs.slice(0, 2).join(' / '));
    await o.browser.close();
    // ── الجسر ──
    ({ A, B } = await setup());
    await H.call('/rest/v1/gmt_store?id=eq.1', { products: [{ id: 's_a', name: 'متجر أ', price: 10, barcode: '', images: ['https://img.example/s1.png'], category_id: 'c1' }, { id: 's_b', name: 'متجر ب', price: 10, barcode: B.barcode, images: [], category_id: 'c1' }] }, 'PATCH');
    o = await H.open('bridge.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 5000 });
    const diffs = await o.pg.evaluate(() => getImgDiffs().length);
    await o.pg.evaluate(() => { switchTab && switchTab(3); }).catch(() => {});
    await o.pg.evaluate(() => addAllImgsToStore()); await o.pg.waitForTimeout(600);
    st = await store();
    ok(diffs >= 1 && st.products.find(p => p.id === 's_b').images.includes('https://img.example/inv-b.png'), W + ': الجسر «📸 أضفها كلّها للمتجر» ⇒ صورة الجرد في صور المتجر (' + diffs + ' ناقصة قبلها)');
    const left = await o.pg.evaluate(() => getImgDiffs().length);
    ok(left < diffs, W + ': بعدها تنقص قائمة «صور الجرد غير الموجودة»: ' + diffs + ' ⇒ ' + left);
    ok(!o.errs.filter(e => !/status of (400|401|404|503)/.test(e)).length, W + ': الجسر: لا أخطاء JS ' + o.errs.slice(0, 2).join(' / '));
    await o.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
