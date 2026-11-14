// (TASK-B0380 · المالك seq B655 ⇒ TASK-B0382 · seq B672: داخل «باقات وعروض» · صورة مجمّعة لا صورة منتج واحد) عرض الطقم: «خذ هالمنتجات مع بعض بخمسمية بدل ستمية تقريباً … الخصم ما يكون فوراً … ارسل للحصول على عرض سعر»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const IMGS = require('fs').readdirSync(require('path').join(__dirname, '..', '..', 'img/p')).filter(f => /^lens_.*\.(jpg|png)$/.test(f)).slice(0, 16);
const cats = [{ id: 'c_bundles', name: 'باقات وعروض', order: -1 }].concat(Array.from({ length: 4 }, (_, i) => ({ id: 'c' + i, name: 'قسم ' + i, order: i })));
const prods = [];
cats.filter(c => c.id !== 'c_bundles').forEach((c, ci) => { for (let k = 0; k < 4; k++) prods.push({ id: `p${ci}_${k}`, name: `منتج ${ci}-${k}`, price: 100 * (k + 1), category_id: c.id, images: [H.BASE + 'img/p/' + IMGS[(ci * 4 + k) % IMGS.length]] }); });
const kits = { built_at: '2026-11-14T10:00:00Z', kits: {
  p0_0: { ids: ['p0_0', 'p1_0', 'p2_0'], sum: 300, offer: 255 },      // صالح: 300 ⇒ 255
  p1_1: { ids: ['p1_1', 'p3_0'], sum: 300, offer: 270 },              // صالح من قسم آخر
  p2_1: { ids: ['p2_1', 'p3_1'], sum: 999, offer: 800 },              // قديم: السعر تغيّر ⇒ لا يُعرض
  p3_2: { ids: ['p3_2', 'غائب'], sum: 400, offer: 350 },              // قطعة غائبة ⇒ لا يُعرض
} };
const st = { categories: cats, banners: [], offers: [], branches: [], products: prods };
const VISITOR = `try{ localStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  const o = await H.open('logo.jpg', { init: VISITOR + `window.__wa=[];window.open=function(u){window.__wa.push(u);return null};`, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  let kitReq = 0;
  await o.ctx.route(/store\/kits\.json/, r => { kitReq++; r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(kits) }); });
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' });
  await o.pg.waitForTimeout(4500);
  const ad = await o.pg.evaluate(() => { const s = document.querySelector('section[data-category-section="c_bundles"]'); if (!s) return null;
    const order = [...document.querySelectorAll('[data-container="products-area"] > section[data-category-section]')].map(x => x.dataset.categorySection);
    return { order, old: !!document.querySelector('[data-category-section="__kits"]'), title: s.querySelector('h3').textContent,
      cards: [...s.querySelectorAll('[data-kit-card] .kc')].map(c => ({ id: c.dataset.kit, imgs: c.querySelectorAll('.im img').length, txt: c.innerText.replace(/\s+/g, ' ') })) }; });
  ok(ad && ad.cards.length === 2 && !ad.old, '① الأطقم داخل صفّ «باقات وعروض» (لا قسم مستقلّ) وبالصالحة فقط (2 من 4) ' + JSON.stringify(ad && ad.cards.map(c => c.id)));
  ok(ad && ad.order[0] === 'c_bundles' && ad.title === 'باقات وعروض', '① صفّ «باقات وعروض» في موضعه بين الأقسام ' + JSON.stringify(ad && ad.order));
  ok(ad && ad.cards[0].imgs === 3 && ad.cards[1].imgs === 2, '① صورة البطاقة مجمّعة من كلّ قطع الطقم (لا صورة منتج واحد) ' + JSON.stringify(ad && ad.cards.map(c => c.imgs)));
  ok(ad && ad.cards[0].id === 'p0_0' && /299\.97/.test(ad.cards[0].txt) && /255/.test(ad.cards[0].txt) && /−15%/.test(ad.cards[0].txt) && /طقم 3 قطع/.test(ad.cards[0].txt) && /منتج 0-0 \+ منتج 1-0 \+ منتج 2-0/.test(ad.cards[0].txt), '① البطاقة: أكبر وفرٍ أوّلاً · المجموع مشطوب · بحوالي السعر · نسبة الوفر · عدد القطع ' + (ad && ad.cards[0].txt));
  ok(kitReq === 1, '① kits.json يُطلب مرّة واحدة ' + kitReq);
  // ② صفحة المنتج
  await o.pg.evaluate(() => document.querySelector('[data-kit-card] .kc[data-kit="p0_0"]').click());
  await o.pg.waitForTimeout(1500);
  const pm = await o.pg.evaluate(() => { const w = document.getElementById('pm-kit'); return { shown: w && !w.classList.contains('hidden'), txt: w ? w.innerText.replace(/\s+/g, ' ') : '', items: w ? w.querySelectorAll('.pk-it').length : 0 }; });
  ok(pm.shown && pm.items === 3 && /وفّر حوالي \$45/.test(pm.txt) && /بحوالي \$255/.test(pm.txt) && /\$299\.97/.test(pm.txt), '② صفحة المنتج: «عرض الطقم» بقطعه الثلاث والمجموع وبحوالي والوفر ' + pm.txt.slice(0, 140));
  ok(/لا يُطبَّق تلقائياً/.test(pm.txt) && !/تكلفة|cost/i.test(pm.txt), '② مكتوب أنّه تقريبي ولا يُطبَّق على السلّة · ولا ذكر للتكلفة');
  const cart0 = await o.pg.evaluate(() => store.cart.length);
  await o.pg.evaluate(() => document.querySelector('#pm-kit button').click());
  const wa = await o.pg.evaluate(() => window.__wa.slice(-1)[0] || '');
  const t = decodeURIComponent((wa.split('text=')[1] || ''));
  ok(/^https:\/\/wa\.me\/\d+\?text=/.test(wa) && /أرغب بعرض سعر لهذا الطقم/.test(t) && /منتج 0-0/.test(t) && /منتج 1-0/.test(t) && /منتج 2-0/.test(t) && /حوالي \$255/.test(t) && /#product=p0_0/.test(t), '③ الزرّ يفتح واتساب برسالة طلب عرض سعر فيها القطع والمجموع والسعر المقترح والرابط');
  const cart1 = await o.pg.evaluate(() => store.cart.length);
  ok(cart0 === cart1, '③ لا شيء يُضاف للسلّة بسعرٍ مخفّض (الخصم ليس فورياً)');
  // ④ منتج طقمه قديم ⇒ لا بطاقة
  await o.pg.evaluate(() => openProductModal('p2_1')); await o.pg.waitForTimeout(900);
  const stale = await o.pg.evaluate(() => document.getElementById('pm-kit').classList.contains('hidden'));
  ok(stale, '④ طقمٌ تغيّر سعر قطعه ⇒ لا يُعرض (لا وعد بسعرٍ قديم)');
  await o.pg.evaluate(() => { try { closeProductModal(); } catch (_) {} });
  // ⑤ البحث يخفي الإعلان
  await o.pg.evaluate(() => performSearch('منتج'));
  const hid = await o.pg.evaluate(() => document.querySelector('[data-category-section="c_bundles"]').style.display === 'none');
  await o.pg.evaluate(() => performSearch(''));
  const back = await o.pg.evaluate(() => document.querySelector('[data-category-section="c_bundles"]').style.display === '');
  ok(hid && back, '⑤ يختفي مع البحث ويعود بعد مسحه');
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  // ⑥ لا ملفّ أطقم ⇒ لا شيء ولا خطأ
  const o2 = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  await o2.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await o2.ctx.route(/store\/kits\.json/, r => r.fulfill({ status: 404, body: '' }));
  await o2.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await o2.pg.waitForTimeout(4000);
  await o2.pg.evaluate(() => openProductModal('p0_0')); await o2.pg.waitForTimeout(800);
  const none = await o2.pg.evaluate(() => ({ ad: !!document.querySelector('[data-kit-card]'), pm: document.getElementById('pm-kit').classList.contains('hidden') }));
  const real2 = o2.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
  ok(!none.ad && none.pm && !real2.length, '⑥ بلا kits.json: لا إعلان ولا بطاقة ولا أخطاء ' + JSON.stringify(none));
  await o2.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
