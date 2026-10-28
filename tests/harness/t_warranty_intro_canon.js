// (TASK-0216 · المالك seq 145) «في انترو الكفالة طلبنا شعار كانون الاصلي ما بدنا شعار الشركة»
// الجذر: حارس الشعارات في gmt-brand.js يطابق src*="logo.png" ⇒ canonlogo.png كان يُبدَّل بشعار الشركة المضمَّن.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="42"><text y="35" font-size="36" fill="#D5001C">Canon</text></svg>';
(async () => {
  await H.seed();
  await H.call('/rest/v1/warranties', [{ short_id: 'W700', customer_name: 'محمد', customer_typed_name: 'محمد', product_name: 'Canon EOS R50', serial_no: 'SN-7', status: 'active', expiry_date: '2027-10-01', purchase_date: '2026-10-01', warranty_type: 'standard', activation_status: 'activated', activation_date: '2026-10-02' }]);
  const { browser, ctx, pg, errs } = await H.open('guarantee.html?w=W700', { w: 390, h: 844, mobile: true, wait: 300, init: H.STAFF_INIT,
    route: null });
  let wmOk = false;
  await ctx.route(/wikimedia\.org/, r => wmOk ? r.fulfill({ status: 200, body: SVG, headers: { 'Content-Type': 'image/svg+xml' } }) : r.fulfill({ status: 429, body: 'Too many requests' }));
  // ① ويكيميديا ترفض (429) ⇒ كلمة «Canon» لا شعار الشركة
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const s = document.getElementById('intro-stage-2'); return s && !s.classList.contains('hidden'); }, null, { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  const f = await pg.evaluate(() => ({ imgs: [...document.querySelectorAll('#intro-overlay img')].map(i => (i.currentSrc || i.src).slice(0, 40)), txt: [...document.querySelectorAll('#intro-overlay span')].map(s => s.textContent).filter(Boolean) }));
  ok(!f.imgs.some(x => /^data:image\/jpeg|logo\.(jpg|png)/.test(x)) && f.txt.filter(t => t === 'Canon').length >= 1, 'ويكيميديا ترفض ⇒ «Canon» بالأحمر · لا شعار الشركة: ' + JSON.stringify(f));
  // ② ويكيميديا تعمل ⇒ شعار Canon
  wmOk = true;
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const s = document.getElementById('intro-stage-2'); return s && !s.classList.contains('hidden'); }, null, { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  const r = await pg.evaluate(() => [...document.querySelectorAll('#intro-overlay img')].map(i => ({ src: (i.currentSrc || i.src).slice(0, 80), brand: i.dataset.gmtBrand || '', ci: i.getAttribute('data-canon-i'), w: i.naturalWidth, h: i.naturalHeight, orig: i.dataset.gimgSrc || i.getAttribute('data-src') || '' })));
  ok(r.length === 2 && r.every(x => !/^data:image\/(jpeg|svg)|logo\.(jpg|png)$/.test(x.src) && !x.brand && x.w === 200 && x.h === 42), 'ويكيميديا تعمل ⇒ شعار Canon الأصلي (لا شعار الشركة ولا نائبٌ فارغ): ' + JSON.stringify(r));
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
