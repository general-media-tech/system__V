// (TASK-0297 · المالك seq 313، رسالة ٣١ ت١ ١٠:٤٤م) «ترتيب الصور … بعد له في احد الفلاتر — اللي مكرره نفسها — بيتعدل على الكل سواء في المتجر او في الجرد»
// حفظ صور منتجٍ (حذف/ترتيب) ⇒ كلّ منتج يشاركه مجموعة الصور نفسها يأخذها · وقائمته في المتجر: الجديد أوّلاً + ما زاد في المتجر وحده يبقى · غير المشارِك لا يُمسّ
const H = require('./h.js');
let pass = 0, fails = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
const U = n => 'https://example.com/f' + n + '.jpg';
(async () => {
  await H.seed();
  const S = 'https://general-media-tech.github.io/system__V/store.html#product=';
  const fam = [U(1), U(2), U(3), U(4)];
  const ins = await H.call('/rest/v1/products', [43, 49, 58].map((d, i) => ({ name: 'فلتر UV قطر ' + d + 'mm', barcode: 'UV' + d, price: 10, haleb: 2, image_url: fam[0], images: i === 2 ? [fam[2], fam[0], fam[3], fam[1]] : fam, store_url: S + 'p_uv' + d }))
    .concat([{ name: 'فلتر CPL قطر 58mm', barcode: 'CPL58', price: 10, haleb: 1, image_url: U(1), images: [U(1), U(2)], store_url: S + 'p_cpl' }]));
  await H.call('/rest/v1/gmt_store', { id: 1, updated_at: '2026-11-01T00:00:00Z', products: [
    { id: 'p_uv43', name: 'UV 43', images: fam }, { id: 'p_uv49', name: 'UV 49', images: fam.concat([U(9)]) }, { id: 'p_uv58', name: 'UV 58', images: fam }, { id: 'p_cpl', name: 'CPL', images: [U(1), U(2)] }] });
  const { browser, pg, errs } = await H.open('inventory.html', { w: 1366, h: 900, wait: 5000, mobile: false });
  const r = await pg.evaluate(async (U4) => {
    const p = allProducts.find(x => x.name === 'فلتر UV قطر 43mm'); if (!p || !window.invShareImages) return { err: 'no fn/product ' + !!p };
    const old = _imgsOf(p), neu = [U4[3], U4[1]];               // حذفُ صورتين وترتيبٌ جديد
    const n = await invShareImages(p, old, neu);
    return { n };
  }, [U(1), U(2), U(3), U(4)]);
  ok(r.n === 2, 'طُبّقت على المنتجَين المشاركَين (حتى بترتيبٍ مختلف): ' + JSON.stringify(r));
  const rows = await H.call('/rest/v1/products?select=name,image_url,images&order=name.asc', undefined, 'GET');
  const by = n => rows.find(x => x.name === n) || {};
  ok(JSON.stringify(by('فلتر UV قطر 49mm').images) === JSON.stringify([U(4), U(2)]) && by('فلتر UV قطر 49mm').image_url === U(4), 'UV 49 في الجرد: الصور والترتيب الجديدان + الأساسية');
  ok(JSON.stringify(by('فلتر UV قطر 58mm').images) === JSON.stringify([U(4), U(2)]), 'UV 58 (كان بترتيبٍ آخر للمجموعة نفسها) أخذها أيضاً');
  ok(JSON.stringify(by('فلتر CPL قطر 58mm').images) === JSON.stringify([U(1), U(2)]), 'CPL (مجموعة صورٍ مختلفة) لم يُمسّ');
  const st = (await H.call('/rest/v1/gmt_store?id=eq.1&select=products', undefined, 'GET'))[0].products;
  const sp = id => (st.find(x => x.id === id) || {}).images;
  ok(JSON.stringify(sp('p_uv49')) === JSON.stringify([U(4), U(2), U(9)]), 'المتجر UV 49: الجديد أوّلاً + صورة المتجر الإضافية تبقى: ' + JSON.stringify(sp('p_uv49')));
  ok(JSON.stringify(sp('p_uv58')) === JSON.stringify([U(4), U(2)]), 'المتجر UV 58: الصور الجديدة بترتيبها');
  ok(JSON.stringify(sp('p_uv43')) === JSON.stringify(fam), 'قائمة المنتج نفسه لا تُمسّ هنا (تحفظها صفحة التعديل)');
  ok(JSON.stringify(sp('p_cpl')) === JSON.stringify([U(1), U(2)]), 'المتجر CPL لم يُمسّ');
  const r2 = await pg.evaluate(async () => { const p = allProducts.find(x => x.name === 'فلتر CPL قطر 58mm'); return invShareImages(p, [_imgsOf(p)[0]], ['https://example.com/x.jpg']); });
  ok(r2 === 0, 'صورةٌ واحدة فقط ⇒ لا تُعمَّم (المشاركة تُحسب بصورتين فأكثر)');
  ok(!errs.filter(e => !/favicon|example\.com|ERR_|Failed to load resource/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.slice(0, 3)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
