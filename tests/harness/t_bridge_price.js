// (TASK-0199 · المالك seq 133) الجسر: «لما انقل لا اختار سعر الجرد ولا اختار سعر المتجر وانما اختار سعر جديد اكتبه»
// ① نافذة الربط: «✏️ سعر جديد» ⇒ يُطبَّق على الجرد والمتجر معاً ② نافذة مزامنة السعر: «اعتمده للاثنين»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const store = () => H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET').then(r => r[0]);
const inv = id => H.call('/rest/v1/products?id=eq.' + id + '&select=price,store_url', undefined, 'GET').then(r => r[0]);
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-17T21:08:21.137229+00:00', categories: [{ id: 'c1', name: 'كاميرات', order: 1 }],
      products: [{ id: 'p_1', name: 'منتج متجر للربط', price: 50, barcode: '', images: [], category_id: 'c1' }, { id: 7, name: 'منتج متجر برقم', price: 30, barcode: 'BC0003', images: [], category_id: 'c1' }] }]);
    const { browser, pg, errs } = await H.open('bridge.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 5000 });
    await pg.evaluate(() => { try { localStorage.setItem('gmt_storefront_file', 'store.html'); } catch (_) {} window.ensureStorefrontFileAsk = async () => 'store.html'; });
    // ١) الربط: سعر الجرد ≠ سعر المتجر ⇒ يظهر «سعر جديد» · كتابته تفعّل الحفظ · الحفظ يطبّقه على الاثنين
    const P = prods.find(p => p.barcode) || prods[0];
    const s0 = await pg.evaluate(id => { openLinkModal(id); mlSelect('p_1', 50); const sec = document.getElementById('ml-price-section'); return { shown: !sec.classList.contains('hidden'), custom: !!document.getElementById('ml-custom-price'), save: document.getElementById('ml-save-btn').disabled }; }, P.id);
    ok(s0.shown && s0.custom && s0.save, W + ': نافذة الربط: الخيارات الثلاثة (الجرد · المتجر · ✏️ سعر جديد) والحفظ معطّل قبل الاختيار: ' + JSON.stringify(s0));
    await pg.fill('#ml-custom-price', '123.456');
    const s1 = await pg.evaluate(() => ({ save: document.getElementById('ml-save-btn').disabled, chosen: document.getElementById('ml-price-chosen').textContent }));
    ok(!s1.save && /\$123\.46 على الجرد والمتجر/.test(s1.chosen), W + ': كتابة السعر الجديد تفعّل الحفظ: «' + s1.chosen + '»');
    await pg.evaluate(() => mlSave()); await pg.waitForTimeout(600);
    const st1 = await store(), iv1 = await inv(P.id);
    ok(Number((st1.products.find(p => p.id === 'p_1') || {}).price) === 123.46 && Number(iv1.price) === 123.46, W + ': الربط بالسعر الجديد ⇒ المتجر $' + (st1.products.find(p => p.id === 'p_1') || {}).price + ' · الجرد $' + iv1.price);
    // اختيار «سعر الجرد» بعد كتابة سعرٍ جديد ⇒ يُمسح الجديد (لا يُطبَّق خفيةً)
    const P2 = prods.find(p => p.barcode && String(p.id) !== String(P.id));
    const s2 = await pg.evaluate(id => { openLinkModal(id); mlSelect('7', 30); const i = document.getElementById('ml-custom-price'); i.value = '77'; mlCustomPrice(); mlChoosePrice('inv'); return { v: i.value, choice: mlPriceChoice, chosen: document.getElementById('ml-price-chosen').textContent }; }, P2.id);
    ok(s2.v === '' && s2.choice === 'inv' && /سعر الجرد/.test(s2.chosen), W + ': «سعر الجرد» بعد كتابة سعرٍ جديد ⇒ الجديد يُمسح: ' + JSON.stringify(s2));
    await pg.evaluate(() => closeModal('modal-link'));
    // ٢) مزامنة السعر: «اعتمده للاثنين»
    const P3 = prods[3];
    await pg.evaluate(id => { openSyncModal(id, '7'); document.getElementById('ms-custom-price').value = '88.5'; return msSyncPrice('custom'); }, P3.id);
    await pg.waitForTimeout(400);
    const st3 = await store(), iv3 = await inv(P3.id);
    ok(Number((st3.products.find(p => String(p.id) === '7') || {}).price) === 88.5 && Number(iv3.price) === 88.5, W + ': مزامنة السعر «اعتمده للاثنين» ⇒ المتجر والجرد $88.5');
    const r4 = await pg.evaluate(id => { openSyncModal(id, '7'); document.getElementById('ms-custom-price').value = ''; return msSyncPrice('custom').then(() => (document.getElementById('toast') || document.querySelector('.toast') || {}).textContent || ''); }, P3.id);
    ok(/اكتب السعر الجديد/.test(r4), W + ': بلا سعر ⇒ «اكتب السعر الجديد» ولا كتابة');
    const hs = await pg.evaluate(() => { openSyncModal(invProds[0].id, '7'); return document.documentElement.scrollWidth > innerWidth + 1; });
    ok(!hs, W + ': لا طفح أفقي');
    ok(!errs.filter(e => !/status of (400|401|404|503)/.test(e)).length, W + ': لا أخطاء JS ' + errs.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
