// (TASK-0201 · المالك seq 133) «صفحه تعديل بيانات المنتج … بعدل فيه كل شيء سواء في المتجر او في الجرد او في الجدول او في الفئه او في فئته في
// المتجر او في الاسامي الاخرى او في تصنيف … حتى الاسعار» · «هذه الصلاحيات يجب ان تكون فقط في الادمن»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const store = () => H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET').then(r => r[0]);
const inv = id => H.call('/rest/v1/products?id=eq.' + id + '&select=*', undefined, 'GET').then(r => r[0]);
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    const A = prods[0];
    await H.call('/rest/v1/products?id=eq.' + A.id, { store_url: 'https://x/store.html#product=s_a', image_url: 'https://img.example/inv.png', specs: { 'الحربة': 'EF', '__desc': 'وصفٌ قديم' }, alt_names: null, search_terms: 'قديم' }, 'PATCH');
    await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-17T21:08:21.137229+00:00', categories: [{ id: 'c1', name: 'عدسات', order: 1 }, { id: 'c2', name: 'كانون', order: 2 }],
      products: [{ id: 's_a', name: 'اسم المتجر القديم', price: 50, images: ['https://img.example/s1.png'], category_id: 'c1', category_ids: ['c1'], description: 'وصف المتجر' }] }]);
    const { browser, ctx, pg, errs } = await H.open('inventory.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 5000, init: H.ADMIN_INIT });
    await ctx.route('https://img.example/**', r => r.fulfill({ status: 200, body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'), headers: { 'Content-Type': 'image/png' } }));
    // الدخول من «تفاصيل المنتج» ⇒ «🧩 تعديل كل شيء»
    await pg.evaluate(id => openDetailModal(id), A.id);
    const hasBtn = await pg.evaluate(() => !!document.getElementById('detail-full-btn'));
    await pg.evaluate(() => document.getElementById('detail-full-btn').click());
    await pg.waitForSelector('#gmt-pe [data-s="name"]', { timeout: 10000 }).catch(() => {});
    const v = await pg.evaluate(() => ({ open: !!document.getElementById('gmt-pe'), rows: document.querySelectorAll('#gmt-pe .pe-row').length, store: !!document.querySelector('#gmt-pe [data-s="name"]'), cats: document.querySelectorAll('#gmt-pe [data-scat]').length, imgs: document.querySelectorAll('#gmt-pe .pe-img').length, desc: (document.querySelector('#gmt-pe [data-f="__desc"]') || {}).value }));
    ok(hasBtn && v.open && v.rows === 1 && v.store && v.cats === 2 && v.imgs === 1 && v.desc === 'وصفٌ قديم', W + ': «🧩 تعديل كل شيء» ⇒ الصفحة بأقسامها (الجرد · الأسعار · الجدول · المتجر): ' + JSON.stringify(v));
    // التعديلات
    await pg.evaluate(() => {
      const s = (q, val) => { const e = document.querySelector('#gmt-pe ' + q); e.value = val; e.dispatchEvent(new Event('input', { bubbles: true })); };
      s('[data-f="name"]', 'عدسة كانون 50 STM'); s('[data-f="alt_names"]', 'نيفتي فيفتي، nifty fifty'); s('[data-f="category"]', 'عدسات'); s('[data-f="price"]', '123'); s('[data-f="wholesale_price"]', '110');
      document.querySelector('#gmt-pe .pe-row [data-rv]').value = 'EF (بايونيت)';
      document.querySelector('#gmt-pe [data-pe-addrow]').click(); const rs = document.querySelectorAll('#gmt-pe .pe-row'); rs[1].querySelector('[data-rk]').value = 'الوزن'; rs[1].querySelector('[data-rv]').value = '160 غ';
      s('[data-f="compat"]', 'EOS R'); s('[data-s="name"]', 'Canon EF 50mm f/1.8 STM');
      document.querySelector('#gmt-pe [data-scat="c2"]').checked = true;
      const same = document.querySelector('#gmt-pe [data-s-same]'); same.checked = true; same.dispatchEvent(new Event('change'));
      document.querySelector('#gmt-pe [data-pe-invimg]').click();
    });
    await pg.click('#gmt-pe [data-pe-save]'); await pg.waitForFunction(() => /حُفظ|❌/.test((document.querySelector('#gmt-pe [data-pe-msg]') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
    const msg = await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-msg]').textContent);
    const iv = await inv(A.id), st = await store(), sa = st.products.find(x => x.id === 's_a');
    ok(/حُفظ في الجرد والمتجر/.test(msg), W + ': الرسالة: ' + msg);
    ok(iv.name === 'عدسة كانون 50 STM' && Number(iv.price) === 123 && Number(iv.wholesale_price) === 110 && iv.category === 'عدسات' && iv.alt_names === 'نيفتي فيفتي، nifty fifty' && /نيفتي فيفتي/.test(iv.search_terms || '') && /قديم/.test(iv.search_terms || ''),
      W + ': الجرد: الاسم · السعران · التصنيف · الأسماء الأخرى (وكلمات البحث): ' + JSON.stringify({ n: iv.name, p: iv.price, w: iv.wholesale_price, c: iv.category, a: iv.alt_names, t: iv.search_terms }));
    ok(iv.specs && iv.specs['الحربة'] === 'EF (بايونيت)' && iv.specs['الوزن'] === '160 غ' && iv.specs.__desc === 'وصفٌ قديم' && iv.compat === 'EOS R', W + ': جدول المواصفات في الجرد: ' + JSON.stringify(iv.specs));
    ok(sa.name === 'Canon EF 50mm f/1.8 STM' && Number(sa.price) === 123 && JSON.stringify(sa.category_ids) === JSON.stringify(['c1', 'c2']) && JSON.stringify(sa.images) === JSON.stringify(['https://img.example/s1.png', 'https://img.example/inv.png']),
      W + ': المتجر: الاسم · السعر = سعر البيع · الأقسام · الصور: ' + JSON.stringify({ n: sa.name, p: sa.price, c: sa.category_ids, i: sa.images }));
    ok(Array.isArray(sa.specs) && sa.specs.some(x => x.label === 'الوزن') && sa.specs.some(x => x.label === 'الحربة' && x.value === 'EF (بايونيت)') && sa.compat === 'EOS R', W + ': جدول المواصفات وصل للمتجر');
    // بلا تغيير ⇒ لا كتابة
    await pg.click('#gmt-pe [data-pe-save]'); await pg.waitForTimeout(400);
    ok(/لا تغيير/.test(await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-msg]').textContent)), W + ': حفظٌ ثانٍ بلا تغيير ⇒ «لا تغيير لحفظه»');
    const hs = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.getElementById('gmt-pe').scrollWidth > innerWidth + 1);
    ok(!hs, W + ': لا طفح أفقي');
    if (W === 390) await pg.screenshot({ path: '/tmp/gmt-out/product_edit_390.png' });
    await pg.keyboard.press('Escape');
    ok(!(await pg.$('#gmt-pe')), W + ': Esc يغلق الصفحة');
    const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
    // الموظّف (بلا وضع الأدمن) ⇒ لا تُفتح بلا الكلمة السيادية
    const s2 = await H.open('inventory.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 5000, init: H.STAFF_INIT });
    await s2.pg.evaluate(id => { invOpenFullEdit(id); }, A.id); await s2.pg.waitForTimeout(800);
    const st2 = await s2.pg.evaluate(() => ({ pe: !!document.getElementById('gmt-pe'), ask: !!document.querySelector('[role="dialog"], .gmt-ask, #gmt-ask') }));
    ok(!st2.pe, W + ': موظّف ⇒ صفحة التعديل لا تُفتح (تطلب صلاحية الأدمن): ' + JSON.stringify(st2));
    await s2.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
