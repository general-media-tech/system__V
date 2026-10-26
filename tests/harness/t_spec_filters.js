// (26 ت1 · TASK-0189) المالك seq 124: «يعطيني تصنيف للأشياء اللي ما لها حالياً مواصفات» · seq 126: «فلتر بالأشياء اللي لها مواصفات ويا اللي ما لها ·
// المربوطة بالجرد ومو المربوطة · اللي بالمتجر ومو بالجرد أو بالجرد ومو بالمتجر · وبدّي أرجع أبحث عن منتجات موجودة» · seq 127: «بالاثنين» (الأداة وقائمة الجرد) ·
// «اللي بالمتجر ومو بالجرد بدّي إيّاها تدخل بنفس الفلتر» · زرّ «أعد التجهيز من جديد».
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const STUB = `window.__calls = []; window.__brainStub = function () { GMTBrain.importProduct = async function (o) { await new Promise(r => setTimeout(r, 30));
  const n = (o.hint || '').split(' — ')[0]; window.__calls.push(n); const res = { name: n, name_en: 'EN ' + n, brand: 'Godox', model: 'M', description_ar: 'وصف', specs: [{ k: 'اللون', v: 'أسود' }], compat: [], aliases_ar: [], aliases_en: [], images: [] };
  Object.defineProperty(res, '_meta', { value: { from_memory: true }, enumerable: false }); return res; }; };`;
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    const ids = prods.map(p => String(p.id)), A = ids[0], B = ids[2], C = ids[4];   // A وB وC في «إضاءة»
    await H.call('/rest/v1/products?id=eq.' + A, { store_url: 'store.html#product=p_1', specs: { 'الوزن': '200 غ', __desc: 'وصف' }, specs_checked_at: '2026-10-25T10:00:00Z' }, 'PATCH');
    await H.call('/rest/v1/products?id=eq.' + C, { specs: { 'القدرة': '60 واط' } }, 'PATCH');
    await H.call('/rest/v1/products?id=eq.' + ids[1], { specs: { __desc: 'وصف فقط' } }, 'PATCH');   // وصفٌ بلا مواصفات ⇒ «بلا مواصفات»
    await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-17T21:08:21Z', categories: [], products: [
      { id: 'p_1', name: 'منتج مربوط برابط', price: 50, images: [] },
      { id: 'p_2', name: 'منتج مربوط بمعرّف', price: 40, images: [], inv_id: B },
      { id: 'p_3', name: 'فلاش في المتجر وحده', price: 90, images: [], specs: [{ label: 'القدرة', value: '76 واط' }] },
      { id: 'p_4', name: 'حامل في المتجر وحده', price: 20, images: [] }] }]);
    const mob = W < 500;
    const { browser, pg, errs } = await H.open('inventory.html', { w: W, h: mob ? 844 : 900, mobile: mob, wait: 5000, init: H.ADMIN_INIT + STUB });
    await pg.evaluate(() => { localStorage.removeItem('gmt_enrich_queue_v1'); window.__brainStub(); });
    const until = async (fn, ms = 20000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await pg.waitForTimeout(200); } };
    const setF = (sp, st) => pg.evaluate(([sp, st]) => setSpecStoreFilter(sp, st), [sp, st]);
    const shown = () => pg.evaluate(() => ({ ids: filteredProducts.map(p => String(p.id)), count: document.getElementById('result-count').textContent,
      panel: (document.getElementById('store-only-panel') || {}).innerText || '', hidden: getComputedStyle(document.getElementById('list-view')).display === 'none' && getComputedStyle(document.getElementById('table-wrap')).display === 'none' }));

    // ① قائمة الجرد
    ok(await pg.evaluate(() => !!document.getElementById('f-specs') && !!document.getElementById('f-store')), W + ': فوق قائمة الجرد فلتر «📋 المواصفات» و«🛒 المتجر»');
    await setF('has', ''); let r = await shown();
    ok(r.ids.length === 2 && r.ids.includes(A) && r.ids.includes(C), W + ': «لها مواصفات» ⇒ ٢ (الوصف وحده لا يُعدّ مواصفات): ' + r.count);
    await setF('none', ''); r = await shown();
    ok(r.ids.length === 10 && !r.ids.includes(A) && r.ids.includes(ids[1]), W + ': «بلا مواصفات» ⇒ ١٠: ' + r.count);
    await setF('', 'linked'); r = await shown();
    ok(r.ids.length === 2 && r.ids.includes(A) && r.ids.includes(B), W + ': «مربوطة بالمتجر» ⇒ برابط المتجر أو بمعرّف الجرد في المتجر (A · B)');
    await setF('', 'inv'); r = await shown();
    ok(r.ids.length === 10 && !r.ids.includes(A) && !r.ids.includes(B), W + ': «في الجرد وليست في المتجر» ⇒ ١٠');
    await setF('', 'store'); r = await shown();
    ok(/فلاش في المتجر وحده/.test(r.panel) && /حامل في المتجر وحده/.test(r.panel) && !/مربوط/.test(r.panel.replace(/اربطها/g, '')) && /2 منتج في المتجر/.test(r.count) && r.hidden,
      W + ': «في المتجر وليست في الجرد» ⇒ لوحتها بمنتجي المتجر وحده وتختفي قائمة الجرد: ' + r.count);
    await setF('has', 'store'); r = await shown();
    ok(/فلاش في المتجر وحده/.test(r.panel) && !/حامل في المتجر وحده/.test(r.panel) && /1 منتج في المتجر/.test(r.count), W + ': والفلتران معاً: في المتجر وحده + لها مواصفات ⇒ الفلاش وحده');
    const hs = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(!hs, W + ': لا تمرير أفقي');
    if (W === 390) await pg.screenshot({ path: '/tmp/gmt-out/spec_filters_390.png' });
    await setF('', '');

    // ② أداة «جهّز تلقائياً»: الفلتر نفسه · قسم «كل ما ليس له مواصفات»
    await pg.evaluate(() => { gmtEnrichPick(); }); await pg.waitForSelector('#gmt-enrich-pick [data-pk]');
    const secs = () => pg.evaluate(() => [...document.querySelectorAll('#gmt-enrich-pick [data-pk]')].map(b => b.getAttribute('data-pk') + '=' + b.innerText.replace(/\s+/g, ' ')));
    let s = await secs();
    ok(s.some(x => /^x:nospecs=.*10 منتج/.test(x)) && await pg.evaluate(() => !!document.querySelector('#gmt-enrich-pick [data-pf="specs"]') && !!document.querySelector('#gmt-enrich-pick [data-pf="store"]')),
      W + ': في الأداة فلتر المواصفات والمتجر وقسم «📋 كل ما ليس له مواصفات» (١٠)');
    await pg.selectOption('#gmt-enrich-pick [data-pf="specs"]', 'has'); s = await secs();
    ok(!s.some(x => /^x:nospecs/.test(x)) && s.some(x => /^g:إضاءة=.*2 منتج/.test(x)), W + ': «لها مواصفات» يعيد حساب الأقسام: إضاءة ٢ · ولا قسم «بلا مواصفات»: ' + s.filter(x => /^g:/.test(x)).join(' | '));
    await pg.selectOption('#gmt-enrich-pick [data-pf="specs"]', ''); await pg.selectOption('#gmt-enrich-pick [data-pf="store"]', 'store'); s = await secs();
    ok(s.length === 1 && /^s:storeonly=.*2 منتج/.test(s[0]), W + ': «في المتجر وليست في الجرد» يدخل الفلتر نفسه: ' + s[0]);
    await pg.click('#gmt-enrich-pick [data-pk="s:storeonly"]'); await pg.waitForTimeout(400); r = await shown();
    ok(/فلاش في المتجر وحده/.test(r.panel) && await pg.evaluate(() => document.getElementById('f-store').value === 'store'), W + ': اختيارها يعرضها في قائمة الجرد بالفلتر نفسه (لا تُحفظ في الجرد)');
    await setF('', '');
    // «كل ما ليس له مواصفات» ⇒ طابورٌ بها وحدها
    await pg.evaluate(() => { gmtEnrichPick(); }); await pg.waitForSelector('#gmt-enrich-pick [data-pk]');
    await pg.click('#gmt-enrich-pick [data-pk="x:nospecs"]');
    await until(() => pg.evaluate(() => { const q = GMTEnrichQueue.state(); return q && q.items.length && q.items.every(x => x.st === 'ready'); }));
    const q1 = await pg.evaluate(() => GMTEnrichQueue.state().items.map(x => String(x.id)));
    ok(q1.length === 10 && !q1.includes(A) && !q1.includes(C), W + ': طابور «كل ما ليس له مواصفات» فيه العشرة وحدها');
    await pg.evaluate(() => GMTEnrichQueue.close(true));

    // ③ «أعد التجهيز من جديد»: طابور «إضاءة» محفوظٌ كلّه ⇒ عادي: لا نداء · من جديد: يبحث عن الكل (والمجهَّز منها)
    const light = prods.filter((p, i) => i % 2 === 0).map(p => String(p.id));
    await pg.evaluate(ls => { localStorage.setItem('gmt_enrich_queue_v1', JSON.stringify({ key: 'g:إضاءة', title: 'إضاءة', at: Date.now(), items: ls.map(id => ({ id, st: 'saved', res: null, err: '' })) })); window.__calls = []; }, light);
    await pg.evaluate(() => { gmtEnrichPick(); }); await pg.waitForSelector('#gmt-enrich-pick [data-pk]');
    await pg.evaluate(() => { document.querySelector('#gmt-enrich-pick [data-pleft]').checked = false; });
    await pg.click('#gmt-enrich-pick [data-pk="g:إضاءة"]'); await pg.waitForTimeout(1500);
    const n0 = await pg.evaluate(() => ({ calls: window.__calls.length, st: GMTEnrichQueue.state().items.map(x => x.st) }));
    ok(n0.calls === 0 && n0.st.every(x => x === 'saved'), W + ': بلا «من جديد» يستأنف المحفوظ ولا يبحث: ' + n0.st.join('،'));
    await pg.evaluate(() => GMTEnrichQueue.close(true));
    await pg.evaluate(() => { gmtEnrichPick(); }); await pg.waitForSelector('#gmt-enrich-pick [data-pfresh]');
    await pg.click('#gmt-enrich-pick [data-pfresh]');
    const fb = await pg.evaluate(() => ({ pressed: document.querySelector('#gmt-enrich-pick [data-pfresh]').getAttribute('aria-pressed'), left: document.querySelector('#gmt-enrich-pick [data-pleft]').disabled,
      note: getComputedStyle(document.querySelector('#gmt-enrich-pick [data-pfresh-note]')).display !== 'none' }));
    ok(fb.pressed === 'true' && fb.left && fb.note, W + ': «🔁 أعد التجهيز من جديد» مضغوط · «غير المجهَّزة فقط» معطّل · والشرح ظاهر');
    await pg.click('#gmt-enrich-pick [data-pk="g:إضاءة"]');
    await until(() => pg.evaluate(() => { const q = GMTEnrichQueue.state(); return q && q.items.every(x => x.st === 'ready'); }));
    const n1 = await pg.evaluate(() => ({ calls: window.__calls.length, n: GMTEnrichQueue.state().items.length, st: GMTEnrichQueue.state().items.map(x => x.st) }));
    ok(n1.n === 6 && n1.calls === 6 && n1.st.every(x => x === 'ready'), W + ': «من جديد» ⇒ العقل يبحث عن الستّة كلّها (والمجهَّز A منها) وتنتظر مراجعتك: ' + n1.calls + ' نداء');
    const ra = await H.call('/rest/v1/products?id=eq.' + A + '&select=specs', undefined, 'GET');
    ok(ra[0].specs['الوزن'] === '200 غ', W + ': والمنتج المحفوظ لم يتغيّر قبل أن تحفظ');
    await pg.evaluate(() => GMTEnrichQueue.close(true));

    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
