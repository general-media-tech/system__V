// OWN-13#15 (صورة ٥) — «العقل لا يبحث … إن لم يجد من الصورة/الاسم يعرض نتائج أختار منها، ويأخذ الوصف وأحدّد صوراً».
// نافذة «مواصفات منتج من علي بابا»: ١) لا وجد ⇒ زرّ «اعرض نتائج أختار منها» بلا نداءٍ آليّ ثانٍ (لا استهلاك رصيد) ·
// ٢) الزرّ ⇒ product_search ⇒ قائمة مرشّحين · ٣) «اختر هذا» ⇒ يجمع من رابط المرشّح · ٤) صور المرشّح قابلة للتحديد و«تطبيق» يمرّر المحدَّدة فقط ·
// ٥) نتيجة «المعرفة العامّة» ⇒ الزرّ نفسه يظهر · ٦) لا تمرير أفقيّ ولا أخطاء JS.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const CANDS = { candidates: [
  { title: 'Godox V1 Round Head Flash', source_url: 'https://www.alibaba.com/product-detail/godox-v1_1.html', match: 'exact', match_reason: 'نفس الموديل', image_urls: ['https://img.example.com/a1.jpg', 'https://img.example.com/a2.jpg'], specs_preview: [{ k: 'GN', v: '76' }], price_hint: '$120' },
  { title: 'Godox V1 Pro', source_url: 'https://www.aliexpress.com/item/2.html', match: 'similar', match_reason: 'إصدار أحدث', image_urls: [], specs_preview: [] }],
  identified: { name_en: 'Godox V1' }, notes: '' };
const PAGE = { product: { name_ar: 'فلاش غودوكس V1', brand: 'Godox', specs: [{ k: 'الرقم الدليلي', v: '76' }], compat: [], confidence: 'high', images: ['https://img.example.com/p3.jpg'], source_url: '' },
  searched: true, engine: 'google', from_memory: false, page_ok: true, empty: false, sources: [] };
const MEMORY = { product: { name_ar: 'فلاش', specs: [{ k: 'النوع', v: 'فلاش' }], confidence: 'low', images: [] }, searched: false, engine: 'memory', from_memory: true, page_ok: false, empty: false, sources: [] };

(async () => {
  for (const [w, mob] of [[390, true], [1366, false]]) {
    console.log('— ' + w);
    await H.seed();
    const { browser, ctx, pg, errs } = await H.open('inventory.html', { w, h: 900, mobile: mob, wait: 4000 });
    const reqs = []; let productReply = { product: {}, searched: false, empty: true };
    await ctx.route('**/functions/v1/gmt-brain**', r => {
      const b = JSON.parse(r.request().postData() || '{}'); reqs.push(b);
      const body = b.mode === 'product_search' ? CANDS : productReply;
      r.fulfill({ status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
    });
    await pg.evaluate(() => { window.__got = null; GMTBrain.productImportDialog(async (pr) => { window.__got = JSON.parse(JSON.stringify(pr)); }, { url: '', name: 'Godox V1', imageUrl: '' }); });
    await pg.waitForSelector('#pi-go');
    const run = async () => { await pg.click('#pi-go'); await pg.waitForFunction(() => !document.getElementById('pi-go').disabled, null, { timeout: 15000 }); await pg.waitForTimeout(150); };

    // ١) لا وجد ⇒ الزرّ بلا نداءٍ ثانٍ
    await run();
    let s = await pg.evaluate(() => ({ err: document.getElementById('pi-err').innerText, btn: !!document.querySelector('[data-pi-cands-go]') }));
    ok(reqs.filter(b => b.mode === 'product_search').length === 0 && /لم يجد العقل/.test(s.err) && s.btn, 'لا وجد ⇒ رسالة + زرّ «اعرض نتائج أختار منها» — بلا نداءٍ آليّ ثانٍ ');
    // ٢) الزرّ ⇒ product_search ⇒ قائمة
    await pg.click('[data-pi-cands-go]');
    await pg.waitForSelector('[data-pi-cand]', { timeout: 8000 });
    const last = reqs[reqs.length - 1];
    const n = await pg.$$eval('[data-pi-cand]', l => l.length);
    ok(last.mode === 'product_search' && last.hint === 'Godox V1' && n === 2, 'product_search بالاسم ⇒ مرشّحان ظاهران (' + n + ')');
    const txt = await pg.$eval('#pi-cands', e => e.innerText);
    ok(/مطابق/.test(txt) && /مشابه/.test(txt) && /alibaba\.com/.test(txt) && /GN/.test(txt), 'كل مرشّح: مطابق/مشابه · الموقع · مواصفات مختصرة');
    if (w === 390) await pg.screenshot({ path: __dirname + '/brain_cands_390.png' });
    // ٣) «اختر هذا» ⇒ يجمع من رابطه
    productReply = PAGE;
    await pg.click('[data-pi-cand-pick="0"]');
    await pg.waitForSelector('[data-apply]', { timeout: 15000 });
    const pr = reqs.filter(b => b.mode === 'product').slice(-1)[0] || {};
    ok(pr.mode === 'product' && pr.url === CANDS.candidates[0].source_url, 'اختيار المرشّح ⇒ جمع المواصفات من رابطه: ' + pr.url);
    // ٤) الصور: صور المرشّح أوّلاً + صور الصفحة — كلّها محدّدة، نلغي واحدة
    const imgs = await pg.$$eval('[data-pi-img]', l => l.length);
    ok(imgs === 3, 'شبكة صور قابلة للتحديد (مرشّح ٢ + صفحة ١): ' + imgs);
    await pg.click('[data-pi-img="1"]');
    await pg.click('[data-apply]');
    await pg.waitForFunction(() => !!window.__got, null, { timeout: 5000 });
    const got = await pg.evaluate(() => window.__got);
    ok(JSON.stringify(got.images) === JSON.stringify(['https://img.example.com/a1.jpg', 'https://img.example.com/p3.jpg']) && got.source_url === CANDS.candidates[0].source_url,
      '«تطبيق» يمرّر الصور المحدّدة فقط ومصدر المرشّح: ' + JSON.stringify(got.images));
    // ٥) نتيجة من المعرفة العامّة ⇒ الزرّ يظهر (بلا نداء آليّ)
    productReply = MEMORY;
    await pg.evaluate(() => GMTBrain.productImportDialog(null, { url: '', name: 'فلاش', imageUrl: '' }));
    await pg.waitForSelector('#pi-go');
    const before = reqs.filter(b => b.mode === 'product_search').length; await run();
    s = await pg.evaluate(() => ({ btn: !!document.querySelector('[data-pi-cands-go]'), mem: !!document.querySelector('[data-pi-memory]') }));
    ok(s.btn && s.mem && reqs.filter(b => b.mode === 'product_search').length === before, '«ليست من صفحة المنتج» ⇒ زرّ «اعرض نتائج أختار منها» (بلا بحث مرشّحين آليّ)');
    const hs = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    ok(!hs, 'لا تمرير أفقيّ');
    const bad = errs.filter(e => !/Failed to load|favicon|404|ERR_|qrserver|vibrate/.test(e));
    ok(bad.length === 0, 'لا أخطاء JS: ' + JSON.stringify(bad.slice(0, 3)));
    await browser.close();
  }
  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
