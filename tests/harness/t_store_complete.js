// (TASK-0372 · المالك seq 653) «لما يطلب منتج تقترح له الآخر ويعمل بكج» ⇒ «كمّل طقمك» في صفحة المنتج
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const VISITOR = `try{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
const C = (id, name, parent) => Object.assign({ id, name, order: 1 }, parent ? { parent_id: parent } : {});
const cats = [C('a', 'كاميرات كانون'), C('a1', 'كاميرات', 'a'), C('b', 'إكسسوارات الكاميرا'), C('b1', 'بطاريات وشواحن', 'b'), C('b2', 'ذواكر ووصلات', 'b'), C('b3', 'حقائب', 'b'),
  C('c', 'ترايبود وجيمبال'), C('c1', 'ترايبود', 'c'), C('d', 'إضاءة الاستوديو'), C('d1', 'رؤوس الإضاءة', 'd'), C('d2', 'سوفت بوكس ومعدّلات', 'd'), C('d3', 'ستاندات', 'd'), C('d4', 'ألواح LED', 'd'), C('z', 'أخرى'), C('z1', 'متفرقات', 'z')];
const Pr = (id, name, price, cat, x) => Object.assign({ id, name, price, category_id: cat, category_ids: [cat], images: [], stock: 5 }, x || {});
const prods = [Pr('cam', 'Canon EOS R50 body', 620, 'a1'), Pr('bat', 'بطارية LP-E17', 25, 'b1', { compat: 'Canon EOS R50 · RP · 250D · M6 II' }), Pr('bat2', 'بطارية LP-E6', 30, 'b1', { compat: 'Canon R6 · 5D' }),
  Pr('sd', 'ذاكرة SanDisk 128GB', 22, 'b2'), Pr('bag', 'حقيبة كتف كانون', 28, 'b3'), Pr('tri', 'ترايبود 170 سم', 35, 'c1'), Pr('noprice', 'ذاكرة بلا سعر', 0, 'b2'), Pr('pl26', 'Pl26', 20, 'd4'), Pr('big', 'لوح ليد 660 كبير', 80, 'd4'),
  Pr('head', 'YM-S100 هيد', 125, 'd1'), Pr('soft', 'سوفت بوكس 65 سم', 18, 'd2'), Pr('stand', 'ستاند 2.6 م', 15, 'd3'), Pr('misc', 'كوب حراري', 9, 'z1')];
const store = { categories: cats, banners: [], offers: [], branches: [], products: prods };
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-13T10:00:00Z', ...store }]);
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 }); const pg = o.pg;
  await o.ctx.route(/\/storage\/v1\/object\/public\/products-images\/store\/home\.json/, r => r.fulfill({ status: 404, body: '' }));
  await pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(6500);
  const st = () => pg.evaluate(() => { const w = document.getElementById('pm-complete'); return { shown: !w.classList.contains('hidden'), ids: [...w.querySelectorAll('.pmc')].map(b => b.dataset.id), on: [...w.querySelectorAll('.pmc.on')].map(b => b.dataset.id), btn: document.getElementById('pmc-add').textContent, dis: document.getElementById('pmc-add').disabled }; });
  await pg.evaluate(() => openProductModal('cam')); await pg.waitForTimeout(1200); let s = await st();
  ok(s.shown && s.ids[0] === 'bat' && !s.ids.includes('bat2'), 'كاميرا R50 ⇒ أوّل اقتراح البطارية التي يذكر توافقُها R50 (لا بطارية كاميرا أخرى): ' + s.ids.join(' · '));
  ok(['sd', 'bag', 'pl26'].every(x => s.ids.includes(x)) && !s.ids.includes('big') && !s.ids.includes('noprice') && !s.ids.includes('head') && !s.ids.includes('misc'), '(seq B677) ثمّ ما يلزم الكاميرا: الحقيبة · لوح الإضاءة الصغير Pl26 (لا اللوح الكبير) · الذاكرة — بلا منتج بلا سعر ولا ما لا يخصّها');
  ok(s.dis && s.on.length === 0 && /اختر/.test(s.btn), 'لا شيء مختار مسبقاً — الزبون يختار');
  await pg.click('.pmc[data-id="bat"]'); await pg.click('.pmc[data-id="sd"]'); s = await st();
  ok(s.on.join() === 'bat,sd' && !s.dis && /مع 2 قطع/.test(s.btn) && /\+\$47\.00|\+\$46\.98/.test(s.btn), 'اختيار قطعتين ⇒ الزرّ يذكر العدد والمجموع: ' + s.btn);
  await pg.click('#pmc-add'); await pg.waitForTimeout(1200);
  const cart = await pg.evaluate(() => store.cart.map(i => [i.id, i.qty]));
  ok(cart.length === 3 && ['cam', 'bat', 'sd'].every(id => cart.some(c => c[0] === id && c[1] === 1)), 'ضغطة واحدة ⇒ المنتج وما اختاره في السلّة: ' + JSON.stringify(cart));
  await pg.evaluate(() => { document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')); openProductModal('head'); }); await pg.waitForTimeout(1200); s = await st();
  ok(s.shown && s.ids.includes('soft') && s.ids.includes('stand') && !s.ids.includes('bat'), 'رأس إضاءة ⇒ سوفت بوكس وستاند: ' + s.ids.join(' · '));
  await pg.evaluate(() => { document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')); openProductModal('misc'); }); await pg.waitForTimeout(1000); s = await st();
  ok(!s.shown, 'منتج لا يلزمه شيء ⇒ القسم لا يظهر');
  const real = o.errs.filter(x => !/status of (400|401|404|406|503)|Failed to load resource/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
