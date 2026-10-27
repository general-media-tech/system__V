// (TASK-0200 · المالك seq 133) «جدول مواصفات اللي عم نحط نحن للمنتج لحاله التلقائيا ينتقل الى المتجر»
// كلّ طريقٍ يحفظ المواصفات في الجرد يكتبها لمنتج المتجر المربوط: ① GMTSpecs.pushToStore (رابط المتجر · الباركود · غير مربوط ⇒ لا شيء)
// ② «🧠 مواصفات من علي بابا» لمنتجٍ واحد ③ الإثراء (GMTEnrich.applyOne)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const store = () => H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET').then(r => r[0]);
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    const A = prods[0], B = prods.find(p => p.barcode && String(p.id) !== String(A.id)), C = prods.find(p => String(p.id) !== String(A.id) && String(p.id) !== String((B || {}).id));
    await H.call('/rest/v1/products?id=eq.' + A.id, { store_url: 'https://x/store.html#product=s_a' }, 'PATCH');
    await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-17T21:08:21.137229+00:00', categories: [{ id: 'c1', name: 'كاميرات', order: 1 }],
      products: [{ id: 's_a', name: 'متجر أ', price: 10, images: [], category_id: 'c1', description: 'سطرٌ كتبه المتجر' }, { id: 's_b', name: 'متجر ب', price: 10, barcode: B.barcode, images: [], category_id: 'c1' }, { id: 's_x', name: 'غير مربوط', price: 5, images: [], category_id: 'c1' }] }]);
    const { browser, pg, errs } = await H.open('inventory.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 5000, init: H.ADMIN_INIT });
    // ① مربوطٌ برابط المتجر ⇒ الجدول والماركة والوصف (وصفنا أوّلاً ثمّ ما كتبه المتجر)
    const r1 = await pg.evaluate(id => GMTSpecs.pushToStore({ id }, { specs: { 'البعد البؤري': '50mm', __brand: 'Canon', __desc: 'وصفٌ من الجرد' }, compat: 'EOS R' }), A.id);
    let st = await store(); const sa = st.products.find(p => p.id === 's_a');
    ok(r1 && r1.id === 's_a' && sa.specs.some(x => x.label === 'الماركة' && x.value === 'Canon') && sa.specs.some(x => x.label === 'البعد البؤري') && sa.compat === 'EOS R' && /^وصفٌ من الجرد\nسطرٌ كتبه المتجر$/.test(sa.description),
      W + ': مربوطٌ برابط المتجر ⇒ الجدول والماركة والتوافق والوصف: ' + JSON.stringify({ r1, specs: sa.specs, d: sa.description }));
    // مربوطٌ بالباركود وحده (الجسر يكتب الباركود لمنتج المتجر)
    const r2 = await pg.evaluate(id => GMTSpecs.pushToStore({ id }, { specs: { 'الحربة': 'EF' } }), B.id);
    st = await store();
    ok(r2 && r2.id === 's_b' && st.products.find(p => p.id === 's_b').specs.some(x => x.label === 'الحربة' && x.value === 'EF'), W + ': مربوطٌ بالباركود ⇒ يصل أيضاً');
    const r3 = await pg.evaluate(id => GMTSpecs.pushToStore({ id }, { specs: { 'الوزن': '1kg' } }), C.id);
    st = await store();
    ok(r3 === null && !st.products.find(p => p.id === 's_x').specs, W + ': غير مربوط ⇒ لا شيء يُكتب (null)');
    // ② «🧠 مواصفات من علي بابا» لمنتجٍ واحد ⇒ الجرد والمتجر
    await pg.evaluate(id => { GMTBrain.productImportDialog = (onApply) => onApply({ specs: [{ k: 'القطر', v: '58mm' }], brand: 'Canon', model: 'X1', description_ar: 'وصف العقل', compat: ['EF 50mm'] }); return gmtSpecsFromAlibaba(id); }, A.id);
    await pg.waitForTimeout(900);
    st = await store(); const sa2 = st.products.find(p => p.id === 's_a');
    const toast = await pg.evaluate(() => [...document.querySelectorAll('.toast,#toast,[class*="toast"]')].map(x => x.textContent).join(' | '));
    ok(sa2.specs.some(x => x.label === 'القطر' && x.value === '58mm') && sa2.specs.some(x => x.label === 'الموديل' && x.value === 'X1') && /EF 50mm/.test(sa2.compat), W + ': «🧠 مواصفات» للمنتج ⇒ وصلت للمتجر: ' + JSON.stringify(sa2.specs));
    ok(/في الجرد والمتجر/.test(toast), W + ': الرسالة تقول «في الجرد والمتجر»');
    // ③ الإثراء (اعتماد اقتراح)
    const r4 = await pg.evaluate(id => window.GMTEnrich && GMTEnrich.applyOne ? GMTEnrich.applyOne({ id, specs: { mount: 'RF', fits: 'R5' }, compat: 'EOS R5', search_terms: 'x' }, 'فاحص') : 'no-enrich', B.id);
    st = await store(); const sb = st.products.find(p => p.id === 's_b');
    ok(r4 && r4.ok && r4.store && sb.specs.some(x => x.label === 'الحربة' && x.value === 'RF') && sb.specs.some(x => x.label === 'يركّب على'), W + ': الإثراء ⇒ المتجر: ' + JSON.stringify(sb.specs));
    const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
