// (TASK-0212 · المالك seq 140) «زر العرض في المتجر عاطل» — لقطة 404: رابط المتجر المحفوظ «index__12_.html#product=…» (ملفٌّ قديم غير موجود)
// ① GMTUtil.storeLink: النسبيّ/القديم ⇒ store.html على المنتج نفسه · المطلق كما هو ② أزرار الجرد ونقطة البيع ③ الجسر: اسم ملفٍّ محفوظ غير موجود ⇒ store.html
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  const { prods } = await H.seed();
  const A = prods[0], B = prods[1], C = prods[2];
  await H.call('/rest/v1/products?id=eq.' + A.id, { store_url: 'index__12_.html#product=s_a' }, 'PATCH');
  await H.call('/rest/v1/products?id=eq.' + B.id, { store_url: '#product=s_b' }, 'PATCH');
  await H.call('/rest/v1/products?id=eq.' + C.id, { store_url: 'https://amredeveloper.github.io/general_home/#product=s_c' }, 'PATCH');
  const { browser, pg, errs } = await H.open('inventory.html', { w: 390, h: 844, wait: 5000, init: H.ADMIN_INIT });
  const base = await pg.evaluate(() => new URL('store.html', location.href).href);
  const u = await pg.evaluate(() => ['index__12_.html#product=s_a', '#product=p%20x', 'store.html#product=s9', 'https://x.example/shop/#product=1', '', 'index (12).html'].map(GMTUtil.storeLink));
  ok(u[0] === base + '#product=s_a' && u[1] === base + '#product=p%20x' && u[2] === base + '#product=s9' && u[3] === 'https://x.example/shop/#product=1' && u[4] === '' && u[5] === base,
    'storeLink: القديم والنسبيّ ⇒ store.html على المنتج · المطلق كما هو: ' + JSON.stringify(u.map(x => x.replace(base, '<store>'))));
  const hrefOf = async id => { await pg.evaluate(i => openDetailModal(i), id); await pg.waitForTimeout(700); const h = await pg.evaluate(() => { const a = [...document.querySelectorAll('#detail-modal-body a[target="_blank"]')].find(x => /المتجر/.test(x.textContent)); return a && a.getAttribute('href'); }); await pg.evaluate(() => { try { closeDetailModal(); } catch (_) {} }); return h; };
  const hA = await hrefOf(A.id), hB = await hrefOf(B.id), hC = await hrefOf(C.id);
  ok(hA === base + '#product=s_a' && hB === base + '#product=s_b' && hC === 'https://amredeveloper.github.io/general_home/#product=s_c', 'الجرد «عرض المنتج في المتجر»: ' + JSON.stringify([hA, hB, hC].map(x => String(x).replace(base, '<store>'))));
  // الصفحة المستهدفة موجودة فعلاً (لا 404)
  const st = await pg.evaluate(async u => (await fetch(u.split('#')[0], { method: 'HEAD' })).status, hA);
  ok(st === 200, 'صفحة المتجر الهدف موجودة: HTTP ' + st);
  await browser.close();
  // نقطة البيع
  const P = await H.open('pos.html', { w: 390, h: 844, wait: 5000, init: H.STAFF_INIT });
  await P.pg.evaluate(id => openProductDetail(id), A.id); await P.pg.waitForTimeout(600);
  const hp = await P.pg.evaluate(() => { const a = [...document.querySelectorAll('#pd-content a[target="_blank"]')].find(x => /في المتجر/.test(x.textContent)); return a && a.getAttribute('href'); });
  ok(hp === base + '#product=s_a', 'نقطة البيع «عرض في المتجر» ⇒ store.html: ' + String(hp).replace(base, '<store>'));
  await P.browser.close();
  // الجسر: اسم ملفٍّ محفوظ غير موجود ⇒ يعود store.html · الموجود يبقى
  for (const [saved, want] of [['index__12_.html', 'store.html'], ['store.html', 'store.html'], ['inventory.html', 'inventory.html']]) {
    const Bq = await H.open('bridge.html', { w: 1100, h: 800, mobile: false, wait: 3000, init: H.ADMIN_INIT + `try{localStorage.setItem('br_storefront_file','${saved}')}catch(e){}` });
    const v = await Bq.pg.evaluate(() => localStorage.getItem('br_storefront_file'));
    ok(v === want, 'الجسر: المحفوظ «' + saved + '» ⇒ «' + v + '»');
    await Bq.browser.close();
  }
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
