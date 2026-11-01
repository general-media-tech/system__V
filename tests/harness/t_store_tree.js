// (TASK-0305 · المالك seq 3/242/348/349) شجرة أقسام المتجر: رئيسي ⇐ فرعي (parent_id) + أقسام متقاطعة (category_ids)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const cats = [
    { id: 'L', name: 'الإضاءة', order: 1 },
    { id: 'L1', name: 'هيد لايت', parent_id: 'L', order: 1 },
    { id: 'L2', name: 'بانيل ليد', parent_id: 'L', order: 2 },
    { id: 'F', name: 'قسم قديم مسطّح', order: 2 },
    { id: 'X', name: 'إضاءة بالبطارية', order: 3 },
    { id: 'Z', name: 'فرع يتيم', parent_id: 'غير_موجود', order: 4 }
  ];
  const products = [
    { id: 'h1', name: 'رأس إضاءة أ', price: 10, images: [], category_ids: ['L1', 'X'] },
    { id: 'h2', name: 'رأس إضاءة ب', price: 10, images: [], category_ids: ['L1'] },
    { id: 'p1', name: 'بانيل أ', price: 10, images: [], category_ids: ['L2'] },
    { id: 'f1', name: 'منتج قديم', price: 10, images: [], category_id: 'F' },
    { id: 'z1', name: 'منتج الفرع اليتيم', price: 10, images: [], category_ids: ['Z'] }
  ];
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-01T10:00:00Z', categories: cats, products, banners: [], offers: [], branches: [] }]);
  const { browser, pg, errs } = await H.open('store.html', { w: 390, h: 844, wait: 7000 });
  const r = await pg.evaluate(() => {
    const chips = [...document.querySelectorAll('[data-container="categories"] > div')].map(e => e.innerText.trim());
    const order = [...document.querySelectorAll('[data-container="products-area"] > *')].map(e => (e.tagName === 'H2' ? 'H:' : 'S:') + (e.dataset.categorySection || '') + ':' + (e.querySelector('h3') ? e.querySelector('h3').textContent : e.textContent).trim());
    const inSec = id => [...(document.querySelector('section[data-category-section="' + id + '"]') || document.createElement('i')).querySelectorAll('h4')].map(h => h.textContent.trim());
    return { chips, order, L1: inSec('L1'), L2: inSec('L2'), X: inSec('X'), F: inSec('F'), Z: inSec('Z') };
  });
  ok(r.chips.length === 4 && r.chips.includes('الإضاءة') && !r.chips.includes('هيد لايت') && !r.chips.includes('بانيل ليد'), 'الشريط العلوي = الأقسام الرئيسية فقط (الفروع لا تظهر فيه): ' + JSON.stringify(r.chips));
  const iL = r.order.findIndex(x => x.startsWith('H:L:')), iL1 = r.order.findIndex(x => x.startsWith('S:L1:')), iL2 = r.order.findIndex(x => x.startsWith('S:L2:'));
  ok(iL >= 0 && iL < iL1 && iL1 < iL2, 'عنوان «الإضاءة» ثمّ صفّ «هيد لايت» ثمّ صفّ «بانيل ليد»: ' + JSON.stringify(r.order));
  ok(r.L1.length === 2 && r.L2.length === 1, 'كل فرعيّ فيه منتجاته فقط');
  ok(r.X.includes('رأس إضاءة أ') && r.L1.includes('رأس إضاءة أ'), 'المنتج في قسمين (هيد لايت + إضاءة بالبطارية) — يظهر في الاثنين');
  ok(r.F.includes('منتج قديم'), 'القسم القديم المسطّح (category_id) يعمل كما كان');
  ok(r.Z.includes('منتج الفرع اليتيم') && r.chips.includes('فرع يتيم'), 'فرعٌ أبوه غير موجود يُعامَل رئيسياً — لا منتج يختفي');
  await pg.evaluate(() => [...document.querySelectorAll('[data-container="categories"] > div')].find(e => /الإضاءة/.test(e.innerText)).click());
  await pg.waitForTimeout(900);
  const top = await pg.evaluate(() => Math.round(document.querySelector('[data-category-section="L"]').getBoundingClientRect().top));
  ok(top >= 0 && top < 200, 'الضغط على «الإضاءة» في الشريط يقفز إلى عنوانها: ' + top);
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
