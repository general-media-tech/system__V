// (TASK-B0379 · المالك seq B655) «المتجر ما بيخلص … كل ما نزل بيعيد له الصفوف ديناميكياً. الأقسام بتبلش بتنعاد»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const cats = Array.from({ length: 10 }, (_, i) => ({ id: 'c' + i, name: 'قسم ' + i, order: i }));
const prods = [];
cats.forEach((c, ci) => { for (let k = 0; k < 6; k++) prods.push({ id: `p${ci}_${k}`, name: `منتج ${ci}-${k}`, price: 10 + k, category_id: c.id, category_orders: { [c.id]: k } }); });
const st = { categories: cats, banners: [], offers: [], branches: [], products: prods };
const VISITOR = `try{ localStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
const info = () => ({
  orig: [...document.querySelectorAll('section[data-category-section]')].map(s => s.dataset.categorySection),
  rep: [...document.querySelectorAll('section[data-cat-repeat]')].map(s => ({ c: s.dataset.catRepeat, y: +s.dataset.endlessCycle, first: s.querySelector('h4,.line-clamp-2') ? '' : '', n: s.querySelectorAll('.quick-cart-btn').length })),
  divs: document.querySelectorAll('.endless-div').length, h: document.documentElement.scrollHeight,
});
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' });
  await o.pg.waitForTimeout(4000);
  const a = await o.pg.evaluate(info);
  ok(a.orig.length === 10, 'الأقسام الأصلية مرسومة (10) ' + a.orig.length);
  const bottom = async (k) => { for (let i = 0; i < k; i++) { await o.pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await o.pg.waitForTimeout(350); } };
  await bottom(4);
  const b = await o.pg.evaluate(info);
  ok(b.rep.length >= 4 && b.divs >= 1, '① عند الوصول للأسفل تُضاف الأقسام من جديد: ' + b.rep.length + ' قسماً مكرّراً · فواصل ' + b.divs);
  ok(b.orig.length === 10, '① المكرَّر لا يحمل data-category-section (شريط الأقسام يقفز للأصل)');
  ok(b.rep.every(r => r.n === 6), '① كلّ قسم مكرّر فيه كلّ منتجاته (6) ' + JSON.stringify(b.rep.map(r => r.n)));
  await bottom(12);
  const c = await o.pg.evaluate(info);
  const cyc1 = c.rep.filter(r => r.y === 1).map(r => r.c), cyc2 = c.rep.filter(r => r.y === 2).map(r => r.c);
  ok(cyc1.length === 10 && new Set(cyc1).size === 10, '② الدورة الأولى تعيد كلّ الأقسام مرّة واحدة (لا قسم مرّتين قبل مرور الكلّ) ' + cyc1.join(','));
  ok(cyc1.join() !== a.orig.join(), '② ترتيب الدورة مختلف عن الأصل (لا تكرار حرفي)');
  ok(cyc2.length > 0 && cyc2[0] !== cyc1[cyc1.length - 1], '② لا يتلاصق القسم نفسه بين دورتين ' + cyc1[cyc1.length - 1] + ' ⇒ ' + cyc2[0]);
  const firsts = await o.pg.evaluate(() => { const o1 = document.querySelector('section[data-category-section="c3"] .quick-cart-btn')?.dataset.prodId; const r1 = document.querySelector('section[data-cat-repeat="c3"][data-endless-cycle="1"] .quick-cart-btn')?.dataset.prodId; return [o1, r1]; });
  ok(firsts[0] && firsts[1] && firsts[0] !== firsts[1], '② الصفّ المكرّر يبدأ من منتجٍ مختلف ' + JSON.stringify(firsts));
  // البحث: يخفي المكرَّر ولا يضيف
  const before = c.rep.length;
  await o.pg.evaluate(() => performSearch('منتج 3'));
  await bottom(4);
  const s = await o.pg.evaluate(() => ({ hid: document.getElementById('store-endless').style.display === 'none', n: document.querySelectorAll('section[data-cat-repeat]').length, sr: !!document.getElementById('search-results-section') }));
  ok(s.hid && s.sr && s.n === before, '③ أثناء البحث: المكرَّر مخفيّ ولا يُضاف شيء ' + JSON.stringify(s) + ' قبل=' + before);
  await o.pg.evaluate(() => performSearch(''));
  await bottom(3);
  const s2 = await o.pg.evaluate(() => ({ shown: document.getElementById('store-endless').style.display === '', n: document.querySelectorAll('section[data-cat-repeat]').length }));
  ok(s2.shown && s2.n > before, '③ بعد مسح البحث يعود ويكمل ' + JSON.stringify(s2));
  // إعادة الرسم (تحديث البيانات) لا تترك مكرّراً قديماً
  await o.pg.evaluate(() => renderProducts());
  const r = await o.pg.evaluate(() => ({ n: document.querySelectorAll('section[data-cat-repeat]').length, w: document.querySelectorAll('#store-endless').length }));
  ok(r.w === 1, '④ إعادة رسم المتجر تبدأ من جديد بلا تكرار للمراقب ' + JSON.stringify(r));
  // سقف الحماية
  await o.pg.evaluate(() => { _endless.added = 239; });
  await bottom(3);
  const cap = await o.pg.evaluate(() => _endless.added);
  ok(cap <= 243 && cap >= 240, '⑤ سقف 240 قسماً مكرّراً ثمّ يتوقّف ' + cap);
  // السلة: زرّ السلّة في النسخة المكرّرة يعمل
  const cart = await o.pg.evaluate(async () => { const b = document.querySelector('section[data-cat-repeat] .quick-cart-btn'); const id = b.dataset.prodId; b.click(); await new Promise(z => setTimeout(z, 600)); return store.cart.some(x => String(x.id) === String(id)); });
  ok(cart, '⑥ الإضافة للسلّة من القسم المكرّر تعمل');
  const sync = await o.pg.evaluate(async () => { const b = document.querySelector('section[data-cat-repeat] .quick-cart-btn'); const id = b.dataset.prodId;
    const all = [...document.querySelectorAll('.quick-cart-btn')].filter(x => x.dataset.prodId === id); const inH = all.map(x => x.innerHTML);
    removeFromCart(id); await new Promise(z => setTimeout(z, 300)); const outH = all.map(x => x.innerHTML);
    return { copies: all.length, sameIn: new Set(inH).size === 1, changed: outH.every((h, i) => h !== inH[i]) }; });
  ok(sync.copies >= 2 && sync.sameIn && sync.changed, '⑥ (صيد نمط) زرّ السلّة يتحدّث في كلّ نسخ المنتج بعد الإضافة والحذف ' + JSON.stringify(sync));
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
