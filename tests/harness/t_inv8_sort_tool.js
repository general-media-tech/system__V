// (OWN-10#17) «فرز المنتجات القديمة» أُعيد بناؤها: بحث · فلتر صنف/مجموعة · ترتيب · تحديد ⇒ فاتورة واحدة باسم المورّد والمكان
// أو إضافة لفاتورة شراء موجودة — الكلفة/الأسعار من المنتج والكميات لا تُمسّ. والربط بالباركود/الاسم لا بالمعرّف وحده.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const P = await H.call('/rest/v1/products', [
    { name: 'عدسة قديمة A', barcode: 'OS0001', price: 200, wholesale_price: 180, cost_price: 120, net_cost: 125, haleb: 3, daraa: 1, group_name: 'عدسات', category: 'تصوير' },
    { name: 'عدسة قديمة B', barcode: 'OS0002', price: 300, cost_price: 150, haleb: 2, daraa: 0, group_name: 'عدسات', category: 'تصوير' },
    { name: 'ضوء قديم C', barcode: 'OS0003', price: 90, cost_price: 40, haleb: 5, daraa: 0, group_name: 'إضاءة', category: 'استوديو' },
    { name: 'حامل قديم D', barcode: 'OS0004', price: 50, cost_price: 20, haleb: 1, daraa: 0, group_name: 'حوامل', category: 'استوديو' },
    { name: 'مربوط بالباركود E', barcode: 'OS0005', price: 10, cost_price: 5, haleb: 2, daraa: 0, group_name: 'حوامل', category: 'استوديو' }]);
  /* فاتورة فيها E بالباركود فقط (معرّف مختلف) — كانت تُعدّ «غير مربوطة» */
  const [EX] = await H.call('/rest/v1/import_log', [{ inv_number: 'PO-2026-0500', inv_type: 'instant', supplier: 'مورد قائم', status: 'arrived', total_amount: 999, transferred: true,
    transfer_moved: { 'x-1': 1 }, items_snapshot: [{ id: 'x-1', name: 'شيء', qty: 1, unit_price: 9 }, { id: 'old-id', name: 'اسم آخر', barcode: 'OS0005', qty: 2 }] }]);
  const { browser, pg, errs } = await H.open('inventory.html', { w: 1366, h: 900, mobile: false, wait: 5000, init: H.ADMIN_INIT });
  await pg.evaluate(() => openAthenaeumTool()); await pg.waitForTimeout(1500);
  let t = await pg.evaluate(() => document.getElementById('ath-list').innerText);
  ok(!/مربوط بالباركود E/.test(t), 'منتجٌ في فاتورةٍ بالباركود (معرّف مختلف) يُعدّ مربوطاً');
  ok(/عدسة قديمة A/.test(t) && /ضوء قديم C/.test(t), 'القائمة تعرض القديم غير المربوط');
  const opts = await pg.evaluate(() => ({ c: [...document.querySelectorAll('#ath-cat option')].map(o => o.value), g: [...document.querySelectorAll('#ath-grp option')].map(o => o.value) }));
  ok(opts.c.includes('تصوير') && opts.c.includes('استوديو') && opts.g.includes('عدسات'), 'فلاتر الصنف والمجموعة من المنتجات');
  await pg.fill('#ath-q', 'عدسة'); await pg.waitForTimeout(200);
  t = await pg.evaluate(() => document.getElementById('ath-list').innerText);
  ok(/عدسة قديمة A/.test(t) && !/ضوء قديم C/.test(t), 'البحث يعمل');
  await pg.fill('#ath-q', ''); await pg.selectOption('#ath-cat', 'استوديو'); await pg.waitForTimeout(200);
  t = await pg.evaluate(() => document.getElementById('ath-list').innerText);
  ok(/ضوء قديم C/.test(t) && !/عدسة قديمة A/.test(t), 'فلتر الصنف يعمل');
  await pg.selectOption('#ath-cat', ''); await pg.selectOption('#ath-sort', 'group'); await pg.waitForTimeout(200);
  const heads = await pg.evaluate(() => [...document.querySelectorAll('#ath-list > div')].map(d => d.textContent.trim()).filter(x => /^(عدسات|إضاءة|حوامل)$/.test(x)));
  ok(heads.length >= 3, 'الترتيب بالمجموعة بعناوين: ' + heads.join(' · '));
  /* اختيار A و B و C من صنفين ⇒ فاتورة جديدة واحدة */
  await pg.evaluate((ids) => { ids.forEach(id => { const c = document.querySelector('.ath-cb[data-id="' + id + '"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); }, [P[0].id, P[1].id, P[2].id].map(String));
  await pg.evaluate(() => athNext()); await pg.waitForTimeout(200);
  const sum = await pg.evaluate(() => document.getElementById('ath-sel-sum').textContent);
  ok(/3 منتجاً/.test(sum) && /11 قطعة/.test(sum), 'الخطوة الثانية تلخّص المحدّد: ' + sum);
  await pg.evaluate(() => { GMTAsk.confirm = async () => true; });
  await pg.evaluate(() => athNext()); await pg.waitForTimeout(300);
  let still = await pg.evaluate(() => getComputedStyle(document.getElementById('ath-modal')).display !== 'none');
  ok(still, 'بلا اسم مورّد ⇒ لا إنشاء');
  await pg.fill('#ath-supplier', 'مورد الفرز'); await pg.fill('#ath-place', 'حلب — السريان');
  await pg.evaluate(() => athNext()); await pg.waitForTimeout(1500);
  let d = await H.call('/__dump', undefined, 'GET');
  const arc = (d.import_log || []).filter(r => /^ARC-/.test(r.inv_number || ''));
  const inv = arc[0] || {};
  ok(arc.length === 1 && inv.items_snapshot.length === 3, 'فاتورة واحدة لكلّ المحدَّد (لا فاتورة لكلّ منتج): ' + arc.length + ' · بنود ' + (inv.items_snapshot || []).length);
  ok(inv.supplier === 'مورد الفرز' && inv.supplier_address === 'حلب — السريان', 'باسم المورّد والمكان');
  const a = (inv.items_snapshot || []).find(x => String(x.id) === String(P[0].id)) || {};
  ok(a.qty === 4 && a.unit_price === 125 && a.sale_price === 200 && a.wholesale_price === 180, 'الكلفة والأسعار من المنتج تلقائياً: ' + JSON.stringify(a).slice(0, 120));
  ok(inv.transferred === true && inv.transfer_moved && inv.transfer_moved[P[0].id] === 4, 'الكميات مغطّاة (لا تُنقل مرّة أخرى)');
  const pA = (d.products || []).find(x => x.id === P[0].id);
  ok(pA.haleb === 3 && pA.daraa === 1, 'كمية المنتج في المخزون لم تتغيّر');
  /* إضافة D إلى فاتورة موجودة */
  await pg.evaluate(() => openAthenaeumTool()); await pg.waitForTimeout(1500);
  t = await pg.evaluate(() => document.getElementById('ath-list').innerText);
  ok(!/عدسة قديمة A/.test(t) && /حامل قديم D/.test(t), 'بعد الربط يختفي المربوط ويبقى الباقي');
  await pg.evaluate((id) => { const c = document.querySelector('.ath-cb[data-id="' + id + '"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); athNext(); }, String(P[3].id));
  await pg.evaluate(() => { const r = document.querySelector('input[name="ath-mode"][value="existing"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.waitForTimeout(200);
  await pg.evaluate((iid) => { const r = document.querySelector('[data-iid="' + iid + '"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }, String(EX.id));
  await pg.evaluate(() => athNext()); await pg.waitForTimeout(1500);
  d = await H.call('/__dump', undefined, 'GET');
  const ex = (d.import_log || []).find(r => r.id === EX.id);
  ok(ex.items_snapshot.length === 3 && ex.items_snapshot.some(x => String(x.id) === String(P[3].id)), 'الإضافة لفاتورة موجودة تزيد بنودها: ' + ex.items_snapshot.length);
  ok(+ex.total_amount === 999 && ex.transfer_moved[P[3].id] === 1 && ex.transfer_moved['x-1'] === 1, 'إجمالي الفاتورة الموجودة لم يتغيّر · الكمية مغطّاة · القديم محفوظ');
  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|favicon|vibrate/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
