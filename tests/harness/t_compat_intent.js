// (المالك seq 217) «البحث عن الغطاء أو الهود أو البطارية من اسم التوافق لا يعمل — مثلاً: بجارية 700d · هود عدسة 18-55 · غطا عدسة 85 ·
// وأيضاً هي الأداة ما في إلها زرّ داخل أزرار الجرد».
// ① الجرد: البحث يفهم «نوع + ما يركب عليه» من المرجع (700D ⇐ LP-E8 · 18-55 ⇐ EW-63C/EW-60C أو هود لولبي 58 · 85 ⇐ أقطار عدسات 85)
//    ويُظهر النوع المطلوب وحده (لا هود في بحث «غطاء») ويقول ما فهمه — وإن لم يوجد في الجرد يقوله صراحةً.
// ② نقطة البيع: الشيء نفسه في «لا توجد نتائج». ③ زرّا «متشابهات المتجر والجرد» و«فحص المنتجات» في أزرار الجرد وفي «المزيد».
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const P = [
  { name: 'Lp e17 battry copy', group_name: 'بطاريات وشواحن', compat: 'Canon EOS 750D · Canon EOS 250D' },
  { name: 'Canon LP-E8 بطارية', group_name: 'بطاريات وشواحن', compat: '' },
  { name: 'EW－73B Iens hood هود', group_name: 'هودات', alt_names: 'غطاء عدسة كانون، هود EW-73B', compat: 'Canon EF-S 18-135mm f/3.5-5.6 IS STM (67مم)' },
  { name: 'ET－65 III lens hood هود', group_name: 'هودات', alt_names: 'غطاء عدسة ET-65 III', compat: 'Canon EF 85mm f/1.8 USM (58مم)' },
  { name: 'هود معدن', group_name: 'هودات', alt_names: '58mm Metal Lens Hood، هود 58 مم', compat: 'قطر الفلتر 58مم' },
  { name: '58mm lens cap for CANON غطا', group_name: 'اغطية كمرا وعدسة', compat: 'Canon EF 85mm f/1.8 USM (58مم)' },
  { name: '49mm lens cap for CANON غطا', group_name: 'اغطية كمرا وعدسة', compat: 'Canon EF 50mm f/1.8 STM (49مم)' },
  { name: 'Canon 85mm 1.8 عدسة', group_name: 'عدسات', compat: '' }
];
(async () => {
  const { prods } = await H.seed();
  for (let i = 0; i < P.length; i++) await H.call('/rest/v1/products?id=eq.' + prods[i].id, P[i], 'PATCH');
  for (let i = P.length; i < prods.length; i++) await H.call('/rest/v1/products?id=eq.' + prods[i].id, undefined, 'DELETE');
  for (const W of [390, 1366]) {
    const mob = W < 500;
    const { browser, pg, errs } = await H.open('inventory.html', { w: W, h: mob ? 844 : 900, mobile: mob, wait: 5000 });
    const S = async q => pg.evaluate(q => { searchQuery = q; applyFilters(); const el = document.getElementById('inv-compat-say');
      return { names: filteredProducts.map(p => p.name), say: el && el.style.display !== 'none' ? el.textContent : '' }; }, q);
    const a = await S('بجارية 700d');
    ok(a.names.length === 1 && /LP-E8/.test(a.names[0]) && /LP-E8/.test(a.say) && /700D/.test(a.say), W + ': «بجارية 700d» (خطأ إملائي) ⇐ بطارية LP-E8 وحدها ويقول «بطارية Canon EOS 700D ⇐ LP-E8»: ' + JSON.stringify(a));
    await H.call('/rest/v1/products?id=eq.' + prods[1].id, undefined, 'DELETE');
    await pg.evaluate(() => { allProducts = allProducts.filter(p => !/LP-E8/.test(p.name)); });
    const a2 = await S('بطارية 700d');
    ok(!a2.names.length && /LP-E8/.test(a2.say) && /لا يوجد منه في الجرد/.test(a2.say), W + ': لا LP-E8 في الجرد ⇐ يقولها صراحةً لا «لا توجد منتجات» صامتة: ' + a2.say);
    const b = await S('هود عدسة 18-55');
    ok(b.names.join('|') === 'هود معدن' && /EW-63C/.test(b.say), W + ': «هود عدسة 18-55» ⇐ الهود اللولبي 58مم وحده (لا EW-73B ولا الغطاء) ويذكر EW-63C/EW-60C: ' + JSON.stringify(b).slice(0, 220));
    const c = await S('غطا عدسة 85');
    ok(c.names.join('|') === '58mm lens cap for CANON غطا' && /58مم/.test(c.say), W + ': «غطا عدسة 85» ⇐ غطاء 58مم — لا الهودات التي في اسمها البديل «غطاء عدسة» ولا العدسة نفسها: ' + JSON.stringify(c).slice(0, 220));
    const d = await S('هود 85 1.8');
    ok(d.names.includes('ET－65 III lens hood هود') && !d.names.some(n => /EW/.test(n)), W + ': «هود 85 1.8» ⇐ ET-65 III: ' + d.names.join(' | '));
    const e = await S('عدسة 85');
    ok(e.names.includes('Canon 85mm 1.8 عدسة') && !e.say, W + ': بحثٌ عاديّ بلا نوعٍ تابع يبقى كما هو (العدسة نفسها) بلا جملة توافق');
    // ③ الأزرار
    const btn = await pg.evaluate(() => [...document.querySelectorAll('button')].filter(b => /invOpenCheck\('similar'\)/.test(b.getAttribute('onclick') || '')).length);
    ok(btn >= 2, W + ': زرّ «🔗 متشابهات المتجر والجرد» في أزرار الجرد وفي «المزيد»: ' + btn);
    await pg.evaluate(() => invOpenCheck('similar')); await pg.waitForTimeout(1500);
    const on = await pg.evaluate(() => ({ mode: currentAppMode, f: bulkActiveFilter }));
    ok(on.mode === 'bulk' && on.f === 'similar', W + ': الزرّ يفتح الأداة مباشرة: ' + JSON.stringify(on));
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
    await browser.close();
    if (W === 390) { const r2 = await H.seed(); prods.splice(0, prods.length, ...r2.prods); for (let i = 0; i < P.length; i++) await H.call('/rest/v1/products?id=eq.' + prods[i].id, P[i], 'PATCH'); for (let i = P.length; i < prods.length; i++) await H.call('/rest/v1/products?id=eq.' + prods[i].id, undefined, 'DELETE'); }
  }
  // ② نقطة البيع
  const o = await H.open('pos.html', { w: 390, h: 844, mobile: true, wait: 5000 });
  await o.pg.evaluate(async () => { if (!branch) branch = { key: 'haleb', name: 'حلب' }; if (typeof loadProducts === 'function') await loadProducts(); });
  await o.pg.waitForTimeout(1200);
  const g = await o.pg.evaluate(() => { const i = document.getElementById('searchInput'); const out = {};
    i.value = 'غطا عدسة 85'; renderProds(); out.cap = { grid: document.getElementById('prodsGrid').innerText, lbl: document.getElementById('prodsLabel').textContent };
    allProducts = allProducts.filter(p => !/LP-E8/.test(p.name)); i.value = 'بجارية 700d'; renderProds(); out.none = document.getElementById('prodsGrid').innerText; return out; });
  ok(/58mm lens cap/.test(g.cap.grid) && !/ET－65|EW－73B/.test(g.cap.grid) && /58مم/.test(g.cap.lbl), 'نقطة البيع: «غطا عدسة 85» ⇐ غطاء 58مم وحده والعنوان يقول ما فهمه: ' + g.cap.lbl);
  ok(/LP-E8/.test(g.none) && /لا يوجد منه/.test(g.none), 'نقطة البيع: «بجارية 700d» بلا نتيجة ⇐ «بطارية Canon EOS 700D ⇐ LP-E8 — لا يوجد منه»: ' + g.none.replace(/\s+/g, ' ').slice(0, 120));
  const real = o.errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'نقطة البيع: لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
