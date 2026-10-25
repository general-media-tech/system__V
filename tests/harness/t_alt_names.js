// (25 ت1 · TASK-0175) المالك seq 93: «البحث عن المنتج ما زال ضعيفاً ولا يذكر كل المواصفات: القوّة الواطيّة والألوان والتغطية والجهد، بطارية أو
// كهرباء، والتصنيع والسوفتات … أعطه أنت برومبت» · seq 94: «يعطيني تسميات أخرى بالعربي أو الإنجليزي لسهولة البحث» · seq 95: «المنتج له أكثر من
// اسم للبحث». الوسيط بديلٌ يسجّل ما يصله: طلب المواصفات ثمّ طلب الإكمال (نمط السؤال ببرومبت النظام الكامل) ⇒ مواصفاتٌ أكثر + أسماء بحث.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const row = id => H.call('/rest/v1/products?id=eq.' + id + '&select=*', undefined, 'GET').then(r => r[0]);
(async () => {
  const { prods } = await H.seed();
  const P = prods[0];
  await H.call('/rest/v1/products?id=eq.' + P.id, { name: 'اضاءة غودوكس SL60W', alt_names: 'ضوء قديم' }, 'PATCH');
  const { browser, ctx, pg, errs } = await H.open('inventory.html', { w: 390, h: 844, mobile: true, wait: 5000, init: H.ADMIN_INIT });
  const seen = [];
  await ctx.route('**/functions/v1/gmt-brain**', async r => {
    const b = JSON.parse(r.request().postData() || '{}'); seen.push(b);
    const body = b.mode === 'product'
      ? { product: { name_ar: 'إضاءة غودوكس SL60W', name_en: 'Godox SL60W LED Video Light', brand: 'Godox', model: 'SL60W', category: 'إضاءة', specs: [{ k: 'القدرة', v: '60 واط' }, { k: 'الجهد', v: 'AC 100-240V' }], compat: [], images: [], confidence: 'low', notes: '' }, engine: 'memory', from_memory: true }
      : { answer: 'إليك:\n' + JSON.stringify({ specs: [{ k: 'قدرة', v: '60W' }, { k: 'مصدر الطاقة', v: 'كهرباء (AC)' }, { k: 'التغطية', v: 'زاوية 55° (تقريبي)' }, { k: 'بلد المنشأ', v: 'الصين' }, { k: 'البرمجيات', v: 'تطبيق Godox Light (تقريبي)' }],
          aliases_ar: ['جودوكس 60 واط', 'ضوء تصوير مستمر', 'ضوء قديم'], aliases_en: ['Godox SL-60W', 'SL 60W', 'LED video light'] }), provider: 'gemini' };
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
  });
  // ١) الدمج: مفتاحٌ موجود بصيغةٍ أخرى («قدرة» = «القدرة») لا يتكرّر · الأسماء بلا تكرار
  const m = await pg.evaluate(() => { const p = { specs: [{ k: 'القدرة', v: '60 واط' }], aliases_ar: ['أ'] };
    const n = GMTBrain._mergeComplete(p, { specs: [{ k: 'قدرة', v: '60W' }, { k: 'الوزن', v: '1.6 كغ' }], aliases_ar: ['أ', 'ب'], aliases_en: ['X', 'x'] }); return { n, p }; });
  ok(m.n === 1 && m.p.specs.length === 2 && m.p.aliases_ar.join() === 'أ,ب' && m.p.aliases_en.length === 1, 'الإكمال يضيف الناقص وحده (القدرة = قدرة) والأسماء بلا تكرار: ' + JSON.stringify(m.p));
  // ٢) استيراد المواصفات ⇒ طلبان: المواصفات (الأبواب في الملاحظة ≤٣٠٠) ثمّ الإكمال (برومبت النظام الكامل) ⇒ مواصفاتٌ أكثر + أسماء
  const pr = await pg.evaluate(async () => { const p = await GMTBrain.importProduct({ hint: 'اضاءة غودوكس SL60W' }); return { specs: p.specs, ar: p.aliases_ar, en: p.aliases_en, done: p._meta.completed }; });
  const q1 = seen.find(b => b.mode === 'product'), q2 = seen.find(b => b.question);
  ok(q1 && q1.hint.length <= 300 && /مصدر الطاقة/.test(q1.hint) && /البرمجيات/.test(q1.hint) && /المنشأ/.test(q1.hint), 'طلب المواصفات يحمل الأبواب كلّها (' + (q1 && q1.hint.length) + ' حرفاً)');
  ok(q2 && /aliases_ar/.test(q2.system) && /مصدر الطاقة/.test(q2.system) && /التغطية/.test(q2.system) && /البرمجيات/.test(q2.system) && /بلد المنشأ/.test(q2.system) && /القدرة=60 واط/.test(q2.question) && q2.question.length <= 2000,
    'طلب الإكمال: برومبت النظام الكامل (' + (q2 && q2.system.length) + ' حرفاً) والموجود من المواصفات في السؤال');
  ok(pr.specs.length === 6 && pr.done === 4 && pr.specs.some(s => s.k === 'البرمجيات') && pr.ar.length === 3 && pr.en.includes('Godox SL-60W'), 'النتيجة: ٢ + ٤ مواصفات جديدة · أسماء عربية وإنجليزية: ' + JSON.stringify({ n: pr.specs.length, ar: pr.ar, en: pr.en }));
  // ٣) «مواصفات من علي بابا» ⇒ «تطبيق» يحفظ الأسماء في الأسماء البديلة (بلا تكرار «ضوء قديم»)
  await pg.evaluate(id => gmtSpecsFromAlibaba(id), P.id);
  await pg.waitForSelector('#pi-go, [id="pi-url"]');
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /ابحث واجمع المواصفات/.test(x.textContent)); b.click(); });
  await pg.waitForSelector('[data-apply]', { timeout: 20000 });
  const prev = await pg.evaluate(() => (document.querySelector('[data-pi-alias]') || {}).innerText || '');
  ok(/أسماء البحث الأخرى/.test(prev) && /Godox SL-60W/.test(prev) && /جودوكس 60 واط/.test(prev), 'المعاينة تعرض أسماء البحث الأخرى قبل التطبيق: ' + prev.replace(/\s+/g, ' ').slice(0, 100));
  await pg.evaluate(() => document.querySelector('[data-apply]').click());
  let r = null; for (let i = 0; i < 40; i++) { r = await row(P.id); if (r && r.specs_checked_at) break; await pg.waitForTimeout(250); }
  const alt = String((r && r.alt_names) || '');
  ok(/ضوء قديم/.test(alt) && /جودوكس 60 واط/.test(alt) && /Godox SL-60W/.test(alt) && alt.split('ضوء قديم').length === 2 && r.specs && Object.keys(r.specs).filter(k => !k.startsWith('__')).length === 6,
    'حُفظ: ٦ مواصفات والأسماء البديلة القديمة + الجديدة بلا تكرار: ' + alt);
  // ٤) البحث بالاسم البديل: الجرد يجده
  const inv = await pg.evaluate(async () => { await loadProducts(); const q = 'SL-60W'; return allProducts.filter(p => (window.GMTSuggest ? GMTSuggest.hitsProduct(q, p) : false)).map(p => p.name); });
  ok(inv.includes('اضاءة غودوكس SL60W'), 'البحث بـ«SL-60W» (اسمٌ بديل) يجد المنتج: ' + inv.join(' · '));
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  // ٥) (TASK-0186 · seq 119 «البحث عن الباركود … كل الأسماء تنفع، ولكن الطباعة فقط بالاسم الأساسي — إنت عم تفهمني غلط»)
  //    نقطة البيع: قائمة طباعة الباركود والجرد السريع تبحثان بكل الأسماء · والملصق يُطبع بالاسم الأساسي
  const o2 = await H.open('pos.html', { w: 1366, h: 900, wait: 5000, init: H.ADMIN_INIT });
  const bc = await o2.pg.evaluate(() => { if (typeof renderBcProductList !== 'function') return 'nofn'; try { if (!branch) branch = { key: 'haleb', name: 'حلب' }; openBarcodeModal(); } catch (e) { return 'open: ' + e.message; }
    const i = document.getElementById('bc-search'); if (!i) return 'noinput';
    allProducts.push({ id: 999001, name: 'ضوء تجربة', alt_names: 'Godox SL-60W، جودوكس 60 واط', barcode: '' }); i.value = 'جودوكس 60'; renderBcProductList();
    const byAlt = (document.getElementById('bc-product-list') || {}).innerText || '';
    i.value = 'ضوء تجربة'; renderBcProductList();
    const byName = (document.getElementById('bc-product-list') || {}).innerText || '';
    toggleBcProduct(999001, true);
    return { byAlt, byName, label: (_bcSelectedProducts[999001] || {}).name || '',
             sc: typeof scRenderList === 'function' ? scRenderList.toString() : '' }; });
  ok(bc && /ضوء تجربة/.test(bc.byAlt), 'نقطة البيع (قائمة الباركود): البحث بالاسم البديل «جودوكس 60» يجده: ' + String(bc && bc.byAlt).replace(/\s+/g, ' ').slice(0, 60));
  ok(bc && /ضوء تجربة/.test(bc.byName), 'قائمة الباركود: والاسم الأساسي يجده');
  ok(bc && bc.label === 'ضوء تجربة', 'الملصق يُطبع بالاسم الأساسي وحده: «' + (bc && bc.label) + '»');
  ok(bc && bc.sc && /hitsProduct/.test(bc.sc), 'الجرد السريع: البحث بكل الأسماء');
  await o2.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
