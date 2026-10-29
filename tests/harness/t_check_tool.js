// (المالك seq 210) ① «أداة جديدة شغلتها تفلتر»: صورة واحدة (الجرد أو المتجر) · بلا مجموعة/تصنيف/مواصفات/سعر/ربط · متشابهات المتجر والجرد ⇐ «اربطهما» في الجسر
// ② «رجّع أداة التسعير» داخل الفلتر: «💲 التسعير» لكل الظاهر · ③ «العملاء والعروض والكوبونات … أدواتٌ منفصلة في الرئيسية» لا تبويبات في أدمن نقاط البيع.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  const { prods } = await H.seed();
  const [A, B, C, D] = prods.map(p => String(p.id));
  const U = 'https://x.supabase.co/storage/v1/object/public/products-images/t/';
  await H.call('/rest/v1/products?id=eq.' + A, { name: 'Canon EOS R6 Mark II كاميرا', image_url: U + 'a1.png', images: [U + 'a1.png', U + 'a2.png'], group_name: 'كاميرات', category: 'كاميرات', specs: { 'الدقة': '24MP' }, price: 2100 }, 'PATCH');
  await H.call('/rest/v1/products?id=eq.' + B, { name: 'هود EW-73D', image_url: U + 'b1.png', images: null, group_name: '', category: '', specs: {}, price: 0 }, 'PATCH');
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-17T21:08:21.137229+00:00', categories: [], products: [
    { id: 's1', name: 'Canon Lens Hood EW-73D original', price: 15, images: ['x'] }, { id: 's2', name: 'Godox SL60W light', price: 120, images: [] }] }]);
  const { browser, pg, errs } = await H.open('inventory.html?check=one_img', { w: 1366, h: 900, mobile: false, wait: 6000 });
  await pg.waitForFunction(() => typeof currentAppMode !== 'undefined' && currentAppMode === 'bulk' && document.querySelector('#bulk-filter-row .bchip.active[data-bf="one_img"]'), null, { timeout: 15000 }).catch(() => {});
  const names = () => pg.evaluate(() => bulkFiltered.map(p => p.name));
  const on1 = await pg.evaluate(() => currentAppMode);
  const one = await names();
  ok(on1 === 'bulk' && one.includes('هود EW-73D') && !one.includes('Canon EOS R6 Mark II كاميرا'), '?check=one_img ⇒ العمليات الجماعية بفلتر «صورة واحدة فقط»: الهود (صورة واحدة) لا الكاميرا (صورتان)');
  const f = async k => { await pg.evaluate(k => document.querySelector('#bulk-filter-row [data-bf="' + k + '"]').click(), k); await pg.waitForTimeout(400); return names(); };
  const ng = await f('no_group'), nc = await f('no_cat'), ns = await f('no_specs');
  ok(ng.includes('هود EW-73D') && !ng.includes('Canon EOS R6 Mark II كاميرا') && nc.includes('هود EW-73D') && !nc.includes('Canon EOS R6 Mark II كاميرا') && ns.includes('هود EW-73D') && !ns.includes('Canon EOS R6 Mark II كاميرا'),
    'بلا مجموعة · بلا تصنيف · بلا مواصفات — كلٌّ يصفّي ما ينقصه');
  await pg.evaluate(() => document.querySelector('#bulk-filter-row [data-bf="similar"]').click()); await pg.waitForTimeout(800);
  const sim = await pg.evaluate(() => [...document.querySelectorAll('#bulk-content [data-sim]')].map(x => ({ t: x.innerText.replace(/\s+/g, ' '), href: (x.querySelector('a') || {}).href || '' })));
  ok(sim.length === 1 && /EW-73D original/.test(sim[0].t) && /هود EW-73D/.test(sim[0].t) && /bridge\.html\?link=s1&inv=/.test(sim[0].href), 'متشابهات: «Canon Lens Hood EW-73D» (متجر) ⇐ «هود EW-73D» (جرد) و«اربطهما» إلى الجسر: ' + JSON.stringify(sim).slice(0, 200));
  // (seq 212) المراجعة الكاملة والأزرار
  const btns = await pg.evaluate(() => [...document.querySelectorAll('#bulk-content [data-sim] button, #bulk-content [data-sim] a')].map(x => x.textContent.trim()));
  ok(['راجِع', 'اربطهما', 'اسأل العقل', 'عدّل منتج الجرد', 'افتحه في المتجر', 'ليسا نفس المنتج'].every(t => btns.some(x => x.indexOf(t) !== -1)), 'أزرار المراجعة كاملة: ' + btns.join(' · '));
  await pg.evaluate(() => document.querySelector('#bulk-content [data-sim] [data-sa="review"]').click()); await pg.waitForTimeout(300);
  const det = await pg.evaluate(() => (document.querySelector('#bulk-content [data-sim]') || {}).innerText || '');
  ok(/في المتجر/.test(det) && /في الجرد/.test(det) && /الكمية/.test(det) && /\$15/.test(det) && /المجموعة|السعر/.test(det), '«🔍 راجِع» يعرض الاثنين كاملين (السعر · الصور · المواصفات)');
  await pg.screenshot({ path: '/tmp/gmt-out/check_tool_similar.png', fullPage: false });
  await pg.evaluate(() => document.querySelector('#bulk-content [data-sim] [data-sa="skip"]').click()); await pg.waitForTimeout(300);
  const after = await pg.evaluate(() => ({ n: document.querySelectorAll('#bulk-content [data-sim]').length, un: !!document.querySelector('#bulk-content [data-sa="unskip"]') }));
  ok(after.n === 0 && after.un, '«✕ ليسا نفس المنتج» يُخفي الاقتراح و«أظهر المخفيّة» يرجعه: ' + JSON.stringify(after));
  await pg.evaluate(() => document.querySelector('#bulk-content [data-sa="unskip"]').click()); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => document.querySelectorAll('#bulk-content [data-sim]').length === 1), '«أظهر المخفيّة» أعاده');
  // (seq 213) المرشّحون للاختيار · «🔗 اربطهما الآن» ⇐ ربطٌ في الجهتين ثمّ صفحة تعديل المنتج
  const btn2 = await pg.evaluate(() => [...document.querySelectorAll('#bulk-content [data-sim] [data-sa="link"]')].length);
  ok(btn2 === 1, 'زرّ «🔗 اربطهما الآن ثمّ عدّل المنتج» في البطاقة');
  await pg.evaluate(() => { window.__opened = null; window.invOpenFullEdit = id => { window.__opened = String(id); }; });
  await pg.evaluate(() => document.querySelector('#bulk-content [data-sim] [data-sa="link"]').click());
  await pg.waitForSelector('.gmtask-ov', { timeout: 5000 }).catch(() => {});
  await pg.evaluate(() => { const o = document.querySelector('.gmtask-ov'); if (o) [...o.querySelectorAll('button')].find(b => /سعر المتجر/.test(b.textContent)).click(); });
  await pg.waitForFunction(() => window.__opened, null, { timeout: 10000 }).catch(() => {});
  const st = (await H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET'))[0].products.find(x => x.id === 's1');
  const ib = (await H.call('/rest/v1/products?id=eq.' + B + '&select=*', undefined, 'GET'))[0];
  const op = await pg.evaluate(() => window.__opened);
  ok(op === B && /#product=s1/.test(ib.store_url || '') && Number(ib.price) === 15 && st.barcode === ib.barcode && Number(st.price) === 15, 'رُبطا مباشرةً (رابط المتجر · السعر الموحّد $15 · الباركود) ثمّ فُتحت صفحة تعديل منتج الجرد: ' + JSON.stringify({ op: op === B, url: ib.store_url, p: ib.price, sb: st.barcode }));
  ok(await pg.evaluate(() => !document.querySelector('#bulk-content [data-sim]')), 'اختفى من المتشابهات بعد الربط');
  // ② التسعير لكل الظاهر
  await f('no_group');
  await pg.evaluate(() => bulkPriceFiltered()); await pg.waitForTimeout(400);
  const pm = await pg.evaluate(() => { const o = document.getElementById('bulk-modal-overlay'); return { open: !!(o && getComputedStyle(o).display !== 'none'), t: (document.getElementById('bulk-modal-title') || {}).textContent || '' }; });
  ok(pm.open && /تعديل الأسعار/.test(pm.t), '«💲 التسعير» يفتح أداة التسعير لكل الظاهر: ' + pm.t);
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  // ③ أدمن نقاط البيع
  const a = await H.open('admin_pos.html', { w: 1366, h: 900, mobile: false, wait: 5000 });
  const tabs = await a.pg.evaluate(() => [...document.querySelectorAll('.main-tab')].filter(t => t.offsetParent).map(t => t.textContent.trim()));
  ok(!tabs.some(t => /العملاء|العروض|الكوبونات|الموظفون|الأصول/.test(t)) && tabs.some(t => /الفواتير/.test(t)), 'أدمن نقاط البيع بلا تبويبات العملاء/العروض/الكوبونات/الموظفين/الأصول: ' + tabs.join(' · '));
  await a.browser.close();
  const b = await H.open('admin_pos.html?tab=coupons', { w: 390, h: 844, mobile: true, wait: 5000 });
  const solo = await b.pg.evaluate(() => ({ bar: getComputedStyle(document.getElementById('main-tabs')).display, title: (document.querySelector('#topbar .tb-title') || {}).textContent, active: activeTab }));
  ok(solo.bar === 'none' && /الكوبونات/.test(solo.title) && solo.active === 'coupons', '?tab=coupons ⇒ أداةٌ وحدها (بلا شريط التبويبات · عنوانها «الكوبونات»): ' + JSON.stringify(solo));
  await b.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
