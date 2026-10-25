// (25 ت1 · TASK-0040) المالك seq 91: «على الأقل ٢٠ صورة لكل منتج (جميلة · إعلانية · خلفية بيضاء · صور مواصفات) أختار منها ٥–٦» · «البحث الأعمق
// عم يضل يعرض نفس الشيء» · «رسالة: ليست من صفحة المنتج» + seq 103–104 «الأفضل والمجاني ⇐ ابنِه وحطّ وسيط تاني وحطّ غوغل وجمناي».
// وسيط البحث (gmt-search) هنا بديلٌ يسجّل ما يصله؛ اختباره هو (المزوّدون · الحدود · Origin) في مسودّة الجلسة (test_search.mjs).
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const INIT = `try { localStorage.setItem('gmt_brain_endpoint', 'https://ysawzwtmodkqqbqoiojj.supabase.co/functions/v1/gmt-brain'); localStorage.removeItem('gmt_enrich_queue_v1'); } catch (_) {}`;
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    const P = prods[0];
    const { browser, ctx, pg, errs } = await H.open('inventory.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 5000, init: H.ADMIN_INIT + INIT });
    let mode = 'ok'; const seen = [];
    await ctx.route('**/functions/v1/gmt-search', async r => {
      const b = JSON.parse(r.request().postData() || '{}'); seen.push(b);
      if (mode === 'nokey') return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'لا مفتاح بحث في الوسيط', code: 'no_keys' }) });
      const body = b.kind === 'images'
        ? { provider: 'brave', images: Array.from({ length: 32 }, (_, i) => ({ url: 'https://img.example/full' + i + (/white/.test(b.q) ? 'w' : '') + '.png', thumb: 'https://img.example/t' + i + '.png', page: 'https://shop.example/p' + i, title: 't' })) }
        : { provider: 'brave', web: [{ title: 'بحث', url: 'https://www.alibaba.com/trade/search?SearchText=x', snippet: '' }, { title: 'صفحة المنتج', url: 'https://www.godox.com/product/sl60w', snippet: '' }, { title: 'صفحة ثانية', url: 'https://store.example/sl60w-specs', snippet: '' }] };
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await ctx.route('https://img.example/**', r => r.fulfill({ status: 200, body: PNG, headers: { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' } }));
    await pg.evaluate(() => {
      window.__imp = []; window.__store = [];
      GMTBrain.importProduct = async o => { __imp.push({ url: o.url, hint: o.hint }); await new Promise(r => setTimeout(r, 200));
        const res = { name: 'x', name_en: 'Godox SL60W', brand: 'Godox', model: 'SL60W', description_ar: 'وصف', specs: [{ k: 'القدرة', v: '60 واط' }], compat: [], images: [], confidence: 'high', source_url: o.url, aliases_ar: [], aliases_en: [] };
        Object.defineProperty(res, '_meta', { value: { from_memory: !o.url, page_ok: !!o.url }, enumerable: false }); return res; };
    });
    await pg.evaluate(pid => {
      const p = allProducts.find(x => String(x.id) === String(pid)); p.name = 'اضاءة Godox SL60W'; p.brand = 'Godox';
      GMTEnrichQueue.open({ key: 'g:t', title: 'تجربة', products: [p], operator: 'فاحص', save: async () => ({ data: [{ id: p.id }] }), upload: async () => 'https://x/y.png',
        storeAddImages: async (pp, urls) => { __store.push(urls.slice()); } });
    }, P.id);
    await pg.waitForFunction(() => { const s = GMTEnrichQueue.state(); return s && s.items[0].st === 'ready'; }, null, { timeout: 20000 });
    await pg.evaluate(() => { const s = GMTEnrichQueue.state(); s.cur = s.items[0].id; document.querySelector('#gmt-enrich-q [data-q-pick]').click(); });
    // ١) صفحة المنتج الحقيقية (لا صفحة نتائج البحث) ⇒ العقل يقرأ منها · والملاحظة تقولها
    let imp = await pg.evaluate(() => __imp.slice());
    ok(imp[0] && imp[0].url === 'https://www.godox.com/product/sl60w', W + ': العقل يقرأ صفحة المنتج التي وجدها البحث (لا صفحة نتائج علي بابا): ' + (imp[0] && imp[0].url));
    const q0 = seen.find(b => b.kind === 'web'), qi = seen.find(b => b.kind === 'images');
    ok(q0 && /Godox/.test(q0.q) && /SL60W/.test(q0.q) && qi && qi.count >= 20, W + ': الاستعلام بالماركة والموديل · الصور ≥٢٠: ' + JSON.stringify({ web: q0 && q0.q, img: qi && qi.count }));
    let card = await pg.evaluate(() => { const b = document.querySelector('#gmt-enrich-q [data-q-card]'); return { src: (b.querySelector('[data-src-ok]') || {}).innerText || '', tiles: b.querySelectorAll('[data-img-tile]').length, picks: b.querySelectorAll('[data-img-pick]').length, thumb: (b.querySelector('[data-img-tile] img') || {}).src || '' }; });
    ok(/من صفحة المنتج/.test(card.src) && /godox\.com/.test(card.src), W + ': «📄 من صفحة المنتج: godox.com»: ' + card.src.replace(/\s+/g, ' '));
    ok(card.tiles >= 30 && card.picks === card.tiles && /\/t\d+\.png$/.test(card.thumb), W + ': ' + card.tiles + ' صورة للاختيار (بالمصغّرة) — كل صورة بعلامة اختيار: ' + JSON.stringify(card));
    if (W === 390) await pg.screenshot({ path: '/tmp/gmt-out/search_relay_' + W + '.png' });
    // ٢) تعليم ٦ ⇒ «أضف المحدَّد للمتجر (6)» ⇒ تُضاف الستّ معاً
    await pg.evaluate(() => { const cs = [...document.querySelectorAll('#gmt-enrich-q [data-img-pick]')].slice(0, 6); cs.forEach(c => { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); });
    const n = await pg.evaluate(() => document.querySelector('#gmt-enrich-q [data-img-n]').textContent);
    await pg.click('#gmt-enrich-q [data-img-store-picked]');
    await pg.waitForFunction(() => __store.length > 0, null, { timeout: 5000 }).catch(() => {});
    const st = await pg.evaluate(() => ({ s: __store.slice(), msg: (document.querySelector('#gmt-enrich-q [data-img-msg]') || {}).innerText || '' }));
    ok(n === '6' && st.s[0] && st.s[0].length === 6 && st.s[0][0] === 'https://img.example/full0.png' && /أُضيفت 6/.test(st.msg), W + ': ٦ صور معلَّمة ⇒ أُضيفت معاً للمتجر (بالرابط الكامل لا المصغّرة): ' + st.msg);
    // ٣) «بحث أعمق» ⇒ استعلامٌ آخر (مواصفات · خلفية بيضاء) وصفحةٌ أخرى ⇒ نتيجةٌ مختلفة
    seen.length = 0;
    await pg.evaluate(() => { const b = document.querySelector('#gmt-enrich-q [data-q-card]'); const d = b.querySelector('details'); if (d) d.open = true; const x = b.querySelector('[data-act="deep"]'); if (x) x.click(); });
    await pg.waitForFunction(() => __imp.length >= 2, null, { timeout: 20000 }).catch(() => {});
    await pg.waitForFunction(() => { const s = GMTEnrichQueue.state(); return s && s.items[0].st === 'ready'; }, null, { timeout: 20000 }).catch(() => {});
    imp = await pg.evaluate(() => __imp.slice());
    const dw = seen.find(b => b.kind === 'web'), di = seen.find(b => b.kind === 'images');
    ok(dw && /specifications/.test(dw.q) && di && /white background/.test(di.q) && imp[1] && imp[1].url === 'https://store.example/sl60w-specs', W + ': «بحث أعمق» يسأل بصيغةٍ أخرى ويقرأ صفحةً أخرى: ' + JSON.stringify({ web: dw && dw.q, img: di && di.q, url: imp[1] && imp[1].url }));
    // ٤) وسيط البحث بلا مفتاح ⇒ يقول ذلك صراحةً (لا «تعذّر» غامضة) ويكمل من المعرفة العامّة
    mode = 'nokey';
    await pg.evaluate(() => { const b = document.querySelector('#gmt-enrich-q [data-q-card]'); const x = b.querySelector('[data-act="deep"]'); if (x) x.click(); });
    await pg.waitForFunction(() => __imp.length >= 3, null, { timeout: 20000 }).catch(() => {});
    await pg.waitForFunction(() => { const s = GMTEnrichQueue.state(); return s && s.items[0].st === 'ready'; }, null, { timeout: 20000 }).catch(() => {});
    await pg.waitForTimeout(400);
    card = await pg.evaluate(() => (document.querySelector('#gmt-enrich-q [data-q-card]') || {}).innerText || '');
    ok(/وسيط البحث بلا مفتاح بعد/.test(card) && /Brave/.test(card), W + ': بلا مفتاح ⇒ «وسيط البحث بلا مفتاح بعد — أضف مفتاح Brave»');
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
