// (TASK-0233 · المالك seq 161) «ادمج هذه في صفحه تعديل المنتج مع التعديل المنتجات مع تعديل بيانات تلقائيه … كل مواصفات المنتج في مكان واحد
// وايضا تتعبى هي الماركه تلقائيا»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const inv = id => H.call('/rest/v1/products?id=eq.' + id + '&select=*', undefined, 'GET').then(r => r[0]);
(async () => {
  const { prods } = await H.seed();
  const A = prods[0], B = prods[1];
  await H.call('/rest/v1/products?id=eq.' + A.id, { name: 'عدسة كانون 50mm STM', brand: null, specs: { 'الحربة': 'EF' } }, 'PATCH');
  await H.call('/rest/v1/products?id=eq.' + B.id, { name: 'فلاش احترافي', brand: 'Godox', specs: null }, 'PATCH');
  const { browser, pg, errs } = await H.open('inventory.html', { w: 390, h: 844, mobile: true, wait: 5000, init: H.ADMIN_INIT });
  await pg.evaluate(() => { window.__dlg = 0; window.GMTBrain = Object.assign(window.GMTBrain || {}, { productImportDialog: (cb, o) => { window.__dlg++; window.__dlgOpt = o;
    cb({ specs: [{ k: 'الوزن', v: '160 غ' }, { k: 'الحربة', v: 'EF / EF-S' }], description_ar: 'عدسة ثابتة خفيفة.', brand: 'Canon', model: 'EF 50mm f/1.8 STM', compat: ['EOS R (بمحوّل)'], aliases_en: ['nifty fifty'], source_url: 'https://www.alibaba.com/x' }); } }); });
  // ① «✏️ تعديل» من تفاصيل المنتج ⇒ صفحة التعديل الواحدة (لا النافذة القصيرة)
  await pg.evaluate(id => openDetailModal(id), A.id); await sleep(300);
  await pg.evaluate(() => document.getElementById('detail-edit-btn').click());
  await pg.waitForSelector('#gmt-pe [data-f="name"]', { timeout: 10000 }).catch(() => {});
  const v1 = await pg.evaluate(() => ({ page: !!document.getElementById('gmt-pe'), quick: getComputedStyle(document.getElementById('product-modal')).display !== 'none',
    full: getComputedStyle(document.getElementById('detail-full-btn')).display, brand: document.querySelector('#gmt-pe [data-f="brand"]').value, auto: document.querySelector('#gmt-pe [data-f="brand"]').dataset.auto,
    note: !document.querySelector('#gmt-pe [data-pe-brandnote]').hidden, img: !!document.querySelector('#gmt-pe [data-f="image_url"]'), autoBtn: !!document.querySelector('#gmt-pe [data-pe-auto]'), qty: !!document.querySelector('#gmt-pe [data-pe-quick]') }));
  ok(v1.page && !v1.quick && v1.full === 'none', '«✏️ تعديل» ⇒ صفحة التعديل الواحدة (والزرّ المكرّر «تعديل كل شيء» مخفيّ): ' + JSON.stringify({ page: v1.page, quick: v1.quick, full: v1.full }));
  ok(v1.brand === 'Canon' && v1.auto === '1' && v1.note, 'الماركة الفارغة ⇒ «Canon» تلقائياً من «كانون» في الاسم (مع «🔎 تلقائياً — تأكّد»)');
  ok(v1.img && v1.autoBtn && v1.qty, 'في الصفحة نفسها: صورة الجرد · «🤖 المواصفات التلقائية» · «📦 الكميّات»');
  // ② المواصفات التلقائية تعبّئ الصفحة نفسها ولا تحفظ وحدها
  await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-auto]').click()); await sleep(300);
  const v2 = await pg.evaluate(() => ({ rows: [...document.querySelectorAll('#gmt-pe .pe-row')].map(r => r.querySelector('[data-rk]').value + '=' + r.querySelector('[data-rv]').value),
    desc: document.querySelector('#gmt-pe [data-f="__desc"]').value, model: document.querySelector('#gmt-pe [data-f="__model"]').value, compat: document.querySelector('#gmt-pe [data-f="compat"]').value,
    alt: document.querySelector('#gmt-pe [data-f="alt_names"]').value, msg: document.querySelector('#gmt-pe [data-pe-msg]').textContent, opt: window.__dlgOpt }));
  let db = await inv(A.id);
  ok(JSON.stringify(v2.rows) === JSON.stringify(['الحربة=EF / EF-S', 'الوزن=160 غ']) && v2.desc === 'عدسة ثابتة خفيفة.' && v2.model === 'EF 50mm f/1.8 STM' && /EOS R/.test(v2.compat) && /nifty fifty/.test(v2.alt) && /راجعها/.test(v2.msg),
    'المواصفات التلقائية ⇒ تعبّئ الجدول والوصف والموديل والتوافق والأسماء في الصفحة: ' + JSON.stringify(v2.rows));
  ok(!db.specs['الوزن'] && db.brand == null, 'ولا تحفظ وحدها — تراجعها ثمّ «💾 احفظ»');
  ok(v2.opt && v2.opt.name === 'عدسة كانون 50mm STM', 'البحث بصورة المنتج واسمه من الصفحة');
  await pg.click('#gmt-pe [data-pe-save]'); await pg.waitForFunction(() => /حُفظ|❌/.test((document.querySelector('#gmt-pe [data-pe-msg]') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  db = await inv(A.id);
  ok(db.brand === 'Canon' && db.specs['الوزن'] === '160 غ' && db.specs['الحربة'] === 'EF / EF-S' && db.specs.__desc === 'عدسة ثابتة خفيفة.' && db.specs.__model === 'EF 50mm f/1.8 STM' && /EOS R/.test(db.compat || '') && db.specs_source === 'https://www.alibaba.com/x',
    '«💾 احفظ» ⇒ الجرد: الماركة · الجدول · الوصف · الموديل · التوافق · مصدر المواصفات: ' + JSON.stringify({ b: db.brand, s: db.specs, src: db.specs_source }));
  // ③ «📦 الكميّات» ⇒ النافذة السريعة
  await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-quick]').click()); await sleep(400);
  ok(await pg.evaluate(() => !document.getElementById('gmt-pe') && getComputedStyle(document.getElementById('product-modal')).display !== 'none'), '«📦 الكميّات» ⇒ النافذة السريعة للكميّات');
  await pg.evaluate(() => closeModal('product-modal'));
  // ④ قائمة المنتج: «المواصفات التلقائية» ⇒ الصفحة نفسها وتبدأ البحث · ماركةٌ موجودة لا تُمسّ
  await pg.evaluate(id => gmtManageProduct(id), B.id); await sleep(200);
  await pg.evaluate(() => document.querySelector('#gmt-manage-ov [data-k="ali"]').click()); await sleep(700);
  const v4 = await pg.evaluate(() => ({ page: !!document.getElementById('gmt-pe'), dlg: window.__dlg, brand: document.querySelector('#gmt-pe [data-f="brand"]').value }));
  ok(v4.page && v4.dlg === 2 && v4.brand === 'Godox', 'قائمة المنتج «المواصفات التلقائية» ⇒ صفحة التعديل وتبدأ البحث فيها · الماركة الموجودة كما هي: ' + JSON.stringify(v4));
  await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-x]').click());
  // ⑤ إضافة منتج: الماركة من الاسم
  await pg.evaluate(() => openProductModal()); await sleep(300);
  await pg.fill('#f-name', 'Godox V860III فلاش'); await pg.evaluate(() => document.getElementById('f-name').dispatchEvent(new Event('change')));
  ok(await pg.evaluate(() => document.getElementById('f-brand').value) === 'Godox', 'إضافة منتج: الماركة تتعبّى من الاسم');
  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
