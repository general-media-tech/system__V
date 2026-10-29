// (المالك seq 221) «في المتجر مثلاً غطاء العدسة متعدّد الأقطار — هو بيحدّد القطر وبيعطيه المواصفات المعيّنة لعدسته ·
// أيضاً البحث باستخدام التوافق مثلاً هود 18 55 — حتى في المتجر»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const sp = (k, v) => [{ label: k, value: v }];
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-28T10:00:00Z', categories: [{ id: 'c1', name: 'إكسسوارات الكاميرا', order: 1 }, { id: 'c2', name: 'الإضاءة', order: 2 }],
    products: [
      { id: 's_caps', name: 'غطاء عدسة كانون الأمامي (اختر القطر)', price: 5, images: [], category_id: 'c1', specs: sp('النوع', 'غطاء أمامي'), options: [{ type: 'القطر', affectsPrice: false, values: [
        { name: '49mm', barcode: 'CAP49', compat: 'Canon EF 50mm f/1.8 STM (49مم)', specs: sp('القطر', '49 مم') },
        { name: '58mm', barcode: 'CAP58', compat: 'Canon EF 85mm f/1.8 USM (58مم) · Canon EF-S 18-55mm f/3.5-5.6 IS STM (58مم)', specs: sp('القطر', '58 مم') },
        { name: '77mm', barcode: 'CAP77', compat: 'Canon RF 24-105mm f/4L IS USM (77مم)', specs: sp('القطر', '77 مم') }] }] },
      { id: 's_hood', name: 'هود معدن لولبي 58mm', price: 8, images: [], category_id: 'c1', compat: 'قطر الفلتر 58مم' },
      { id: 's_hood2', name: 'ET-87 lens hood هود', price: 20, images: [], category_id: 'c1' },
      { id: 's_bat', name: 'بطارية كانون LP-E8 اصلية', price: 40, images: [], category_id: 'c1' },
      { id: 's_neo', name: 'DJI Neo', price: 360, images: [], category_id: 'c2', options: [{ type: 'النسخة', affectsPrice: true, values: [{ name: 'Single', price: 360, barcode: 'NEO1' }, { name: 'Combo', price: 450, barcode: 'NEO2' }] }] },
      { id: 's_led', name: 'لوح اضائة 660 pro', price: 65, images: [], category_id: 'c2' }] }]);
  for (const W of [390, 1366]) {
    const mob = W < 500;
    const { browser, pg, errs } = await H.open('store.html', { w: W, h: mob ? 844 : 900, mobile: mob, wait: 5000 });
    const S = q => pg.evaluate(q => { performSearch(q); const sec = document.getElementById('search-results-section');
      return { cards: [...(sec ? sec.querySelectorAll('[data-sr-id]') : [])].map(c => c.dataset.srId + (c.dataset.srVariant ? ':' + c.dataset.srVariant : '')), say: ((sec && sec.querySelector('p')) || {}).textContent || '' }; }, q);
    const a = await S('غطا عدسة 85');
    ok(a.cards.join(',') === 's_caps:58mm' && /58مم/.test(a.say), W + ': «غطا عدسة 85» ⇐ غطاء متعدّد الأقطار بخيار 58mm (لا الهودات) ويقول ما فهمه: ' + JSON.stringify(a));
    const b = await S('هود عدسة 18-55');
    ok(b.cards.join(',') === 's_hood' && /EW-63C/.test(b.say), W + ': «هود عدسة 18-55» ⇐ الهود اللولبي 58mm وحده: ' + JSON.stringify(b).slice(0, 200));
    const c = await S('بجارية 700d');
    ok(c.cards.join(',') === 's_bat' && /LP-E8/.test(c.say), W + ': «بجارية 700d» ⇐ بطارية LP-E8: ' + JSON.stringify(c));
    const d = await S('غطاء 77');
    ok(d.cards.join(',') === 's_caps:77mm', W + ': «غطاء 77» ⇐ الخيار 77mm: ' + JSON.stringify(d));
    const e = await S('660');
    ok(e.cards.includes('s_led') && !e.say, W + ': البحث العادي كما كان (بالاسم) بلا جملة توافق: ' + JSON.stringify(e));
    // فتح النتيجة ⇐ الخيار مختار ومواصفاته وتوافقه
    await S('غطا عدسة 85');
    await pg.evaluate(() => document.querySelector('#search-results-section [data-sr-id="s_caps"]').click()); await sleep(600);
    const m = await pg.evaluate(() => ({ sel: [...document.querySelectorAll('#product-modal-variants button.border-primary')].map(b => b.textContent.trim()),
      specs: (document.getElementById('product-modal-specs') || {}).innerText || '', code: (document.getElementById('product-modal-code') || {}).textContent || '' }));
    ok(m.sel.join('|') === '58mm' && /85mm/.test(m.specs) && /58 مم/.test(m.specs) && m.code === 'CAP58', W + ': يُفتح والخيار 58mm مختار · المواصفات والتوافق والكود لهذا القطر: ' + JSON.stringify({ sel: m.sel, code: m.code, sp: m.specs.replace(/\s+/g, ' ').slice(0, 120) }));
    await pg.evaluate(() => [...document.querySelectorAll('#product-modal-variants button')].find(b => b.textContent.trim() === '49mm').click()); await sleep(200);
    const m2 = await pg.evaluate(() => ({ specs: document.getElementById('product-modal-specs').innerText, code: document.getElementById('product-modal-code').textContent }));
    ok(/50mm f\/1\.8 STM/.test(m2.specs) && !/85mm/.test(m2.specs) && m2.code === 'CAP49', W + ': اختيار 49mm ⇐ تتبدّل المواصفات والتوافق والكود: ' + m2.code);
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
