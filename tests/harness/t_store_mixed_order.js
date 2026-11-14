// (TASK-B0400 · seq B700/B702) «في البداية اعرض كل المنتجات ثم الأقسام اللي فيها تكرارات أو خلط» + بانر (هيدر) القسم الرئيسي ذي الفروع
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const now = Date.now();
const cats = [
  { id: 'MIX', name: 'جامع حسب الاستخدام', order: 1 },
  { id: 'A', name: 'قسم أ', order: 2, banners: [{ image: H.BASE + 'canonlogo.png', link: '' }] }, { id: 'A1', name: 'أ فرعي', parent_id: 'A', order: 3 }, { id: 'A2', name: 'أ فرعي ٢', parent_id: 'A', order: 4 },
  { id: 'B', name: 'قسم ب', order: 5 }, { id: 'C', name: 'قسم ج', order: 6 },
];
const prods = [];
for (let k = 0; k < 4; k++) prods.push({ id: 'p_' + (now - k * 1000), name: 'أ ' + k, price: 10, category_ids: ['A1', 'MIX'], category_id: 'A1', images: [H.BASE + 'logo.png'] });
for (let k = 0; k < 4; k++) prods.push({ id: 'b' + k, name: 'ب ' + k, price: 10, category_ids: ['B', 'MIX'], category_id: 'B', images: [H.BASE + 'logo.png'] });
for (let k = 0; k < 3; k++) prods.push({ id: 'a2' + k, name: 'أ٢ ' + k, price: 10, category_id: 'A2', images: [H.BASE + 'logo.png'] });
for (let k = 0; k < 3; k++) prods.push({ id: 'c' + k, name: 'ج ' + k, price: 10, category_ids: k === 0 ? ['C', 'B'] : ['C'], category_id: 'C', images: [H.BASE + 'logo.png'] });   // قطعة واحدة مشتركة ⇒ أصليّ
const st = { categories: cats, banners: [], offers: [], branches: [], products: prods };
const VISITOR = `try{ localStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(4500);
  const r = await o.pg.evaluate(() => ({ seq: [...document.querySelector('[data-container="products-area"]').children].map(e => e.dataset.catHead ? 'H:' + e.dataset.catHead : (e.tagName === 'SECTION' ? e.dataset.categorySection : null)).filter(Boolean),
    strip: [...document.querySelectorAll('[data-container="categories"] > *')].map(e => e.innerText.trim()), banner: (() => { const h = document.querySelector('[data-cat-head="A"]'); const n = h && h.nextElementSibling; return !!(n && n.classList.contains('cat-section-banner')); })() }));
  const iMix = r.seq.indexOf('MIX'), iNew = r.seq.indexOf('__new');
  ok(iMix === r.seq.length - 1 && ['H:A', 'A1', 'A2', 'B', 'C'].every(x => r.seq.indexOf(x) !== -1 && r.seq.indexOf(x) < iMix), '① القسم الجامع (كلّه مكرّر من أقسام أخرى) يُرسم بعد كلّ الأقسام الأصلية رغم ترتيبه الأوّل ' + r.seq.join(','));
  ok(r.seq.indexOf('C') !== -1 && r.seq.indexOf('C') < iMix, '① القسم الأصليّ الذي تكرّر بعض منتجاته يبقى في مكانه (ليس جامعاً)');
  ok(iNew > r.seq.indexOf('C') && iNew < iMix, '② «وصل حديثاً» بعد الأقسام الأصلية وقبل الجامع ' + iNew);
  ok(r.strip[r.strip.length - 1] && /جامع/.test(r.strip[r.strip.length - 1]), '③ شريط الأقسام العلوي: الجامع في الآخر ' + JSON.stringify(r.strip));
  ok(r.banner, '④ بانر (هيدر) القسم الرئيسي ذي الفروع يظهر تحت عنوانه');
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
