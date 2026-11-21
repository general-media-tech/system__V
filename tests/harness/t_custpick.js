// (TASK-A0531 · المالك seq 874–875) اقتراح أسماء العملاء من السجلّ في كلّ حقل اسم زبون + إلغاء التحديد في منتجات الكوبون
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_customers', [
    { name: 'لانا مجدمي', phone: '0944111222', address: 'حلب - الفرقان' },
    { name: 'لانا الحسن', phone: '0944333444', address: 'دمشق' },
    { name: 'لانا محظورة', phone: '0944555666', is_blocked: true }]);
  await H.call('/rest/v1/products', [
    { name: 'Canon 250D body', price: 560, group_name: 'كاميرات' }, { name: 'Canon 60D', price: 310, group_name: 'كاميرات' },
    { name: 'هود 58', price: 5, group_name: 'إكسسوارات' }]);
  const { browser, pg, errs } = await H.open('admin_pos.html', { w: 390, h: 844, wait: 4500, init: H.ADMIN_INIT });
  // ١) الكوبون
  await pg.evaluate(() => openCreateCouponModal()); await sleep(1500);
  await pg.click('#cp-cust'); await pg.keyboard.type('لانا'); await sleep(1200);
  const sug = await pg.evaluate(() => { const b = document.querySelector('[data-custpick-box]'); return b && b.style.display !== 'none' ? [...b.querySelectorAll('[data-i]')].map(x => x.textContent.replace(/\s+/g, ' ').trim()) : []; });
  ok(sug.length === 2 && sug.some(t => /لانا مجدمي/.test(t)) && !sug.some(t => /محظورة/.test(t)), 'كوبون: «لانا» يقترح من سجلّ العملاء (بلا المحظور): ' + JSON.stringify(sug));
  await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-custpick-box] [data-i]')].find(x => /مجدمي/.test(x.textContent)); b.click(); });
  ok(await pg.evaluate(() => document.getElementById('cp-cust').value) === 'لانا مجدمي', 'الاختيار يكتب الاسم الكامل');
  // ٢) إلغاء التحديد في المنتجات
  const g = await pg.evaluate(() => { const b = document.querySelector('#cp-prods-list [data-grp-btn="كاميرات"]'); b.click(); const n1 = document.querySelectorAll('.cp-prod-check:checked').length, t1 = b.textContent, sum = document.querySelector('#cp-prods-list [data-sel-sum]').style.display, cnt = b.parentElement.querySelector('[data-grp-cnt]').textContent;
    b.click(); const n2 = document.querySelectorAll('.cp-prod-check:checked').length, t2 = b.textContent; return { n1, t1, sum, cnt, n2, t2 }; });
  ok(g.n1 >= 2 && /إلغاء/.test(g.t1) && new RegExp(g.n1 + '/' + g.n1).test(g.cnt) && g.sum === 'flex', 'زرّ المجموعة يحدّدها ثمّ يصير «✕ إلغاء» · «محدّد N/N» · سطر «محدّد N»: ' + JSON.stringify(g));
  ok(g.n2 === 0 && /الكل/.test(g.t2), 'الضغطة الثانية تلغي تحديد المجموعة');
  await pg.evaluate(() => { document.querySelector('[data-grp-btn="كاميرات"]').click(); document.querySelector('[data-grp-btn="إكسسوارات"]').click(); document.querySelector('#cp-prods-list [data-sel-sum] button').click(); });
  ok(await pg.evaluate(() => document.querySelectorAll('.cp-prod-check:checked').length) === 0, '«✕ إلغاء التحديد» يمسح كلّ المحدّد بضغطة');
  // ٣) حقل «إضافة فاتورة» يملأ الهاتف أيضاً
  const hasAi = await pg.evaluate(() => !!document.getElementById('ai-customer'));
  if (hasAi) {
    await pg.evaluate(() => { document.getElementById('ai-customer').value = ''; document.getElementById('ai-phone').value = ''; document.getElementById('ai-customer').focus(); });
    await pg.keyboard.type('لانا ال'); await sleep(1200);
    await pg.evaluate(() => { const b = document.querySelector('[data-custpick-box] [data-i]'); b && b.click(); });
    const v = await pg.evaluate(() => [document.getElementById('ai-customer').value, document.getElementById('ai-phone').value]);
    ok(v[0] === 'لانا الحسن' && v[1] === '0944333444', 'فاتورة الإدارة: الاسم والهاتف معاً: ' + JSON.stringify(v));
  }
  // ٤) (TASK-A0536 · seq 874) «كوبون من إدارة العميل مباشرة»: زرّ في بطاقة العميل يفتح الكوبون باسمه وبكودٍ جاهز
  const cc = await pg.evaluate(() => {
    let box = document.getElementById('cust-list'); if (!box) { box = document.createElement('div'); box.id = 'cust-list'; document.body.appendChild(box); }
    allCustomers = [{ id: 901, name: 'لانا مجدمي', phone: '0944111222' }, { id: 902, name: 'لانا محظورة', phone: '0944555666', is_blocked: true }];
    renderCustomerList('__none__');
    const cards = [...box.children], btn = box.querySelector('[data-cust-coupon]');
    const n = box.querySelectorAll('[data-cust-coupon]').length;
    btn && btn.click();
    return { n, title: document.getElementById('modal-title').textContent, cust: (document.getElementById('cp-cust') || {}).value, code: (document.getElementById('cp-code') || {}).value };
  });
  ok(cc.n === 1 && /لانا مجدمي/.test(cc.title) && cc.cust === 'لانا مجدمي' && /^[A-Z0-9]{8}$/.test(cc.code || ''), 'بطاقة العميل: «🎟️ كوبون خصم» (لا يظهر للمحظور) يفتح الكوبون باسمه وبكودٍ مولَّد: ' + JSON.stringify(cc));
  const real = errs.filter(e => !/Failed to load resource/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
