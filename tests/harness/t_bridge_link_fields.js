// (TASK-0254 · المالك seq 174) «في المزامنه مواصفات … انت اخذ فقط الجدول بس في ايضا اشياء مثل التوافقيات والوصف ما عم تاخذه للمتجر»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const store = () => H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET').then(r => r[0]);
(async () => {
  const { prods } = await H.seed();
  const P = prods[0];
  await H.call('/rest/v1/products?id=eq.' + P.id, { specs: { 'الدقة': '24MP', '__desc': 'كاميرا خفيفة للسفر.\nتصوير 4K.' }, compat: 'Canon RF · Canon EF (بمحوّل)' }, 'PATCH');
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-17T21:08:21.137229+00:00', categories: [{ id: 'c1', name: 'كاميرات', order: 1 }],
    products: [{ id: 'p_1', name: 'منتج متجر للربط', price: 50, barcode: '', images: [], category_id: 'c1', description: 'تصوير 4K.\nشحن مجاني داخل حلب.' }] }]);
  const { browser, pg, errs } = await H.open('bridge.html', { w: 390, h: 844, mobile: true, wait: 5000 });
  await pg.evaluate(() => { try { localStorage.setItem('gmt_storefront_file', 'store.html'); } catch (_) {} window.ensureStorefrontFileAsk = async () => 'store.html'; });
  await pg.evaluate(id => { openLinkModal(id); mlSelect('p_1', 50); mlChoosePrice('inv'); }, P.id);
  await pg.evaluate(() => mlSave()); await pg.waitForTimeout(800);
  const sp = (await store()).products.find(p => p.id === 'p_1');
  ok(Array.isArray(sp.specs) && sp.specs.some(r => r.label === 'الدقة' && r.value === '24MP'), 'الربط ⇐ الجدول: ' + JSON.stringify(sp.specs));
  ok(sp.compat === 'Canon RF · Canon EF (بمحوّل)', 'الربط ⇐ التوافقيات: ' + sp.compat);
  ok(sp.description === 'كاميرا خفيفة للسفر.\nتصوير 4K.\nشحن مجاني داخل حلب.', 'الربط ⇐ الوصف: وصف الجرد أوّلاً ثمّ ما كُتب في المتجر وحده (بلا تكرار): ' + JSON.stringify(sp.description));
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
