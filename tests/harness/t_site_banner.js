// (TASK-A0553 · سجلّ الأخطاء: «<img> يشير لصفحة HTML» + «صورة مفقودة (404)» على الموقع ×9 أجهزة)
//  ① بانرٌ بلا صورة لا يُرسم (كان src='' يحمّل الصفحة نفسها) · وما له صورة يُرسم
//  ② كلّ البانرات بلا صور ⇒ الشريط مخفي
//  ③ إدارة الموقع: حفظ بانر بلا صورة مرفوض برسالة · لا صفّ جديد
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  await H.call('/rest/v1/banners', [
    { slot: 'bottom', sort_order: 1, is_active: true, image_url: 'https://example.com/b1.jpg', alt_text: 'بصورة' },
    { slot: 'bottom', sort_order: 2, is_active: true, image_url: '', alt_text: 'Canon EOS R5' },
    { slot: 'bottom', sort_order: 3, is_active: true, image_url: null, alt_text: 'خدمات الكفالة' },
    { slot: 'top', sort_order: 1, is_active: true, image_url: '', alt_text: 'فارغ' }]);
  const { browser, pg } = await H.open('site.html', { w: 390, h: 800, wait: 6000 });
  const r = await pg.evaluate(() => ({
    bottom: [...document.querySelectorAll('#banner-bottom img')].map(i => i.getAttribute('src')),
    topShown: getComputedStyle(document.getElementById('banner-top')).display !== 'none',
    empty: [...document.querySelectorAll('img')].filter(i => !i.getAttribute('src')).length }));
  ok(r.bottom.length === 1 && /b1\.jpg/.test(r.bottom[0]), '① السفلي: بانرٌ واحد بصورته فقط ' + JSON.stringify(r.bottom));
  ok(r.empty === 0, '① لا <img> بلا مصدر في الصفحة');
  ok(!r.topShown, '② العلوي (كلّه بلا صور) مخفي');
  await browser.close();
  // ③
  const b2 = await H.open('admin_site.html', { w: 1280, h: 900, mobile: false, wait: 6000 });
  const n0 = ((await H.call('/__dump', undefined, 'GET')).banners || []).length;
  const msg = await b2.pg.evaluate(async () => {
    const shown = []; const t0 = window.toast; window.toast = (m, k) => { shown.push(m); try { t0 && t0(m, k); } catch (_) {} };
    /* الصفحة خلف دخول قاعدة الموقع (بريد/كلمة سر) ⇒ عناصر النافذة تُضاف هنا، والدالّتان الحقيقيّتان تعملان عليها */
    if (!document.getElementById('modal-overlay')) document.body.insertAdjacentHTML('beforeend', '<div id="modal-overlay"><div id="modal-title"></div><div id="modal-body"></div><button id="modal-save-btn"></button></div>');
    openModal('banner'); await new Promise(r => setTimeout(r, 300));
    await modalSave(); return shown;
  });
  const n1 = ((await H.call('/__dump', undefined, 'GET')).banners || []).length;
  ok(msg.some(m => /يحتاج صورة/.test(m)) && n1 === n0, '③ حفظ بانر بلا صورة مرفوض ولا صفّ جديد ' + JSON.stringify(msg));
  await b2.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
