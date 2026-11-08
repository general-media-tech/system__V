// (TASK-0342 · المالك seq 584 «طبّق على الكل») بوّابة رفع الصور: تصغير ≤1600 + تخزين مؤقّت 30 يوماً — fetch مباشر وFormData (مكتبة supabase)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg, ctx, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 4000 });
  const got = [];
  await ctx.route('**/storage/v1/object/products-images/**', async r => { const q = r.request(); got.push({ len: (q.postDataBuffer() || Buffer.alloc(0)).length, cc: q.headers()['cache-control'] || '', ct: q.headers()['content-type'] || '' }); r.fulfill({ status: 200, body: '{"Key":"x"}', headers: { 'Content-Type': 'application/json' } }); });
  const sizes = await pg.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 4000; cv.height = 3000; const c = cv.getContext('2d');
    for (let i = 0; i < 4000; i++) { c.fillStyle = 'hsl(' + (i * 37 % 360) + ',70%,' + (30 + i % 50) + '%)'; c.fillRect((i * 97) % 4000, (i * 53) % 3000, 60, 45); }
    const big = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.95));
    await fetch(GMT_DB.MAIN.url + '/storage/v1/object/products-images/t1.jpg', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: big });
    const fd = new FormData(); fd.append('cacheControl', '3600'); fd.append('', big, 't2.jpg');
    await fetch(GMT_DB.MAIN.url + '/storage/v1/object/products-images/t2.jpg', { method: 'POST', body: fd });
    const small = await new Promise(r => { const c2 = document.createElement('canvas'); c2.width = 200; c2.height = 200; c2.toBlob(r, 'image/png'); });
    await fetch(GMT_DB.MAIN.url + '/storage/v1/object/products-images/t3.png', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: small });
    return { big: big.size, small: small.size };
  });
  await new Promise(r => setTimeout(r, 500));
  ok(got.length === 3, 'ثلاث عمليات رفع وصلت ' + got.length);
  ok(got[0] && got[0].len < sizes.big * 0.6 && /max-age=2592000/.test(got[0].cc), '① رفع مباشر: صُغّرت (' + sizes.big + ' ⇐ ' + (got[0] && got[0].len) + ') وتخزين 30 يوماً');
  ok(got[1] && got[1].len < sizes.big * 0.6 && /multipart/.test(got[1].ct), '② FormData (مكتبة supabase): صُغّرت (' + (got[1] && got[1].len) + ')');
  ok(got[2] && got[2].len <= sizes.small + 50, '③ صورة صغيرة أصلاً تمرّ كما هي (' + sizes.small + ' ⇐ ' + (got[2] && got[2].len) + ')');
  const dims = await pg.evaluate(async () => { const b = await GMTShrinkImage(await new Promise(r => { const c = document.createElement('canvas'); c.width = 3000; c.height = 1000; c.getContext('2d').fillRect(0, 0, 10, 10); c.toBlob(r, 'image/jpeg', 0.99); })); const bm = await createImageBitmap(b); return [bm.width, bm.height]; });
  ok(dims[0] === 1600 && dims[1] === 533, '④ أطول ضلع 1600 مع حفظ النسبة ' + JSON.stringify(dims));
  ok(!errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e)).length, 'لا أخطاء JS');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
