// (TASK-0234 · 0236 · 0241 · المالك seq 164) «جدول المواصفات ماعم يظهر ايضا في نقاط البيع» ·
// «التقريبي حطه علامه وليس كلمه … ولا تحذف» — البند التقديريّ يبقى، يحمل «≈» داخلياً، ولا شيء في المتجر
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const inv = id => H.call('/rest/v1/products?id=eq.' + id + '&select=*', undefined, 'GET').then(r => r[0]);
(async () => {
  const { prods } = await H.seed();
  const A = prods[0];
  await H.call('/rest/v1/products?id=eq.' + A.id, { specs: { 'الدقة': '24MP تقريبي', 'الوزن': '500 غ', 'ISO': 'غير متوفر', '__desc': 'وصف' } }, 'PATCH');
  // ① صفحة التعديل: البند التقديريّ يبقى بلا الكلمة و«≈» مضغوط · إطفاؤه يحذف العلامة · إشعاله على غيره يكتبها
  let { browser, pg, errs } = await H.open('inventory.html', { w: 390, h: 844, mobile: true, wait: 5000, init: H.ADMIN_INIT });
  await pg.evaluate(id => openDetailModal(id), A.id);
  await pg.evaluate(() => document.getElementById('detail-full-btn').click());
  await pg.waitForSelector('#gmt-pe .pe-row', { timeout: 10000 }).catch(() => {});
  const rows = await pg.evaluate(() => [...document.querySelectorAll('#gmt-pe .pe-row')].map(r => ({ k: r.querySelector('[data-rk]').value, v: r.querySelector('[data-rv]').value, ax: r.querySelector('[data-rax]').getAttribute('aria-pressed') })));
  const dq = rows.find(r => r.k === 'الدقة');
  ok(dq && dq.v === '24MP' && dq.ax === 'true' && !rows.some(r => r.k === 'ISO'), 'التعديل: «24MP تقريبي» ⇒ «24MP» و«≈» مضغوط · «غير متوفر» وحده يسقط: ' + JSON.stringify(rows));
  await pg.evaluate(() => { const rs = [...document.querySelectorAll('#gmt-pe .pe-row')]; rs.find(r => r.querySelector('[data-rk]').value === 'الوزن').querySelector('[data-rax]').click(); });
  await pg.click('#gmt-pe [data-pe-save]'); await pg.waitForFunction(() => /حُفظ|❌/.test((document.querySelector('#gmt-pe [data-pe-msg]') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  let sp = (await inv(A.id)).specs;
  ok(sp['الدقة'] === '24MP' && sp['الوزن'] === '500 غ' && JSON.stringify((sp.__approx || []).slice().sort()) === JSON.stringify(['الدقة', 'الوزن'].sort()), 'الحفظ: القيم بلا كلمة · العلامة في specs.__approx: ' + JSON.stringify(sp));
  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource/.test(e));
  ok(!real.length, 'الجرد: لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  // ② نقطة البيع: الجدول يظهر عند فتح المنتج مع «≈»
  ({ browser, pg, errs } = await H.open('pos.html', { w: 390, h: 844, mobile: true, wait: 6000, init: H.ADMIN_INIT }));
  await pg.evaluate(() => { if (!branch) branch = { key: 'haleb', name: 'حلب' }; return typeof loadProducts === 'function' ? loadProducts() : null; }); await sleep(1500);
  await pg.evaluate(id => openProductDetail(id), A.id);
  await pg.waitForSelector('#pd-specs table', { timeout: 8000 }).catch(() => {});
  const p = await pg.evaluate(() => { const b = document.getElementById('pd-specs'); return b ? { t: b.innerText, marks: b.querySelectorAll('[data-spec-approx]').length, before: !!(b.nextElementSibling && b.nextElementSibling.classList.contains('pd-add-btn')) } : null; });
  ok(p && /24MP/.test(p.t) && /500 غ/.test(p.t) && /وصف/.test(p.t) && p.marks === 2 && !/تقريبي/.test(p.t) && p.before, 'نقطة البيع: «📋 المواصفات» فوق «إضافة للسلة» مع «≈» للبندين: ' + JSON.stringify(p));
  const real2 = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource/.test(e));
  ok(!real2.length, 'نقطة البيع: لا أخطاء JS ' + real2.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
