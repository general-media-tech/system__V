// (TASK-0298 · المالك seq 315) «الفلاتر والأغطية والكفرات: إذا غيّرت فيهم ترتيب أو أضفت عليهم صورة تنضاف للكل حتى في الجرد ليس فقط في المتجر ·
// الأغطية والفلاتر حسب الأقطار يختلف السعر — عوامل التصفية بتغيّر السعر لما يحدّد الشخص»
const H = require('./h.js');
let pass = 0, fails = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
const U = n => 'https://example.com/c' + n + '.jpg';
(async () => {
  await H.seed();
  const S = 'https://general-media-tech.github.io/system__V/store.html#product=p_caps';
  const caps = await H.call('/rest/v1/products', [
    { name: 'غطاء عدسة 49mm', barcode: 'CAP49', price: 5, haleb: 3, image_url: U(1), images: [U(1), U(2)], store_url: S },
    { name: 'غطاء عدسة 58mm', barcode: 'CAP58', price: 5, haleb: 3, image_url: U(2), images: [U(2), U(1), U(7)], store_url: S },   // ترتيبٌ آخر + صورة خاصّة به
    { name: 'غطاء عدسة 77mm', barcode: 'CAP77', price: 6, haleb: 1, image_url: U(1), images: [U(1), U(2)], store_url: S },
    { name: 'حقيبة درون Avata', barcode: 'BAG1', price: 0, image_url: U(50), images: [U(50)], store_url: 'https://x/store.html#product=p_bags' }]);
  const id = n => (caps.find(x => x.name.indexOf(n) !== -1) || {}).id;
  await H.call('/rest/v1/gmt_store', { id: 1, updated_at: '2026-11-01T00:00:00Z', products: [
    { id: 'p_caps', name: 'أغطية عدسات أقطار متعددة', price: 5, images: [U(1), U(2)], options: [{ type: 'القطر', values: [{ name: '49mm', inv_id: id('49') }, { name: '58mm', inv_id: id('58') }, { name: '77mm', inv_id: id('77') }] }] },
    { id: 'p_bags', name: 'حقائب', price: 0, images: [U(50), U(51)], options: [{ type: 'الدرون', values: [{ name: 'Avata', inv_id: id('Avata') }] }] }] });
  const { browser, pg, errs } = await H.open('inventory.html', { w: 1366, h: 900, wait: 5000, mobile: false });
  /* ① من الجرد: أضفتُ صورة لغطاء 49 ورتّبتُ ⇒ كلّ الأقطار + قائمة العائلة */
  const n1 = await pg.evaluate(async (u) => { const p = allProducts.find(x => x.name === 'غطاء عدسة 49mm'); return invShareImages(p, _imgsOf(p), [u[2], u[1], u[0]]); }, [U(1), U(2), U(3)]);
  let rows = await H.call('/rest/v1/products?select=name,images&order=name.asc', undefined, 'GET');
  const im = n => JSON.stringify((rows.find(x => x.name === n) || {}).images);
  ok(n1 === 2, 'الإضافة + الترتيب وصلت لقطرين آخرين في الجرد: ' + n1);
  ok(im('غطاء عدسة 77mm') === JSON.stringify([U(3), U(2), U(1)]), '77mm: الصورة الجديدة والترتيب');
  ok(im('غطاء عدسة 58mm') === JSON.stringify([U(3), U(2), U(1), U(7)]), '58mm (كان بترتيبٍ آخر): أخذ الترتيب وبقيت صورته الخاصّة بعدها');
  let st = (await H.call('/rest/v1/gmt_store?id=eq.1&select=products', undefined, 'GET'))[0].products;
  ok(JSON.stringify(st.find(x => x.id === 'p_caps').images) === JSON.stringify([U(3), U(2), U(1)]), 'قائمة العائلة في المتجر أخذت الصورة والترتيب');
  /* ② من المتجر (أدمن المتجر / صفحة التعديل): حذفُ صورة وترتيب في القائمة ⇒ منتجات الجرد */
  const n2 = await pg.evaluate(async (u) => { const sp = { id: 'p_caps', name: 'أغطية', images: [u[2], u[1], u[0]], options: [{ values: [{ inv_id: '' }] }] };
    const r = await fetch(GMT_DB.STORE.url + '/rest/v1/gmt_store?id=eq.1&select=products', { headers: { apikey: GMT_DB.STORE.key } }); const list = (await r.json())[0].products, old = list.find(x => x.id === 'p_caps');
    return GMTStoreSync.listingImagesToInv(old, Object.assign({}, old, { images: [u[0], u[2]] })); }, [U(1), U(2), U(3)]);
  rows = await H.call('/rest/v1/products?select=name,images&order=name.asc', undefined, 'GET');
  ok(n2 === 3, 'تغيير صور القائمة وصل لكل الأقطار الثلاثة في الجرد: ' + n2);
  ok(im('غطاء عدسة 49mm') === JSON.stringify([U(1), U(3)]) && im('غطاء عدسة 58mm') === JSON.stringify([U(1), U(3), U(7)]), 'الحذف والترتيب في الجرد (والصورة الخاصّة بـ58mm باقية)');
  ok(im('حقيبة درون Avata') === JSON.stringify([U(50)]), 'عائلةٌ أخرى (الحقائب) لم تُمسّ');
  /* ③ السعر: قطرٌ بسعرٍ مختلف ⇒ سعر قيمته · الخيار يغيّر السعر · سعر القائمة = الأقلّ */
  const r3 = await pg.evaluate(async (cid) => GMTStoreSync.setValueFields(cid, { price: 9 }), id('77'));
  await pg.evaluate(async (cid) => GMTStoreSync.setValueFields(cid, { price: 4 }), id('49'));
  st = (await H.call('/rest/v1/gmt_store?id=eq.1&select=products', undefined, 'GET'))[0].products;
  const fam = st.find(x => x.id === 'p_caps'), o = fam.options[0], vp = n => (o.values.find(v => v.name === n) || {}).price;
  ok(r3 && r3.changed && o.affectsPrice === true, 'خيار القطر صار يغيّر السعر عند الاختيار');
  ok(vp('77mm') === 9 && vp('49mm') === 4 && vp('58mm') == null, 'سعر كلّ قطر لقيمته وحدها: 77=9 · 49=4');
  ok(Number(fam.price) === 4, 'سعر القائمة الظاهر = أقلّ سعر (يبدأ من): ' + fam.price);
  const r4 = await pg.evaluate(async () => GMTStoreSync.setValueFields('no-such-id', { price: 3 }));
  ok(r4 && !r4.changed, 'منتجٌ ليس في عائلة ⇒ لا شيء يتغيّر');
  /* ④ المتجر يعرض السعر حسب القطر */
  await browser.close();
  const s2 = await H.open('store.html', { w: 390, h: 844, wait: 3500 });
  const shown = await s2.pg.evaluate(async () => { try { openProductModal('p_caps'); } catch (e) { return 'ERR ' + e.message; } await new Promise(r => setTimeout(r, 800));
    const btn = [...document.querySelectorAll('button')].find(b => /^77mm/.test(b.textContent.trim())); if (!btn) return 'no btn'; btn.click(); await new Promise(r => setTimeout(r, 200));
    return { label: btn.textContent.trim(), price: (document.getElementById('product-modal-price') || {}).textContent }; });
  ok(shown && /9\.00/.test(shown.label || '') && /9\.00/.test(shown.price || ''), 'في المتجر: اختيار 77mm يعرض سعره: ' + JSON.stringify(shown));
  await s2.browser.close();
  ok(!errs.filter(e => !/favicon|example\.com|Failed to load resource/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.slice(0, 3)));
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
