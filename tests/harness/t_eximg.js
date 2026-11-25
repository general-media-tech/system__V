// TASK-B0568 · A989–A991 م٤ · seq B1106 — صورة بصفّ غلط: إزاحة بتتصحّح لحالها · صورة يتيمة · مكرّرة · اختيار يدوي
const H = require('./h.js'), path = require('path');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 6000 });
  const read = async f => { await pg.evaluate(() => { try { exRows = []; } catch (_) {} }); await pg.setInputFiles('#excel-file', path.join(__dirname, f)); await pg.waitForFunction(() => exRows.length > 0, null, { timeout: 15000 }).catch(() => {}); await sleep(400); };
  const colors = () => pg.evaluate(() => Promise.all(exRows.map(r => { const u = r.image_url || ''; if (!u) return Promise.resolve(r.name + ':-'); return new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 4, 4); const d = x.getImageData(2, 2, 1, 1).data; res(r.name + ':' + (d[0] > 200 ? 'R' : d[1] > 200 ? 'G' : d[2] > 200 ? 'B' : '?')); }; im.onerror = () => res(r.name + ':!'); im.src = u; }); })));
  await read('xl_img_shift.xlsx');
  let c = await colors(), warn = await pg.evaluate(() => (document.querySelector('[data-ex-imgwarn]') || {}).textContent || '');
  ok(c.join('|') === 'عدسة حمرا:R|عدسة خضرا:G|عدسة زرقا:B', 'الصور مزاحة صفّ لفوق ⇐ النظام صحّحها لحاله وكلّ بند أخد صورته: ' + c.join(' | '));
  ok(/مزاحة صفّ لفوق/.test(warn), 'وبيقلّك: «🔧 صور الملف كانت مزاحة صفّ — صحّحتها»');
  await read('xl_img_orphan.xlsx');
  c = await colors(); warn = await pg.evaluate(() => (document.querySelector('[data-ex-imgwarn]') || {}).textContent || '');
  ok(c.join('|') === 'فلتر أ:R|فلتر ب:G', 'الصور برقم صفّها (ما في إزاحة غلط): ' + c.join(' | '));
  ok(/1 صورة بالملف ما انربطت/.test(warn), 'تنبيه: «⚠️ 1 صورة ما انربطت بأيّ بند — اضغط على صورة البند»: ' + warn);
  /* اختيار يدوي: فلتر ب ⇐ الصورة الزرقا (اليتيمة) */
  await pg.evaluate(() => _exPickImg(1)); await sleep(200);
  ok(await pg.evaluate(() => document.querySelectorAll('#ex-img-pick [data-k]').length === 3), 'نافذة «🖼️ صورة البند»: كلّ صور الملف (3) + «بلا صورة»');
  await pg.evaluate(() => { const bs = [...document.querySelectorAll('#ex-img-pick [data-k]')]; const blue = bs.find(b => { const im = b.querySelector('img'); const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 4, 4); return x.getImageData(2, 2, 1, 1).data[2] > 200; }); blue.click(); }); await sleep(200);
  c = await colors(); warn = await pg.evaluate(() => (document.querySelector('[data-ex-imgwarn]') || {}).textContent || '');
  ok(c[0] === 'فلتر أ:R' && c[1] === 'فلتر ب:B' && /1 صورة بالملف ما انربطت/.test(warn), 'اخترت الزرقا لفلتر ب ⇐ انتقلت · والخضرا صارت هي اللي ما انربطت (التنبيه بيتحدّث): ' + c.join(' | '));
  /* مكرّرة: نفس الصورة الحمرا للتنين */
  await pg.evaluate(() => _exPickImg(1)); await sleep(150);
  await pg.evaluate(() => { const bs = [...document.querySelectorAll('#ex-img-pick [data-k]')]; const red = bs.find(b => { const im = b.querySelector('img'); const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 4, 4); return x.getImageData(2, 2, 1, 1).data[0] > 200; }); red.click(); }); await sleep(200);
  warn = await pg.evaluate(() => (document.querySelector('[data-ex-imgwarn]') || {}).textContent || '');
  ok(/نفس الصورة على أكتر من بند/.test(warn) && await pg.evaluate(() => /outline/.test(document.querySelector('[data-ex-img="0"]').getAttribute('style'))), 'نفس الصورة على بندين ⇐ تنبيه + إطار برتقالي');
  /* ملفات الصور القديمة ما تأثّرت */
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
