// TASK-0040 — رسالة المالك seq 46 «البحث بعلي بابا مو شغال» (لقطة: «—» · «الثقة: —» · «لم تُجمع مواصفات.»).
// الجذر على الخادم: ردٌّ فارغ {product:{}} بنجاحٍ 200 (بحث Google مرفوض لمفتاح Gemini المجاني). تحقّق الواجهة:
// ١) ردٌّ فارغ ⇒ رسالةٌ واضحة لا بطاقة «—» · ٢) 502 ⇒ السبب الحقيقي · ٣) مواصفات من معرفة الذكاء الاصطناعي ⇒ تنبيهٌ ظاهر «ليست من صفحة المنتج» ·
// ٤) نتيجة بحث Google ⇒ «من بحث Google» بلا تنبيه · ٥) «تطبيق» يحفظ المواصفات (بلا _meta) · ٦) الكتابة التلقائية من فاتورة الشراء لا تكتب ردّ «المعرفة العامّة».
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = async () => H.call('/__dump', undefined, 'GET');
const MEMORY = { product: { name_ar: 'دفيوزر فلاش سوفت بوكس 15×17 سم', name_en: '15x17cm Flash Diffuser Softbox', specs: [{ k: 'المقاس', v: '15×17 سم' }], compat: [], description_ar: 'وصف عامّ',
  images: [], source_url: '', confidence: 'low', notes: 'تعذّر البحث في الويب الآن (مفتاح Gemini الحالي لا يسمح بالبحث في Google) — هذه مواصفاتٌ عامّة من معرفة الذكاء الاصطناعي لا من صفحة المنتج: راجعها قبل التطبيق.' },
  searched: false, engine: 'memory', from_memory: true, page_ok: false, empty: false, sources: [], provider: 'gemini' };
const GOOGLE = { product: { name_ar: 'بطارية LP-E6NH', brand: 'Canon', specs: [{ k: 'السعة', v: '2130mAh' }], compat: ['Canon EOS R6'], confidence: 'high', images: [], source_url: 'https://www.alibaba.com/product-detail/x_1.html' },
  searched: true, engine: 'google', from_memory: false, page_ok: false, empty: false, sources: [{ uri: 'https://x', title: 'alibaba.com' }], provider: 'gemini' };

