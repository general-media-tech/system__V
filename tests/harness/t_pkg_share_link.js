// (TASK-A0506 · المالك seq 747) «البكج يتعامل معاملة القطع الفردية — بشارك رابطه»:
// رابط الباقة store.html#package=<id> يفتح صفحتها · زرّ مشاركة في نافذتها · نقطة البيع تعطيها store_url كالمنتج.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const NOISE = /vibrate|favicon|net::ERR|Failed to load resource/i;
const SHARE = ';window.__sh=null;navigator.share=function(d){window.__sh=d;return Promise.resolve();};';
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [
    { name: 'كاميرا باقة-رابط', barcode: 'PL-A', price: 700, net_cost: 500, daraa: 4 },
    { name: 'عدسة باقة-رابط', barcode: 'PL-B', price: 200, net_cost: 100, daraa: 5 }]);
  await H.call('/rest/v1/gmt_store', [{ id: 1, categories: [{ id: 'c_bundles', name: 'باقات وعروض' }, { id: 'c1', name: 'كاميرات' }], products: [
    { id: 's1', name: 'منتج متجر', price: 10, category_ids: ['c1'], images: [] }], banners: [] }]);
  const mk = (name, store) => H.call('/rest/v1/gmt_offers', { name, offer_type: 'bundle', offer_price: 800, original_price: 900, is_active: true,
    targets: { pos: true, store, mode: 'price' },
    products: JSON.stringify([{ id: A.id, name: A.name, qty: 1 }, { id: B.id, name: B.name, qty: 1 }]) });
  const r1 = await mk('باقة رابط المشاركة', true); const r2 = await mk('باقة بلا متجر', false);
  const one = r => Array.isArray(r) ? r[0] : r;
  const P1 = one(r1), P2 = one(r2);
  const id = String(P1.id);

  console.log('① فتح رابط الباقة');
  let { browser, pg, errs } = await H.open('store.html#package=' + encodeURIComponent(id), { init: H.STAFF_INIT + SHARE, w: 390, mobile: true, wait: 7000 });
  await pg.waitForTimeout(1500);
  const o1 = await pg.evaluate(() => { const m = document.getElementById('package-modal'); return { act: !!(m && m.classList.contains('active')), txt: m ? m.innerText : '' }; });
  ok(o1.act && /باقة رابط المشاركة/.test(o1.txt), '#package=<id> يفتح نافذة الباقة وفيها اسمها');

  console.log('② زرّ المشاركة');
  ok(!!(await pg.$('#package-share-btn')), 'زرّ #package-share-btn موجود');
  await pg.click('#package-share-btn'); await pg.waitForTimeout(400);
  const sh = await pg.evaluate(() => window.__sh);
  ok(sh && new RegExp('#package=' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$').test(sh.url) && /باقة رابط المشاركة/.test(sh.title), 'navigator.share يستلم url ينتهي بـ#package=<id>: ' + JSON.stringify(sh));

  /* (TASK-A0508 · المالك seq 752) «اسأل جوجل» في صفحة الباقة كما في صفحة المنتج */
  const ask = await pg.evaluate(async () => {
    const f = document.getElementById('pkg-ai-fab'); const got = []; const wo = window.open; window.open = (u) => { got.push(u); return null; };
    if (f) f.click(); await new Promise(r => setTimeout(r, 300)); window.open = wo;
    const r = f ? f.getBoundingClientRect() : null;
    return { has: !!f, vis: !!(r && r.width > 30 && r.height > 20), url: got[0] ? decodeURIComponent(got[0]) : '' };
  });
  ok(ask.has && ask.vis, 'زرّ «اسأل جوجل» ظاهر في صفحة الباقة');
  ok(/google\.com\/search\?udm=50/.test(ask.url) && /General Media Tech/.test(ask.url) && /تتضمّن:/.test(ask.url) && !/https?:\/\/\S+.*https?:\/\//.test(ask.url.replace(/^https:\/\/www\.google\.com/, '')), 'يفتح سؤال جوجل باسم الباقة ومنتجاتها بلا روابط: ' + ask.url.slice(40, 190));
  console.log('③ الإغلاق');
  await pg.evaluate(() => closeModal('package-modal')); await pg.waitForTimeout(300);
  const h3 = await pg.evaluate(() => ({ hash: location.hash, act: document.getElementById('package-modal').classList.contains('active') }));
  ok(h3.hash === '' && !h3.act, 'إغلاق النافذة ⇒ location.hash فارغ');
  const real1 = errs.filter(x => !NOISE.test(x));
  ok(!real1.length, 'لا أخطاء JS: ' + JSON.stringify(real1.slice(0, 2)));
  await browser.close();

  console.log('④ باقة غير موجودة');
  ({ browser, pg, errs } = await H.open('store.html#package=' + encodeURIComponent('لا-يوجد'), { init: H.STAFF_INIT + SHARE, w: 390, mobile: true, wait: 7000 }));
  await pg.waitForTimeout(1500);
  const o4 = await pg.evaluate(() => { const m = document.getElementById('package-modal'); return !!(m && m.classList.contains('active')); });
  const real4 = errs.filter(x => !NOISE.test(x));
  ok(!o4 && !real4.length, 'لا نافذة نشطة ولا خطأ JS: ' + JSON.stringify(real4.slice(0, 2)));
  await browser.close();

  console.log('⑤ تراجع: رابط المنتج');
  ({ browser, pg, errs } = await H.open('store.html#product=s1', { init: H.STAFF_INIT + SHARE, w: 390, mobile: true, wait: 7000 }));
  await pg.waitForTimeout(1500);
  const o5 = await pg.evaluate(() => { const m = document.getElementById('product-modal'); return !!(m && m.classList.contains('active')); });
  const real5 = errs.filter(x => !NOISE.test(x));
  ok(o5 && !real5.length, '#product=s1 ما زال يفتح نافذة المنتج بلا أخطاء');
  await browser.close();

  console.log('⑥ GMTUtil.storeLink');
  ({ browser, pg, errs } = await H.open('store.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 5000 }));
  const sl = await pg.evaluate(() => ({ a: GMTUtil.storeLink('store.html#package=5'), b: GMTUtil.storeLink('store.html#product=abc'), c: GMTUtil.storeLink('store.html#package=5', true) }));
  ok(/store\.html/.test(sl.a) && /#package=5/.test(sl.a), 'storeLink(package) ⇒ ' + sl.a);
  ok(/#product=abc/.test(sl.b), 'storeLink(product) ما زال يعمل ⇒ ' + sl.b);
  ok(/#package=5$/.test(sl.c) && !/direct/.test(sl.c), 'رابط الزبون للباقة بلا direct ⇒ ' + sl.c);
  await browser.close();

  console.log('⑦ نقطة البيع');
  ({ browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 }));
  const offs = await pg.evaluate(() => allProducts.filter(p => p._is_offer).map(p => ({ id: p.id, url: p.store_url })));
  const f1 = offs.find(x => x.id === 'OFFER_' + P1.id), f2 = offs.find(x => x.id === 'OFFER_' + P2.id);
  ok(f1 && new RegExp('#package=' + id + '$').test(f1.url || ''), 'باقة store:true ⇒ store_url يحوي #package=<id>: ' + JSON.stringify(f1));
  ok(f2 && !f2.url, 'باقة store:false ⇒ store_url فارغ: ' + JSON.stringify(f2));
  /* صفحة تفاصيل الباقة في نقطة البيع: «مشاركة رابطه» يظهر ويشارك رابط الزبون #package= — والباقة غير المعروضة في المتجر بلا زرّ */
  const d7 = await pg.evaluate(async (ids) => {
    const got = []; navigator.share = async (o) => { got.push(o.url); };
    openProductDetail(ids.a); await new Promise(r => setTimeout(r, 500));
    const b1 = document.querySelector('[data-store-share]'); if (b1) b1.click(); await new Promise(r => setTimeout(r, 300));
    try { closeProductDetail(); } catch (_) {}
    openProductDetail(ids.b); await new Promise(r => setTimeout(r, 500));
    const b2 = !!document.querySelector('[data-store-share]'); try { closeProductDetail(); } catch (_) {}
    return { has1: !!b1, got, has2: b2 };
  }, { a: 'OFFER_' + P1.id, b: 'OFFER_' + P2.id });
  ok(d7.has1 && d7.got.length === 1 && new RegExp('store\\.html#package=' + id + '$').test(d7.got[0]) && !/direct/.test(d7.got[0]), 'تفاصيل الباقة في نقطة البيع: «مشاركة رابطه» يشارك ' + JSON.stringify(d7.got));
  ok(!d7.has2, 'باقة غير معروضة في المتجر ⇒ لا زرّ مشاركة');
  const real7 = errs.filter(x => !NOISE.test(x));
  ok(!real7.length, 'لا أخطاء JS في نقطة البيع: ' + JSON.stringify(real7.slice(0, 2)));
  await browser.close();

  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
