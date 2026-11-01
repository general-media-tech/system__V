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
  await H.call('/rest/v1/gmt_store_home', [{ id: 1, data: light, src_updated_at: '2026-11-01T10:00:00Z' }]);
  let o = await H.open('store.html', { w: 390, h: 844, mobile: true, wait: 0 });
  await o.ctx.route(/\/rest\/v1\/gmt_store\?/, async r => { await new Promise(z => setTimeout(z, 6000)); return r.fallback(); });
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  const t0 = Date.now();
  await o.pg.waitForFunction(() => !document.getElementById('intro-screen') || getComputedStyle(document.getElementById('intro-screen')).visibility === 'hidden', null, { timeout: 15000 });
  const tIntro = Date.now() - t0;
  const a = await o.pg.evaluate(() => ({ light: !!store.__light, cards: [...document.querySelectorAll('h4')].filter(h => /^منتج \d/.test(h.textContent.trim())).length, secs: document.querySelectorAll('[data-category-section]').length }));
  ok(tIntro < 4000 && a.light && a.cards >= 8 && a.secs === 2, `الانترو أُغلق بعد ${tIntro} مللي على واجهةٍ مرسومة (منتجات ${a.cards} · أقسام ${a.secs}) قبل وصول الكتالوج الكامل`);
  /* فتح منتج والكامل لم يصل ⇒ ينتظر ثمّ يُفتح بتفاصيله */
  await o.pg.evaluate(() => openProductModal('s_3'));
  await o.pg.waitForFunction(() => { const m = document.getElementById('product-modal'); return m && !m.classList.contains('hidden') && /منتج 3/.test((document.getElementById('product-modal-name') || {}).textContent || ''); }, null, { timeout: 12000 });
  const b = await o.pg.evaluate(() => ({ light: !!store.__light, spec: /103 غ/.test(document.getElementById('product-modal').innerText), n: store.products.length }));
  ok(!b.light && b.spec && b.n === 8, 'فتح منتج أثناء التحميل ⇒ انتظر الكامل وعرض مواصفاته (103 غ) · المرجع صار الكامل');
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  /* ② بلا نسخة خفيفة (الجدول غير موجود/فارغ) ⇒ كما كان تماماً */
  await H.call('/__reset_table', { table: 'gmt_store_home' }).catch(() => {});
  o = await H.open('store.html', { w: 390, h: 844, mobile: true, wait: 0 });
  await o.ctx.route(/\/rest\/v1\/gmt_store_home\?/, r => r.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"relation does not exist"}' }));
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  await o.pg.waitForFunction(() => !document.getElementById('intro-screen') || getComputedStyle(document.getElementById('intro-screen')).visibility === 'hidden', null, { timeout: 15000 });
  const c = await o.pg.evaluate(() => ({ light: !!store.__light, cards: [...document.querySelectorAll('h4')].filter(h => /^منتج \d/.test(h.textContent.trim())).length }));
  ok(!c.light && c.cards >= 8, 'بلا نسخة خفيفة ⇒ المسار القديم (الكتالوج الكامل) يعمل كما كان: ' + JSON.stringify(c));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
