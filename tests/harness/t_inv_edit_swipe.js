// (المالك seq 268/269) الجرد على الكمبيوتر: «تعديل» يفتح صفحة التعديل الكاملة (لا النافذة القديمة) · صور عرض المنتج تتقلّب
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [P] = await H.call('/rest/v1/products', [{ name: 'منتج بثلاث صور', barcode: 'SW1', price: 10, haleb: 2, image_url: 'img/logo.png', images: ['img/logo.png', 'img/products/owner/mic_stand_box.jpg', 'img/products/owner/pocket_camera_box.jpg'] }]);
  const { browser, pg, errs } = await H.open('inventory.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  await pg.evaluate(id => openDetailModal(id), P.id); await sleep(800);
  const v = await pg.evaluate(() => { const r = document.querySelector('#detail-modal [data-swipe-row]'); return r ? { n: r.querySelectorAll('img').length, c: document.querySelector('#detail-modal [data-swipe-count]').textContent } : null; });
  ok(v && v.n === 3 && /1 \/ 3/.test(v.c), 'التفاصيل: شريط بكلّ الصور الثلاث وعدّاد «1 / 3»: ' + JSON.stringify(v));
  await pg.evaluate(() => document.querySelector('#detail-modal [aria-label="التالية"]').click()); await sleep(900);
  const c2 = await pg.evaluate(() => document.querySelector('#detail-modal [data-swipe-count]').textContent);
  ok(/2 \/ 3/.test(c2), 'زرّ «التالية» يقلب للصورة الثانية: ' + c2);
  await pg.evaluate(() => closeModal('detail-modal')); await sleep(300);
  await pg.evaluate(id => invGuardedEdit(id), P.id); await sleep(1500);
  const full = await pg.evaluate(() => ({ pe: !!document.querySelector('#gmt-pe'), old: (document.getElementById('product-modal') || {}).classList?.contains('open') }));
  ok(full.pe && !full.old, '«تعديل» يفتح صفحة التعديل الكاملة لا النافذة القديمة: ' + JSON.stringify(full));
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
