// (TASK-A0579 · seq 977: فراغ قصّ 2مم بين الملصقات ⇒ الخانة 32.8×10.3 · 27.9×9.0) (TASK-A0512 · المالك seq 757) «طباعة الباركود كتير مخلي الحجم كبير انا طلبت نصغره»: الافتراضي صار ٦ بالصف (35×12.4mm) · الاختيار يُحفظ.
const H = require('./h.js');
let pass = 0, fails = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
(async () => {
  /* متصفّح خامّ بلا حرّاس h.js: الورقة صفحةٌ مستقلّة تُكتب بـsetContent */
  const { chromium } = require('playwright'); const browser = await chromium.launch(); const pg = await browser.newPage({ viewport: { width: 1000, height: 1300 } });
  await pg.goto(H.BASE + encodeURI('شو_الجديد.html'), { waitUntil: 'domcontentloaded' }).catch(() => {}); await pg.addScriptTag({ url: H.BASE + 'gmt-labels.js' });
  const html = await pg.evaluate(base => { const it = []; for (let i = 0; i < 40; i++) it.push({ name: 'منتج ' + i, barcode: '6793525807' + (200 + i), qty: 5 }); return GMTLabels.sheetHtml(GMTLabels.expand(it), { base }); }, H.BASE);
  const m = s => (s / 3.7795).toFixed(1);
  const read = () => pg.evaluate(() => { const p = document.querySelector('.page'), c = p.querySelector('.lb').getBoundingClientRect(); return { sel: document.getElementById('lay').value, n: p.querySelectorAll('.lb').length, w: c.width, h: c.height, bars: document.querySelectorAll('.bc svg rect').length > 0 }; });
  await pg.setContent(html, { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => document.querySelector('.bc svg rect'), null, { timeout: 15000 }).catch(() => {});
  let r = await read();
  ok(r.sel === '6' && r.n === 144 && Math.abs(m(r.w) - 32.8) < 0.6 && Math.abs(m(r.h) - 10.3) < 0.6 && r.bars, 'الافتراضي: ٦ بالصف · ١٤٤ بالورقة · ' + ' · ' + m(r.w) + '×' + m(r.h) + 'mm · الشريط مرسوم');
  await pg.selectOption('#lay', '7'); await pg.waitForTimeout(500); r = await read();
  ok(r.n === 189 && Math.abs(m(r.w) - 27.9) < 0.6, 'الأصغر: ٧ بالصف · ١٨٩ بالورقة · ' + m(r.w) + '×' + m(r.h) + 'mm');
  await pg.setContent(html, { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => document.querySelector('.bc svg rect'), null, { timeout: 15000 }).catch(() => {}); r = await read();
  ok(r.sel === '7', 'الاختيار الأخير يُحفظ على الجهاز: ' + r.sel);
  const opts = await pg.evaluate(() => [...document.querySelectorAll('#lay option')].map(o => o.value).join(','));
  ok(opts === '8,7,6,5,4,3', 'المقاسات من الأصغر للأكبر — والقديمة باقية: ' + opts);
  // (seq B1067) ٨ بالصفّ: ٢٤٠ ملصقاً بالورقة بخطٍّ أصغر
  await pg.selectOption('#lay', '8'); await pg.waitForTimeout(500); r = await read();
  ok(r.n === 200 && await pg.evaluate(() => document.querySelectorAll('.page').length === 1) && Math.abs(m(r.w) - 24.1) < 0.7 && await pg.evaluate(() => !!document.querySelector('.page.xs')), '(seq B1067) «٨ بالصفّ» ⇒ الـ٢٠٠ ملصق بورقة واحدة (السعة ٢٤٠) · ' + m(r.w) + '×' + m(r.h) + 'mm بخطٍّ أصغر');
  await browser.close();
console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
