// TASK-B0569 · seq B1107/B1108 — «بند بلا صورة بيخربط الكلّ» + «صورتين لمنتج (مونتاج) التانية بتنزل عالتحته»
// الصور العائمة (لصاقة) والمرساة: الصورة لصاحب الصفّ اللي بتقعد فيه — مش بالترتيب
const H = require('./h.js'), path = require('path');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 6000 });
  const read = async f => { await pg.evaluate(() => { try { exRows = []; } catch (_) {} }); await pg.setInputFiles('#excel-file', path.join(__dirname, f)); await pg.waitForFunction(() => exRows.length > 0, null, { timeout: 15000 }).catch(() => {}); await sleep(400); };
  const col = () => pg.evaluate(() => { const one = u => new Promise(res => { if (!u) return res('-'); const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 4, 4); const d = x.getImageData(2, 2, 1, 1).data; res(d[0] > 200 && d[1] > 200 ? 'Y' : d[0] > 200 ? 'R' : d[1] > 200 ? 'G' : d[2] > 200 ? 'B' : '?'); }; im.onerror = () => res('!'); im.src = u; });
    return Promise.all(exRows.map(async r => r.name.split(' ')[1] + ':' + (await one(r.image_url)) + (r.images ? '+' + (await Promise.all(r.images.slice(1).map(one))).join('') : ''))); });
  for (const [f, label] of [['xl_img_montage_float.xlsx', 'صور عائمة (لصاقة)'], ['xl_img_montage_anchor.xlsx', 'صور مرساة بخلايا']]) {
    await read(f);
    const c = await col(), warn = await pg.evaluate(() => (document.querySelector('[data-ex-imgwarn]') || {}).textContent || '');
    ok(c.join('|') === 'A:R+Y|B:-|C:B', label + ': A أخد صورتيه (أحمر رئيسية + أصفر إضافية) · B بلا صورة وما أخد شي · C أخد صورته الزرقا: ' + c.join(' | '));
    ok(!/ما انربطت|نفس الصورة/.test(warn), label + ': بلا تنبيهات غلط: ' + (warn || '—'));
  }
  /* الصورة الإضافية بتنحفظ مع المنتج الجديد */
  await pg.evaluate(() => importExcel()); await sleep(1500);
  ok(await pg.evaluate(() => { const c = cart.find(x => /montage/.test(x.product.name)); return !!c && Array.isArray(c.product._excelRow && c.product._excelRow.images) && c.product._excelRow.images.length === 2; }), 'بالسلّة: المنتج A معه صورتين (رئيسية + إضافية)');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
