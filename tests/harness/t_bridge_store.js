// (25 ت1 · TASK-0161) الجسر (ربط الجرد بالمتجر) — المالك seq 73 «نفّذ كل ما يخصّ … الجسر» · REQ-0437 «تحديث المتجر يعيد كتابة الكتالوج كله» ·
// REQ-0180 «المربوطة من الجسر لا تظهر في المتجر». الجسر كان يكتب الكتالوج كاملاً من نسخة لحظة فتحه ⇒ منتجٌ أُضيف بعدها يُمحى،
// ولا يتحقّق أنّ الكتابة وصلت. هنا: الكتالوج الطازج · لا تكرار · المقارنة نصّاً · الرفض يُقال لا «تم».
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const store = () => H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET').then(r => r[0]);
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-17T21:08:21.137229+00:00', categories: [{ id: 'c1', name: 'كاميرات', order: 1 }],
      products: [{ id: 'p_1', name: 'منتج متجر قديم', price: 50, barcode: '', images: [], category_id: 'c1' }, { id: 7, name: 'منتج متجر برقم', price: 30, barcode: 'BC0003', images: [], category_id: 'c1' }] }]);
    const { browser, pg, errs } = await H.open('bridge.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 5000 });
    const loaded = await pg.evaluate(() => ({ inv: invProds.length, store: storeProds.length }));
    ok(loaded.inv >= 12 && loaded.store === 2, W + ': الجسر حمّل الجرد والمتجر: ' + JSON.stringify(loaded));
    const toasts = () => pg.evaluate(() => (document.getElementById('toast') || document.querySelector('.toast') || {}).textContent || '');

    // ١) أدمن المتجر أضاف منتجاً بعد فتح الجسر ⇒ «أنشئ في المتجر» من الجسر لا يمحوه
    const s0 = await store();
    await H.call('/rest/v1/gmt_store?id=eq.1', { products: s0.products.concat([{ id: 'p_admin', name: 'أضافه أدمن المتجر', price: 99, images: [], category_id: 'c1' }]) }, 'PATCH');
    const inv0 = prods[0];
    await pg.evaluate(id => { openCreateModal(id); document.getElementById('mc-cat').value = 'c1'; return mcSave(); }, inv0.id);
    let s1 = await store();
    const names1 = s1.products.map(p => p.name);
    ok(names1.includes('أضافه أدمن المتجر') && s1.products.some(p => String(p.inv_id) === String(inv0.id)) && s1.products.length === 4,
      W + ': المنتج الجديد أُضيف ولم يُمحَ ما أضافه أدمن المتجر بعد فتح الجسر (كان يُمحى): ' + names1.join('، '));
    const [invRow] = await H.call('/rest/v1/products?id=eq.' + inv0.id + '&select=store_url', undefined, 'GET');
    ok(invRow && /store\.html#product=p_/.test(invRow.store_url || ''), W + ': رابط المتجر حُفظ في الجرد: ' + (invRow && invRow.store_url));
    // ٢) الإنشاء مرّةً ثانية للمنتج نفسه ⇒ لا تكرار
    await pg.evaluate(id => { openCreateModal(id); document.getElementById('mc-cat').value = 'c1'; return mcSave(); }, inv0.id);
    s1 = await store();
    ok(s1.products.filter(p => String(p.inv_id) === String(inv0.id)).length === 1, W + ': «أنشئ» مرّةً ثانية لا يكرّر المنتج في المتجر');
    // ٣) مزامنة السعر لمنتج متجرٍ رقمُه عدد (كانت === تقارن رقماً بنصّ ⇒ «تمّت» بلا تغيير)
    const inv3 = prods[3];
    await pg.evaluate(id => { openSyncModal(id, '7'); return msSyncPrice('inv'); }, inv3.id);
    s1 = await store();
    ok(Number((s1.products.find(p => String(p.id) === '7') || {}).price) === Number(inv3.price), W + ': مزامنة السعر وصلت للمتجر ($' + inv3.price + ')');
    // ٤) الكتابة مرفوضة (صلاحيات المتجر) ⇒ خطأٌ صريح لا «✅» والكتالوج كما هو
    await H.call('/__opts', { rls_block: ['gmt_store'] });
    const before = JSON.stringify((await store()).products);
    const inv1 = prods[1];
    await pg.evaluate(id => { openCreateModal(id); document.getElementById('mc-cat').value = 'c1'; return mcSave(); }, inv1.id);
    const t4 = await toasts();
    ok(/لم يُحفظ/.test(t4) && !/✅/.test(t4) && JSON.stringify((await store()).products) === before, W + ': رفض الكتابة ⇒ «' + t4.slice(0, 60) + '» والكتالوج لم يتغيّر');
    await H.call('/__opts', { rls_block: [] });
    // ٥) تحديث الجرد مرفوض ⇒ خطأٌ صريح (كان يمرّ بلا تحقّق)
    await H.call('/__opts', { rls_block: ['products'] });
    const r5 = await pg.evaluate(async id => { try { await patchInv(id, { price: 1 }); return 'ok'; } catch (e) { return e.message; } }, inv1.id);
    ok(/لم يُحفظ في الجرد/.test(r5), W + ': تحديث الجرد المرفوض يُقال: ' + r5);
    await H.call('/__opts', { rls_block: [] });
    ok(!errs.filter(e => !/status of (400|401|404|503)/.test(e)).length, W + ': لا أخطاء JS ' + errs.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
