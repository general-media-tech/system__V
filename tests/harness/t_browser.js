// (TASK-0322 · المالك seq 514) متصفّح المنتجات: منتجٌ واحد في كلّ مرّة — صفحته في المتجر + بطاقته في الجرد + ما ينقصه ·
// «✅ رُوجع» يختمه في القاعدة وينتقل للتالي · الفلاتر · ملاحظة · إلغاء المراجعة · التالي/السابق ولوحة المفاتيح.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
const W = Number(process.env.W || 1366);
(async () => {
  await H.seed();
  const prods = await H.call('/rest/v1/products', [
    { name: 'أ — كاميرا متصفّح', barcode: 'BR1', price: 700, wholesale_price: 600, net_cost: 550, daraa: 3, haleb: 1, group_name: 'زمتصفح', category: 'كاميرات', brand: 'Canon', alt_names: 'R50', image_url: 'https://x.example/a.jpg', images: ['https://x.example/a.jpg', 'https://x.example/a2.jpg'], store_url: '#product=s_a', specs: { 'الدقة': '24MP', __desc: 'كاميرا خفيفة' } },
    { name: 'ب — عدسة متصفّح', barcode: 'BR2', price: 200, daraa: 2, group_name: 'زمتصفح' },
    { name: 'ج — بطارية متصفّح', barcode: 'BR3', price: 30, daraa: 5, group_name: 'زمتصفح', store_url: '#product=s_c' }]);
  await H.call('/rest/v1/gmt_store', [{ id: 1, categories: [{ id: 'c1', name: 'كاميرات' }], products: [{ id: 's_a', name: 'أ — كاميرا متصفّح', price: 700, category_ids: ['c1'], images: ['https://x.example/a.jpg'] }, { id: 's_c', name: 'ج — بطارية متصفّح', price: 30, category_ids: ['c1'], images: [] }], banners: [] }]);
  const { browser, pg, errs } = await H.open('inventory.html', { init: H.ADMIN_INIT + ";try{localStorage.removeItem('gmt_browser_state')}catch(e){}", w: W, h: 900, mobile: W < 700, wait: 7000 });
  await pg.waitForFunction(() => !!window.GMTBrowser, null, { timeout: 8000 });
  await pg.evaluate(() => openProductBrowser()); await pg.waitForSelector('#gmt-br'); await pg.waitForTimeout(600);
  await pg.selectOption('#gmt-br [data-group]', 'زمتصفح'); await pg.waitForTimeout(400);
  const s1 = await pg.evaluate(() => ({ pos: document.querySelector('#gmt-br [data-pos]').textContent, card: document.querySelector('#gmt-br [data-card]').innerText, fr: (document.querySelector('#gmt-br iframe') || {}).src || '' }));
  ok(s1.pos === '1 / 3' && /أ — كاميرا متصفّح/.test(s1.card), 'يبدأ بأوّل منتج غير مُراجَع في المجموعة (1 / 3)');
  ok(/store\.html\?direct=1#product=s_a/.test(s1.fr), 'صفحته الحقيقية في المتجر داخل المتصفّح: ' + s1.fr.replace(/^.*\//, ''));
  ok(/2 صورة/.test(s1.card) && /24MP/.test(s1.card) && /كاميرا خفيفة/.test(s1.card) && /\$700\.00/.test(s1.card) && /\$550\.00/.test(s1.card) && /4/.test(s1.card) && /Canon/.test(s1.card), 'البطاقة: الصور · المواصفات · الوصف · الأسعار والكلفة · المخزون (4) · الماركة');
  await pg.waitForTimeout(2500);
  const inFrame = await pg.evaluate(() => { try { const d = document.querySelector('#gmt-br iframe').contentDocument; return (d.getElementById('product-modal-name') || {}).textContent || ''; } catch (e) { return 'ERR ' + e.message; } });
  ok(/كاميرا متصفّح/.test(inFrame), 'المتجر داخل الإطار فتح صفحة المنتج نفسه: «' + inFrame + '»');
  await pg.fill('#gmt-br [data-note]', 'الصورة الثانية تحتاج تبديلاً');
  await pg.click('#gmt-br [data-ok]'); await pg.waitForTimeout(800);
  let D = await dump(); let a = D.products.find(p => p.id === prods[0].id);
  ok(a.reviewed_at && a.reviewed_by && a.review_note === 'الصورة الثانية تحتاج تبديلاً', '«✅ رُوجع» خُتم في القاعدة (الوقت · المراجِع · الملاحظة): ' + a.reviewed_by);
  const s2 = await pg.evaluate(() => ({ pos: document.querySelector('#gmt-br [data-pos]').textContent, card: document.querySelector('#gmt-br [data-card]').innerText, store: document.querySelector('#gmt-br [data-storebox]').innerText }));
  ok(s2.pos === '1 / 2' && /ب — عدسة متصفّح/.test(s2.card), 'انتقل للتالي غير المُراجَع (1 / 2)');
  ok(/غير مربوط بالمتجر/.test(s2.store) && /بلا صورة/.test(s2.card) && /بلا مواصفات/.test(s2.card), 'منتجٌ ناقص: «غير مربوط بالمتجر» وشارات النقص');
  await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(500);
  const s3 = await pg.evaluate(() => [document.querySelector('#gmt-br [data-pos]').textContent, (document.querySelector('#gmt-br iframe') || {}).src || '']);
  ok(s3[0] === '2 / 2' && /#product=s_c/.test(s3[1]), 'السهم ← ينتقل للتالي ويفتح صفحته في الإطار نفسه: ' + s3.join(' · '));
  await pg.click('#gmt-br [data-prev]'); await pg.waitForTimeout(300);
  ok(await pg.textContent('#gmt-br [data-pos]') === '1 / 2', 'زرّ «السابق»');
  await pg.selectOption('#gmt-br [data-mode]', 'reviewed'); await pg.waitForTimeout(400);
  const s4 = await pg.evaluate(() => ({ pos: document.querySelector('#gmt-br [data-pos]').textContent, card: document.querySelector('#gmt-br [data-card]').innerText, note: document.querySelector('#gmt-br [data-note]').value }));
  ok(s4.pos === '1 / 1' && /رُوجع/.test(s4.card) && s4.note === 'الصورة الثانية تحتاج تبديلاً', 'فلتر «رُوجعت» يعرض المنتج المختوم وملاحظته');
  await pg.click('#gmt-br [data-unrev]'); await pg.waitForTimeout(600);
  D = await dump(); a = D.products.find(p => p.id === prods[0].id);
  ok(!a.reviewed_at, '«↩️ إلغاء المراجعة» يعيده غير مُراجَع');
  await pg.selectOption('#gmt-br [data-mode]', 'issues'); await pg.waitForTimeout(300);
  ok(await pg.textContent('#gmt-br [data-pos]') === '1 / 2', 'فلتر «ناقصة البيانات»: المنتجان الناقصان فقط (الأوّل مكتمل)');
  await pg.fill('#gmt-br [data-q]', 'BR3'); await pg.waitForTimeout(300);
  ok(await pg.textContent('#gmt-br [data-pos]') === '1 / 1' && /بطارية/.test(await pg.textContent('#gmt-br [data-card]')), 'البحث بالباركود');
  const geo = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth }));
  ok(geo.sw <= geo.vw + 1, 'لا طفح أفقي: ' + JSON.stringify(geo));
  await pg.click('#gmt-br [data-close]');
  ok(!(await pg.$('#gmt-br')), 'الإغلاق');
  const real = errs.filter(x => !/Failed to load resource|status of (400|404|406)/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 3)));
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
