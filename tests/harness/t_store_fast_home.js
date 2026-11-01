// (TASK-0300 · المالك seq 322) «لازم يحمل له أثناء الانترو، يفتح له الواجهة فوراً … وفي الخلفية تنزل»
// زائرٌ جديد (لا نسخة على جهازه) + كتالوج كامل بطيء ⇒ الواجهة من النسخة الخفيفة (gmt_store_home) وتُفتح · الكامل يحلّ محلّها · فتح منتج ينتظر تفاصيله
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const cats = [{ id: 'c1', name: 'عدسات', order: 1 }, { id: 'c2', name: 'إضاءة', order: 2 }];
const full = Array.from({ length: 8 }, (_, i) => ({ id: 's_' + i, name: 'منتج ' + i, price: 10 + i, images: [], category_id: i % 2 ? 'c2' : 'c1',
  specs: [{ label: 'الوزن', value: (100 + i) + ' غ' }], description: 'وصفٌ كامل للمنتج ' + i }));
const light = { categories: cats, banners: [], offers: [], branches: [], __light: true, products: full.map(p => { const x = Object.assign({}, p); delete x.specs; delete x.description; return x; }) };
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-01T10:00:00Z', categories: cats, banners: [], offers: [], branches: [], products: full }]);
  /* ① الخفيفة موجودة + الكامل يتأخّر ٦ ث */
  let o = await H.open('logo.jpg', { w: 390, h: 844, mobile: true, wait: 0 });      // صفحة محايدة أوّلاً: لا كتالوج محفوظ (زائرٌ جديد فعلاً)
  await o.ctx.route(/\/storage\/v1\/object\/public\/products-images\/store\/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(light) }));
  await o.ctx.route(/\/rest\/v1\/gmt_store\?/, async r => { await new Promise(z => setTimeout(z, 6000)); return r.fallback(); });
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' });
  const t0 = Date.now();
  await o.pg.waitForFunction(() => !document.getElementById('intro-screen') || getComputedStyle(document.getElementById('intro-screen')).visibility === 'hidden', null, { timeout: 15000 });
  const tIntro = Date.now() - t0;
  const a = await o.pg.evaluate(() => ({ light: !!store.__light, cards: [...document.querySelectorAll('h4')].filter(h => /^منتج \d/.test(h.textContent.trim())).length, secs: document.querySelectorAll('[data-category-section]').length }));
  ok(tIntro < 4000 && a.light && a.cards >= 8 && a.secs === 2, `الانترو أُغلق بعد ${tIntro} مللي على واجهةٍ مرسومة (منتجات ${a.cards} · أقسام ${a.secs}) قبل وصول الكتالوج الكامل`);
  /* (TASK-0293) فتح منتج والكامل لم يصل ⇒ يُفتح فوراً (الاسم/السعر) · والمواصفات تكتمل حين يصل الكامل بلا إغلاق */
  const t1 = Date.now();
  await o.pg.evaluate(() => openProductModal('s_3'));
  await o.pg.waitForFunction(() => { const m = document.getElementById('product-modal'); return m && !m.classList.contains('hidden') && /منتج 3/.test((document.getElementById('product-modal-name') || {}).textContent || ''); }, null, { timeout: 12000 });
  const opened = Date.now() - t1, b0 = await o.pg.evaluate(() => ({ light: !!store.__light, spec: /103 غ/.test(document.getElementById('product-modal').innerText) }));
  ok(opened < 1500 && b0.light && !b0.spec, `المنتج فُتح فوراً من الخفيفة (${opened} مللي) قبل وصول التفاصيل`);
  await o.pg.waitForFunction(() => /103 غ/.test(document.getElementById('product-modal').innerText), null, { timeout: 12000 });
  const b = await o.pg.evaluate(() => ({ light: !!store.__light, open: !document.getElementById('product-modal').classList.contains('hidden'), n: store.products.length }));
  ok(!b.light && b.open && b.n === 8, 'وصل الكامل ⇒ مواصفات المنتج (103 غ) ظهرت في النافذة نفسها وهي مفتوحة');
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  /* ② بلا نسخة خفيفة (الجدول غير موجود/فارغ) ⇒ كما كان تماماً */
  o = await H.open('logo.jpg', { w: 390, h: 844, mobile: true, wait: 0 });
  await o.ctx.route(/\/storage\/v1\/object\/public\/products-images\/store\/home\.json/, r => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' }));
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' });
  await o.pg.waitForFunction(() => !document.getElementById('intro-screen') || getComputedStyle(document.getElementById('intro-screen')).visibility === 'hidden', null, { timeout: 15000 });
  const c = await o.pg.evaluate(() => ({ light: !!store.__light, cards: [...document.querySelectorAll('h4')].filter(h => /^منتج \d/.test(h.textContent.trim())).length }));
  ok(!c.light && c.cards >= 8, 'بلا نسخة خفيفة ⇒ المسار القديم (الكتالوج الكامل) يعمل كما كان: ' + JSON.stringify(c));
  await o.browser.close();
  /* ④ (TASK-0293) زيارةٌ ثانية: الكتالوج المحفوظ يُرسم فوراً · «آخر تعديل» لم يتغيّر ⇒ لا تنزيل للكتالوج · تغيّر ⇒ تنزيلٌ بالخلفية */
  const lastGood = { at: Date.now() - 3600e3, rec: { id: 1, updated_at: '2026-11-01T10:00:00Z', categories: cats, banners: [], offers: [], branches: [], products: full } };
  for (const changed of [false, true]) {
    if (changed) await H.call('/rest/v1/gmt_store?id=eq.1', { updated_at: '2026-11-01T12:00:00Z', products: full.concat([{ id: 's_new', name: 'منتج جديد', price: 99, images: [], category_id: 'c1' }]) }, 'PATCH');
    o = await H.open('logo.jpg', { w: 390, h: 844, mobile: true, wait: 0 });
    await o.pg.goto(H.BASE + 'logo.jpg');
    await o.pg.evaluate(lg => { localStorage.setItem('gmt_store_last_good_v1', JSON.stringify(lg)); }, lastGood);
    let fulls = 0; o.ctx.on('request', r => { if (/\/rest\/v1\/gmt_store\?select=\*/.test(r.url())) fulls++; });
    const t2 = Date.now();
    await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' });
    await o.pg.waitForFunction(() => [...document.querySelectorAll('h4')].some(h => /^منتج \d/.test(h.textContent.trim())), null, { timeout: 8000 });
    const tDraw = Date.now() - t2;
    await o.pg.waitForTimeout(2500);
    const r4 = await o.pg.evaluate(() => ({ n: store.products.length, newP: [...document.querySelectorAll('h4')].some(h => /منتج جديد/.test(h.textContent)) }));
    if (!changed) ok(tDraw < 2500 && fulls === 0 && r4.n === 8, `زيارة ثانية بلا تغيير: رُسمت فوراً (${tDraw} مللي) ولم يُنزَّل الكتالوج (${fulls} طلب)`);
    else ok(fulls === 1 && r4.n === 9 && r4.newP, `زيارة ثانية والمتجر تغيّر: رُسمت فوراً ثمّ نُزّل الكتالوج مرّة وظهر الجديد (${fulls} طلب · ${r4.n} منتج)`);
    await o.browser.close();
  }
  /* ③ المنتِج: صفحة موظّف (الجرد) — البناء يحذف الثقيل · كلّ حفظٍ للمتجر ⇒ رفع store/home.json بعد ٣ ث */
  o = await H.open('inventory.html', { w: 1366, h: 900, mobile: false, wait: 4000 });
  const ups = [];
  await o.ctx.route(/\/storage\/v1\/object\/products-images\/store\/home\.json/, r => { ups.push(r.request().postData() || ''); r.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"x"}' }); });
  const built = await o.pg.evaluate(() => {
    const b = GMTStoreSync.homeBuild({ updated_at: 'U1', categories: [{ id: 'c1' }], products: [{ id: 'a', name: 'A', price: 5, images: ['data:image/png;base64,AAAA', '1', '2', '3', '4', '5'], specs: [{ label: 'x', value: 'y' }], description: 'طويل', alt_names: 'ب', options: [{ type: 'القطر', values: [{ name: '49', price: 3, specs: [1], inv_id: 'i1' }] }] }] });
    const p = b.products[0];
    return { light: b.__light, src: b.__src_updated_at, cats: b.categories.length, imgs: p.images.length, specs: 'specs' in p, desc: 'description' in p, alt: 'alt_names' in p, vSpecs: 'specs' in p.options[0].values[0], vPrice: p.options[0].values[0].price, name: p.name };
  });
  ok(built.light && built.src === 'U1' && built.cats === 1 && built.imgs === 3 && !built.specs && !built.desc && !built.alt && !built.vSpecs && built.vPrice === 3 && built.name === 'A',
    'البناء: بلا مواصفات/وصف/أسماء بديلة · ٣ صور · الخيارات بأسعارها بلا مواصفاتها · الأقسام كما هي');
  await o.pg.evaluate(async () => { const s = GMT_DB.STORE; await fetch(s.url + '/rest/v1/gmt_store?id=eq.1', { method: 'PATCH', headers: { apikey: s.key, Authorization: 'Bearer ' + s.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ updated_at: '2026-11-01T11:00:00Z' }) }); });
  await o.pg.waitForTimeout(5000);
  let up = null; try { up = JSON.parse(ups[ups.length - 1] || 'null'); } catch (_) {}
  ok(ups.length === 1 && up && up.__light && up.__src_updated_at === '2026-11-01T11:00:00Z' && up.products.length === 9 && !('specs' in up.products[0]), 'حفظٌ للمتجر من صفحة موظّف ⇒ رُفعت النسخة الخفيفة الجديدة مرّة واحدة (' + ups.length + ')');
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
