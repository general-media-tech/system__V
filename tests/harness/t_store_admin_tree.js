// (TASK-B0377 · المالك seq B657) «تعديلك في المتجر لما بيدخل على الأدمن … عم يطلع لي مكانه القديم والأقسام القديمة — الأدمن ما مربوط بالواجهة»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const store = () => H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET').then(r => r[0]);
(async () => {
  await H.seed();
  const cats = [{ id: 'h1', name: 'إضاءة الاستوديو', order: 2 }, { id: 'h1_1', name: 'ألواح LED', order: 1, parent_id: 'h1' }, { id: 'h1_2', name: 'رؤوس الإضاءة', order: 2, parent_id: 'h1' },
    { id: 'h2', name: 'الدرونات وملحقاتها', order: 1 }, { id: 'h2_1', name: 'حقائب', order: 1, parent_id: 'h2' }, { id: 'h3', name: 'إكسسوارات الكاميرا', order: 3 }, { id: 'h3_1', name: 'حقائب', order: 1, parent_id: 'h3' }];
  const prods = [{ id: 'a', name: 'لوح أ', price: 10, category_id: 'h1_1', category_ids: ['h1_1'], order: 1, category_orders: { h1_1: 2 } },
    { id: 'b', name: 'لوح ب', price: 10, category_id: 'h1_1', category_ids: ['h1_1'], order: 9, category_orders: { h1_1: 0 } },
    { id: 'c', name: 'لوح ج', price: 10, category_id: 'h1_1', category_ids: ['h1_1'], order: 5, category_orders: { h1_1: 1 } },
    { id: 'd', name: 'حقيبة درون', price: 20, category_id: 'h2_1', category_ids: ['h2_1', 'h3_1'], category_orders: { h2_1: 0, h3_1: 0 } }];
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', categories: cats, products: prods, banners: [], offers: [] }]);
  const { browser, pg, errs } = await H.open('admin_store.html', { w: 1366, h: 900, mobile: false, wait: 5500 });
  await pg.evaluate(() => { if (typeof renderCatalogAdmin === 'function') renderCatalogAdmin(); Object.keys(_catCollapsed).forEach(k => delete _catCollapsed[k]); document.querySelectorAll('.cat-products').forEach(x => x.classList.remove('collapsed')); });
  const order = await pg.evaluate(() => [...document.querySelectorAll('#catalog-list .cat-block')].map(b => b.dataset.catId));
  ok(order.join() === 'h2,h2_1,h1,h1_1,h1_2,h3,h3_1', 'الأدمن يعرض الشجرة كما الواجهة: الرئيسيّ بترتيبه ثمّ فروعه تحته: ' + order.join());
  const inPanel = await pg.evaluate(() => [...document.querySelectorAll('.cat-products[data-cat-id="h1_1"] .prod-row')].map(r => r.dataset.prodId));
  ok(inPanel.join() === 'b,c,a', 'ترتيب المنتجات داخل القسم = ترتيب الواجهة (category_orders) لا الحقل القديم: ' + inPanel.join());
  await pg.evaluate(() => openProdModal('d')); await pg.waitForTimeout(500);
  const chk = await pg.evaluate(() => [...document.querySelectorAll('#prod-categories-list input:checked')].map(i => i.value + ':' + document.querySelector('label[for="' + i.id + '"]').title));
  ok(chk.length === 2 && chk.some(x => /h2_1:الدرونات وملحقاتها › حقائب/.test(x)) && chk.some(x => /h3_1:إكسسوارات الكاميرا › حقائب/.test(x)), 'نافذة المنتج: أقسامه الحاليّة محدّدة مع اسم القسم الأب (حقائب ≠ حقائب): ' + chk.join(' | '));
  // إضافة قسم «رؤوس الإضاءة» للمنتج ⇒ يُعرض في آخره · الحفظ لا يغيّر ترتيبه في قسميه الآخرين
  await pg.evaluate(() => { document.getElementById('cat-chk-h1_2').checked = true; }); await pg.evaluate(() => saveProduct()); await pg.waitForTimeout(1500);
  let st = await store(); let D = st.products.find(p => p.id === 'd');
  ok(D.category_ids.join() === 'h2_1,h3_1,h1_2' && D.category_orders.h2_1 === 0 && D.category_orders.h3_1 === 0 && D.category_orders.h1_2 === 0, 'حفظ المنتج: القسم الجديد أُضيف بترتيبه، والقديمان كما هما: ' + JSON.stringify(D.category_orders));
  // تعديل قسمٍ فرعي (الاسم) ⇒ يبقى تحت أبيه
  await pg.evaluate(() => openCatModal('h1_2')); await pg.waitForTimeout(300);
  const pv = await pg.evaluate(() => document.getElementById('cat-parent').value);
  ok(pv === 'h1', 'نافذة القسم الفرعي تعرض قسمه الأب: ' + pv);
  await pg.evaluate(() => { document.getElementById('cat-name').value = 'رؤوس إضاءة COB'; }); await pg.evaluate(() => saveCategory()); await pg.waitForTimeout(1200);
  st = await store(); const C = st.categories.find(c => c.id === 'h1_2');
  ok(C && C.name === 'رؤوس إضاءة COB' && C.parent_id === 'h1', 'حفظ القسم الفرعي يُبقي «القسم الأب» (كان يصير قسماً رئيسياً): ' + JSON.stringify(C && { n: C.name, p: C.parent_id }));
  // قسمٌ جديد فرعي من النافذة
  await pg.evaluate(() => { openCatModal(); document.getElementById('cat-name').value = 'مراوح'; document.getElementById('cat-parent').value = 'h2'; }); await pg.evaluate(() => saveCategory()); await pg.waitForTimeout(1200);
  st = await store(); const N = st.categories.find(c => c.name === 'مراوح');
  ok(N && N.parent_id === 'h2', 'إضافة قسمٍ فرعي جديد تحت «الدرونات وملحقاتها»');
  const real = errs.filter(x => !/status of (400|401|404|406|503)|Failed to load resource/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
