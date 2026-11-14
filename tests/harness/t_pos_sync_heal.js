// (TASK-B0374 · المالك seq B657) «في كتير منتجات مختفية من نقاط البيع — درعا وحمص وحلب»: ذاكرة الجهاز لا تُحدَّث كمّيات الفروع ولا التصنيف،
// والمنتج الجديد لا يصل إن كانت ساعة الجهاز متقدّمة · والبحث في «مخزوني» يُخفي المنتج المعرَّف برصيد صفر.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [
    { name: 'كفر سيليكون EOS R50', barcode: 'SYN1', price: 15, wholesale_price: 10, net_cost: 6, cost_price: 6, daraa: 0, haleb: 0, category: null },
    { name: 'هود ET-86', barcode: 'SYN2', price: 25, wholesale_price: 18, net_cost: 10, cost_price: 10, daraa: 3, haleb: 0, category: 'إكسسوارات الكاميرا › هودات العدسات' }]);
  // ① أوّل فتح ⇒ تحميل كامل · ثمّ إغلاق
  let o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  ok(await o.pg.evaluate(() => getMeta('pos_cache_v')) === 'B0374', 'أوّل فتح ⇒ تحميل كامل ويُعلَّم الجهاز بنسخة الذاكرة الجديدة');
  // ساعة الجهاز متقدّمة ساعتين: لم تكن ترى أيّ تعديلٍ بعدها
  await o.pg.evaluate(() => setMeta('last_products_sync', new Date(Date.now() + 2 * 3600e3).toISOString()));
  await o.browser.close();
  // ② على الخادم: كمّية درعا تغيّرت · التصنيف مُلئ · منتجٌ جديد أُضيف
  await H.call('/rest/v1/products?id=eq.' + A.id, { daraa: 8, category: 'إكسسوارات الكاميرا › كفرات سيليكون', updated_at: new Date().toISOString() }, 'PATCH');
  const [C] = await H.call('/rest/v1/products', [{ name: 'ستراب كانون EOS 80D', barcode: 'SYN3', price: 12, wholesale_price: 8, net_cost: 4, cost_price: 4, daraa: 2, category: 'إكسسوارات الكاميرا › لوازم أخرى', updated_at: new Date(Date.now() - 3600e3).toISOString() }]);
  // ③ فتحٌ ثانٍ من ذاكرة الجهاز ⇒ المزامنة الخلفية
  o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 4000 });
  await o.pg.evaluate(() => _backgroundSync()); await sleep(1200);
  const st = await o.pg.evaluate(([a, c]) => { const pa = allProducts.find(p => String(p.id) === String(a)), pc = allProducts.find(p => String(p.id) === String(c));
    return { keys: allBranchKeys.length, daraa: pa && pa.daraa, cat: pa && pa.category, newOne: !!pc, newCat: pc && pc.category }; }, [A.id, C.id]);
  ok(st.keys > 0, 'الفتح من الذاكرة يقرأ أعمدة الفروع (كانت فارغة ⇒ الكمّيات لا تُحدَّث): ' + st.keys);
  ok(st.daraa === 8, 'كمّية درعا الجديدة وصلت للجهاز (0 ⇒ 8): ' + st.daraa);
  ok(st.cat === 'إكسسوارات الكاميرا › كفرات سيليكون', 'التصنيف المُعدَّل وصل (كانت المزامنة تُعيد المنتج بلا تصنيف): ' + st.cat);
  ok(st.newOne && st.newCat === 'إكسسوارات الكاميرا › لوازم أخرى', 'منتجٌ جديد وصل رغم أنّ ساعة الجهاز متقدّمة ساعتين');
  const ls = await o.pg.evaluate(() => getMeta('last_products_sync'));
  ok(ls && new Date(ls) < new Date(Date.now() + 60e3), 'وقت المزامنة صار وقت الخادم لا ساعة الجهاز: ' + ls);
  // ④ «مخزوني» + بحث ⇒ المنتج برصيد صفر يظهر للمعاينة (لا يُباع) بعد المتوفّر
  await o.pg.evaluate(() => { document.getElementById('searchInput').value = 'هود'; renderProds(); }); await sleep(500);
  const g = await o.pg.evaluate(() => { const t = document.getElementById('prodsGrid').innerText; return { has: /ET-86/.test(t), label: document.getElementById('prodsLabel').textContent }; });
  ok(g.has, 'البحث في «مخزوني» يُظهر المنتج حتى لو رصيده في فرعك صفر (ET-86 · رصيد درعا 3)');
  await o.pg.evaluate(() => { document.getElementById('searchInput').value = 'R50'; renderProds(); }); await sleep(400);
  ok(await o.pg.evaluate(() => /R50/.test(document.getElementById('prodsGrid').innerText)), 'وكذلك المنتج المتوفّر بعد المزامنة');
  await o.pg.evaluate(() => { document.getElementById('searchInput').value = ''; renderProds(); }); await sleep(400);
  const def = await o.pg.evaluate(() => [...document.querySelectorAll('#prodsGrid .prod-card, #prodsGrid [data-pid]')].length);
  const real = o.errs.filter(x => !/status of (400|401|404|406|409|503)|Failed to load resource/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
