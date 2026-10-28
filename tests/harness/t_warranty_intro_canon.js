// (TASK-0216 · المالك seq 145) «في انترو الكفالة طلبنا شعار كانون الاصلي ما بدنا شعار الشركة»
// الجذر: حارس الشعارات في gmt-brand.js يطابق src*="logo.png" ⇒ canonlogo.png كان يُبدَّل بشعار الشركة المضمَّن.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  await H.call('/rest/v1/warranties', [{ short_id: 'W700', customer_name: 'محمد', customer_typed_name: 'محمد', product_name: 'Canon EOS R50', serial_no: 'SN-7', status: 'active', expiry_date: '2027-10-01', purchase_date: '2026-10-01', warranty_type: 'standard', activation_status: 'activated', activation_date: '2026-10-02' }]);
  const { browser, ctx, pg, errs } = await H.open('guarantee.html?w=W700', { w: 390, h: 844, mobile: true, wait: 300, init: H.STAFF_INIT,
    route: null });
  await ctx.route(/wikimedia\.org/, r => r.fulfill({ status: 429, body: 'Too many requests' }));
  // ① (المالك seq 172) canonlogo.png المحلّي من صورة المالك ⇒ يظهر حتى لو رفضت ويكيميديا (429) · لا شعار الشركة
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const s = document.getElementById('intro-stage-2'); return s && !s.classList.contains('hidden'); }, null, { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  const r = await pg.evaluate(() => [...document.querySelectorAll('#intro-overlay img')].map(i => ({ src: (i.currentSrc || i.src).split('/').pop().split('?')[0], w: i.naturalWidth, h: i.naturalHeight, brand: i.dataset.gmtBrand || '' })));
  ok(r.length === 2 && r.every(x => x.src === 'canonlogo.png' && x.w === 1280 && x.h === 268 && !x.brand), 'الانترو: شعار Canon الأصلي المحلّي (ويكيميديا معطّلة) — لا شعار الشركة: ' + JSON.stringify(r));
  // ② لو غاب الملفّ المحلّي وفشلت ويكيميديا ⇒ كلمة «Canon» بالأحمر لا شعار الشركة
  await ctx.route(/canonlogo\.png/, rt => rt.fulfill({ status: 404, body: '' }));
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const s = document.getElementById('intro-stage-2'); return s && !s.classList.contains('hidden'); }, null, { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  const f = await pg.evaluate(() => ({ imgs: [...document.querySelectorAll('#intro-overlay img')].map(i => (i.currentSrc || i.src).slice(0, 40)), txt: [...document.querySelectorAll('#intro-overlay span')].map(s => s.textContent).filter(Boolean) }));
  ok(!f.imgs.some(x => /^data:image\/jpeg|logo\.(jpg|png)/.test(x)) && f.txt.filter(t => t === 'Canon').length >= 1, 'بلا ملفّ محلّي ولا ويكيميديا ⇒ «Canon» بالأحمر · لا شعار الشركة: ' + JSON.stringify(f));
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