(async () => {
  for (const [w, mob] of [[390, true], [1366, false]]) {
    console.log('— ' + w);
    await H.seed();
    await H.call('/rest/v1/products', [{ name: 'دفيوزر فلاش', barcode: 'DF1', price: 10, wholesale_price: 6, haleb: 2, daraa: 1, group_name: 'g', category: 'c' }]);
    const { browser, ctx, pg, errs } = await H.open('inventory.html', { w, h: 900, mobile: mob, wait: 4000 });
    let reply = { status: 200, body: { product: {}, searched: false, empty: true } };
    let hits = 0;
    const brainRoute = r => { hits++; r.fulfill({ status: reply.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(reply.body) }); };
    await ctx.route('**/functions/v1/gmt-brain**', brainRoute);           // وسيط النظام نفسه (لا يُقبل غيره — GMTEndpoint)
    const id = await pg.evaluate(() => String(allProducts.find(p => p.barcode === 'DF1').id));
    const openDlg = async () => { await pg.evaluate(() => document.querySelectorAll('[data-keep-fab] [data-x]').forEach(b => b.click())); await pg.evaluate((id) => gmtSpecsFromAlibaba(id), id); await pg.waitForSelector('#pi-go', { timeout: 5000 }); };
    const run = async () => { await pg.click('#pi-go'); await pg.waitForFunction(() => !document.getElementById('pi-go').disabled, null, { timeout: 15000 }); await pg.waitForTimeout(200); };
    const state = () => pg.evaluate(() => ({ err: document.getElementById('pi-err').innerText.trim(), res: document.getElementById('pi-res').innerText.replace(/\s+/g, ' ').trim(),
      memory: !!document.querySelector('[data-pi-memory]'), src: (document.querySelector('[data-pi-src]') || {}).innerText || '', apply: !!document.querySelector('[data-apply]'),
      hs: document.documentElement.scrollWidth > innerWidth + 2 }));

    // ١) ردٌّ فارغ بنجاح (ما كان على الخادم الحيّ)
    await openDlg(); await run(); let s = await state();
    ok(hits === 1 && /لم يجد العقل مواصفاتٍ لهذا المنتج/.test(s.err) && !s.res && !s.apply, 'ردٌّ فارغ ⇒ رسالةٌ واضحة بلا بطاقة «—» ولا زرّ تطبيق: ' + s.err.slice(0, 60));
    // ٢) 502 بالسبب الحقيقي
    reply = { status: 502, body: { error: 'تعذّر البحث في الويب — gemini: HTTP 429 quota', code: 'search_unavailable' } };
    await run(); s = await state();
    ok(/تعذّر البحث في الويب/.test(s.err) && /429/.test(s.err) && !s.apply, '502 ⇒ السبب الحقيقي ظاهر: ' + s.err.slice(0, 60));
    // ٣) معرفة عامّة ⇒ تنبيهٌ ظاهر
    reply = { status: 200, body: MEMORY };
    await run(); s = await state();
    ok(s.memory && /ليست من صفحة المنتج/.test(s.res) && /15×17/.test(s.res) && s.apply && !s.src, 'معرفة عامّة ⇒ تنبيه «ليست من صفحة المنتج» + المواصفات + زرّ تطبيق (بلا «من بحث»)');
    ok(!s.hs, 'لا تمرير أفقيّ');
    if (w === 390) await pg.screenshot({ path: __dirname + '/alibaba_memory_390.png' });
    // ٥) التطبيق يحفظ المواصفات بلا _meta
    await pg.click('[data-apply]'); await pg.waitForTimeout(1500);
    const prod = (await dump()).products.find(p => String(p.id) === id) || {};
    ok(prod.specs && prod.specs['المقاس'] === '15×17 سم' && !JSON.stringify(prod).includes('_meta'), '«تطبيق» يحفظ المواصفات على المنتج (بلا _meta): ' + JSON.stringify(prod.specs || null).slice(0, 80));
    // ٤) بحث Google حقيقي
    reply = { status: 200, body: GOOGLE };
    await openDlg(); await run(); s = await state();
    ok(!s.memory && /من بحث Google/.test(s.src) && /LP-E6NH/.test(s.res), 'نتيجة بحث Google ⇒ «🔎 من بحث Google» بلا تنبيه');
    const bad = errs.filter(e => !/Failed to load|favicon|404|ERR_|qrserver/.test(e));
    ok(bad.length === 0, 'لا أخطاء JS: ' + JSON.stringify(bad.slice(0, 3)));
    await browser.close();
  }

  // ٦) فاتورة الشراء: العقل يكتب المواصفات تلقائياً — لكن لا يكتب ردّ «المعرفة العامّة»
  console.log('— purchase auto');
  await H.seed();
  await H.call('/rest/v1/products', [{ name: 'منتج جديد أ', barcode: 'NA1', price: 5, wholesale_price: 3 }, { name: 'منتج جديد ب', barcode: 'NB1', price: 5, wholesale_price: 3 }]);
  const all = (await dump()).products; const a = all.find(p => p.barcode === 'NA1'), b = all.find(p => p.barcode === 'NB1');
  const { browser, ctx, pg } = await H.open('purchase.html', { w: 1366, mobile: false, wait: 3500 });
  const autoRoute = r => { const q = JSON.parse(r.request().postData() || '{}');
    const body = /منتج جديد أ/.test(q.hint) ? MEMORY : GOOGLE;
    r.fulfill({ status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) }); };
  await ctx.route('**/functions/v1/gmt-brain**', autoRoute);
  await pg.evaluate(async (l) => { await gmtAutoCompat(l); }, [{ id: a.id, name: a.name }, { id: b.id, name: b.name }]);
  const after = (await dump()).products;
  const pa = after.find(p => p.id === a.id), pb = after.find(p => p.id === b.id);
  ok(!pa.specs && !pa.compat, 'ردّ «المعرفة العامّة» لا يُكتب تلقائياً على المنتج: ' + JSON.stringify({ specs: pa.specs || null, compat: pa.compat || null }));
  ok(pb.specs && pb.specs['السعة'] === '2130mAh' && /EOS R6/.test(pb.compat || ''), 'ونتيجة البحث الحقيقي تُكتب كما كانت');
  await browser.close();

  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
