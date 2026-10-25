// (25 ت1 · TASK-0162) المالك seq 54: «هذا الجدول [من علي بابا] عم يجيبه ولكن ما في له مكان في تفاصيل المنتج — لازم يكون موجود في المتجر
// وفي الجرد وفي تفاصيل المنتج». + seq 73 «الجسر»: أدمن المتجر لا يمحو ما أضافه الجسر ولا جدول المواصفات عند تعديل منتج.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const store = () => H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET').then(r => r[0]);
const SPECS = { 'الأبعاد': '15×17 سم', 'النوع': 'سوفت بوكس فلاش', mount: 'EF', __desc: 'دفيوزر صغير لفلاش الكاميرا.', __brand: 'Godox', __model: 'SB-1517' };
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    const p0 = prods[0], p1 = prods[1];
    await H.call('/rest/v1/products?id=eq.' + p0.id, { specs: SPECS, compat: 'Canon 600EX · Godox V860', specs_source: 'alibaba', specs_checked_at: '2026-10-25T10:00:00Z', specs_checked_by: 'فاحص' }, 'PATCH');
    await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-17T21:08:21.137229+00:00', categories: [{ id: 'c1', name: 'إضاءة', order: 1 }],
      products: [{ id: 'p_old', name: 'منتج قديم', price: 10, images: [], category_id: 'c1', specs: [{ label: 'اللون', value: 'أسود' }] }] }]);
    const mob = W < 500, size = { w: W, h: mob ? 844 : 900, mobile: mob };

    // ١) الجرد: «تفاصيل المنتج» فيها الوصف والماركة والجدول والتوافق — ومنتجٌ بلا مواصفات يقول من أين تُجلب
    let o = await H.open('inventory.html', Object.assign({ wait: 5000 }, size));
    const inv = await o.pg.evaluate(([a, b]) => { const box = () => (document.querySelector('#detail-modal-body [data-specs-box]') || {}).innerText || '';
      openDetailModal(a); const t1 = box(); closeModal('detail-modal'); openDetailModal(b); const t2 = box(); return { t1, t2,
        over: document.documentElement.scrollWidth > innerWidth + 1 }; }, [p0.id, p1.id]);
    ok(/دفيوزر صغير/.test(inv.t1) && /الأبعاد/.test(inv.t1) && /15×17/.test(inv.t1) && /الماركة/.test(inv.t1) && /Godox/.test(inv.t1) && /الحربة/.test(inv.t1) && /متوافق مع/.test(inv.t1),
      W + ': الجرد ⇐ تفاصيل المنتج: الوصف والجدول والماركة والتوافق: ' + inv.t1.replace(/\s+/g, ' ').slice(0, 90));
    ok(/لا مواصفات محفوظة بعد/.test(inv.t2), W + ': منتجٌ بلا مواصفات ⇐ يقول من أين تُجلب');
    ok(!inv.over, W + ': لا تمرير أفقي في تفاصيل المنتج');
    if (mob) await o.pg.screenshot({ path: '/tmp/gmt-out/specs_inv_' + W + '.png' });
    await o.browser.close();

    // ٢) الجسر: «أنشئ في المتجر» يحمل الجدول (والوصف وحده لا يكرّره)
    o = await H.open('bridge.html', Object.assign({ wait: 5000 }, size));
    await o.pg.evaluate(id => { openCreateModal(id); document.getElementById('mc-cat').value = 'c1'; return mcSave(); }, p0.id);
    let st = await store();
    const np = st.products.find(x => String(x.inv_id) === String(p0.id)) || {};
    ok(Array.isArray(np.specs) && np.specs.some(r => r.label === 'الماركة' && r.value === 'Godox') && np.specs.some(r => r.label === 'الأبعاد') && np.description === 'دفيوزر صغير لفلاش الكاميرا.' && /600EX/.test(np.compat || ''),
      W + ': الجسر ⇐ منتج المتجر يحمل الجدول والوصف والتوافق: ' + JSON.stringify(np.specs).slice(0, 90));
    await o.browser.close();

    // ٣) المتجر: صفحة المنتج تعرض «المواصفات»
    o = await H.open('store.html', Object.assign({ wait: 5000, init: '' }, size));
    const sv = await o.pg.evaluate(id => { openProductModal(id); const el = document.getElementById('product-modal-specs'); return { shown: el && !el.classList.contains('hidden'), t: el ? el.innerText : '', over: document.documentElement.scrollWidth > innerWidth + 1 }; }, np.id);
    ok(sv.shown && /الأبعاد/.test(sv.t) && /Godox/.test(sv.t) && /متوافق مع/.test(sv.t), W + ': المتجر ⇐ صفحة المنتج فيها جدول المواصفات: ' + sv.t.replace(/\s+/g, ' ').slice(0, 80));
    ok(!sv.over, W + ': لا تمرير أفقي في صفحة المنتج بالمتجر');
    if (mob) await o.pg.screenshot({ path: '/tmp/gmt-out/specs_store_' + W + '.png' });
    await o.browser.close();

    // ٤) أدمن المتجر: فُتح ثمّ أضاف الجسر منتجاً ⇒ تعديل منتجٍ هنا لا يمحوه، ولا يمحو جدول مواصفات المنتج المعدَّل
    o = await H.open('admin_store.html', Object.assign({ wait: 5000 }, size));
    const s0 = await store();
    await H.call('/rest/v1/gmt_store?id=eq.1', { products: s0.products.concat([{ id: 'p_bridge', name: 'أضافه الجسر الآن', price: 5, images: [], category_id: 'c1' }]) }, 'PATCH');
    const ed = await o.pg.evaluate(async () => { if (typeof openProdModal !== 'function') return 'no-modal';
      openProdModal('p_old'); document.getElementById('prod-name').value = 'منتج قديم (معدَّل)'; await saveProduct(); return 'ok'; });
    st = await store();
    const old = st.products.find(x => x.id === 'p_old') || {};
    ok(ed === 'ok' && old.name === 'منتج قديم (معدَّل)' && Array.isArray(old.specs) && old.specs[0].value === 'أسود', W + ': أدمن المتجر ⇐ التعديل حُفظ وجدول المواصفات باقٍ: ' + JSON.stringify({ ed, name: old.name, specs: old.specs }));
    ok(st.products.some(x => x.id === 'p_bridge') && st.products.some(x => String(x.inv_id) === String(p0.id)), W + ': أدمن المتجر لا يمحو ما أضافه الجسر بعد فتحه: ' + st.products.map(x => x.name).join('، '));
    const real = o.errs.filter(e => !/status of (400|401|404|406|503)/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await o.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
