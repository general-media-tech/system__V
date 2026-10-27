// (TASK-0198 · المالك seq 133) أدمن المتجر: «ادمج منتجين يعني منتج مكرر مرتين ولكن فيه اكثر من صوره واكثر منصف فاعمل له دمج»
// اقتراح المكرّر (الاسم نفسه · الباركود نفسه) · الصور كلّها بلا تكرار (وتختار ما يبقى) · كلّ حقلٍ مختلف تختاره · الأقسام والمواصفات تُجمع ·
// (ب) يُحذف · روابط الجرد إلى (ب) تصير (أ) · بلا تأكيد ⇒ لا شيء
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const store = () => H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET').then(r => r[0]);
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    const P = prods[0];
    await H.call('/rest/v1/products?id=eq.' + P.id, { store_url: 'https://x/store.html#product=p_b' }, 'PATCH');
    await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-17T21:08:21.137229+00:00', categories: [{ id: 'c1', name: 'عدسات', order: 1 }, { id: 'c2', name: 'كانون', order: 2 }],
      products: [
        { id: 'p_a', name: 'عدسة كانون 50mm', price: 100, images: ['https://img.example/a1.png', 'https://img.example/a2.png'], description: 'وصف أ', category_id: 'c1', category_ids: ['c1'], specs: [{ label: 'الحربة', value: 'EF' }], order: 1 },
        { id: 'p_b', name: 'عدسة كانون  50mm', price: 90, images: ['https://img.example/a2.png', 'https://img.example/b1.png'], description: 'وصف ب', category_id: 'c2', category_ids: ['c2'], specs: [{ label: 'الحربة', value: 'EF' }, { label: 'الوزن', value: '160 غ' }], barcode: 'BC9', compat: 'EOS R', order: 2 },
        { id: 'p_c', name: 'منتجٌ آخر', price: 5, images: [], category_id: 'c1', order: 3 }] }]);
    const { browser, ctx, pg, errs } = await H.open('admin_store.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 5000 });
    await ctx.route('https://img.example/**', r => r.fulfill({ status: 200, body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'), headers: { 'Content-Type': 'image/png' } }));
    const btn = await pg.evaluate(() => { if (typeof renderCatalogAdmin === 'function') renderCatalogAdmin(); return !!document.querySelector('[data-merge-btn]'); });
    ok(btn, W + ': زرّ «🔗 دمج منتجين مكرّرين» في قائمة المنتجات');
    await pg.evaluate(() => openMergeProducts());
    const sug = await pg.evaluate(() => [...document.querySelectorAll('#merge-modal [data-mg-pair]')].map(b => b.getAttribute('data-mg-pair') + ' ' + b.textContent.replace(/\s+/g, ' ')));
    ok(sug.length === 1 && /p_a\|p_b/.test(sug[0]) && /الاسم نفسه/.test(sug[0]), W + ': «يبدو مكرّراً» يقترح الزوج (الاسم نفسه بعد التطبيع): ' + JSON.stringify(sug));
    await pg.click('#merge-modal [data-mg-pair]'); await pg.waitForTimeout(300);
    const v = await pg.evaluate(() => ({ imgs: document.querySelectorAll('#merge-modal [data-mg-img]').length, rows: [...document.querySelectorAll('#merge-modal tbody th')].map(t => t.textContent), go: document.querySelector('#merge-modal [data-mg-go]').disabled, txt: document.querySelector('#merge-modal [data-mg-body]').textContent }));
    ok(v.imgs === 3 && !v.go && ['الاسم', 'السعر', 'الباركود', 'الوصف'].every(k => v.rows.includes(k)) && /الأقسام بعد الدمج: 2/.test(v.txt) && /المواصفات: 2/.test(v.txt), W + ': ٣ صور بلا تكرار · الحقول المختلفة للاختيار · الأقسام ٢ · المواصفات ٢: ' + JSON.stringify(v.rows));
    // الاختيارات: سعر (ب) · الوصف «الاثنان» · نزع صورة a2 · ثمّ «تراجع» في التأكيد ⇒ لا شيء
    await pg.evaluate(() => { document.querySelector('#merge-modal input[name="mg-price"][value="b"]').checked = true; document.querySelector('#merge-modal input[name="mg-description"][value="ab"]').checked = true;
      document.querySelector('#merge-modal [data-mg-img="1"]').checked = false; window.__ask = 0; GMTAsk.confirm = async () => { __ask++; return false; }; document.querySelector('#merge-modal [data-mg-go]').click(); });
    await pg.waitForTimeout(500);
    let st = await store();
    ok(st.products.length === 3 && await pg.evaluate(() => __ask === 1 && !!document.getElementById('merge-modal')), W + ': «تراجع» في التأكيد ⇒ لا تغيير');
    await pg.evaluate(() => { GMTAsk.confirm = async () => true; document.querySelector('#merge-modal [data-mg-go]').click(); });
    await pg.waitForTimeout(1200);
    st = await store(); const a = st.products.find(p => p.id === 'p_a');
    ok(st.products.length === 2 && !st.products.find(p => p.id === 'p_b'), W + ': (ب) حُذف من المتجر');
    ok(a && a.price === 90 && JSON.stringify(a.images) === JSON.stringify(['https://img.example/a1.png', 'https://img.example/b1.png']) && a.description === 'وصف أ\n\nوصف ب' && a.barcode === 'BC9' && a.name === 'عدسة كانون 50mm',
      W + ': (أ) بالسعر المختار · الصور المختارة · الوصفان · الباركود من (ب) · الاسم (أ): ' + JSON.stringify(a && { price: a.price, images: a.images, d: a.description, bc: a.barcode, n: a.name }));
    ok(a && JSON.stringify(a.category_ids) === JSON.stringify(['c1', 'c2']) && a.specs.length === 2 && a.compat === 'EOS R', W + ': الأقسام والمواصفات والتوافق مجموعة: ' + JSON.stringify(a && { c: a.category_ids, s: a.specs, compat: a.compat }));
    const [iv] = await H.call('/rest/v1/products?id=eq.' + P.id + '&select=store_url', undefined, 'GET');
    ok(/#product=p_a$/.test(iv.store_url), W + ': رابط منتج الجرد صار (أ): ' + iv.store_url);
    ok(!(await pg.$('#merge-modal')), W + ': النافذة أُغلقت بعد الدمج');
    const hs = await pg.evaluate(() => { openMergeProducts('p_a', 'p_c'); return document.documentElement.scrollWidth > innerWidth + 1; });
    ok(!hs, W + ': لا طفح أفقي');
    if (W === 390) await pg.screenshot({ path: '/tmp/gmt-out/store_merge_390.png' });
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
