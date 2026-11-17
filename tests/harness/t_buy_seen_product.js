// (ARC-MD-03#92 · OWN-05#56) «ما يجب شراؤه»: «➕ منتج رأيناه» — منتجٌ جديد غير موجود بالجرد (اسم · كمية · رابط · فيديو · صورة · ملاحظة)
// يُحفظ مشتركاً (gmt_settings/buy_wishlist) ويدخل ملف طلب عرض السعر (ورقة «منتجات جديدة») والطباعة والنسخ — واستيراد العرض لا ينكسر.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  let { browser, pg, errs } = await H.open('ما_يجب_شراؤه.html', { w: 1366, h: 900, mobile: false, wait: 4000 });
  const has = await pg.evaluate(() => !!document.getElementById('b-free') && /منتج رأيناه/.test(document.getElementById('b-free').textContent));
  ok(has, 'زرّ «➕ منتج رأيناه» موجود');
  /* الإضافة عبر النموذج الحقيقي (GMTAsk.form) */
  await pg.click('#b-free'); await pg.waitForTimeout(300);
  const nf = await pg.evaluate(() => document.querySelectorAll('.gmtask-in').length);
  ok(nf === 6, 'النموذج: اسم · كمية · رابط · فيديو · صورة · ملاحظة (' + nf + ')');
  await pg.evaluate(() => {
    const ins = [...document.querySelectorAll('.gmtask-in')];
    const v = ['ضوء فلاش تجريبي X', '4', 'https://example.com/p/x', 'not-a-url', '', 'رأيناه عند المورد'];
    ins.forEach((el, i) => { el.value = v[i]; });
    [...document.querySelectorAll('.gmtask-bx button')].find(b => /حفظ/.test(b.textContent)).click();
  });
  await pg.waitForTimeout(300);
  const err = await pg.evaluate(() => (document.querySelector('.gmtask-bx') || {}).innerText || '');
  ok(/https/.test(err), 'رابطٌ غير صالح يُرفض برسالة: ' + (err.match(/الرابط[^\n]*/) || [''])[0]);
  await pg.evaluate(() => {
    const ins = [...document.querySelectorAll('.gmtask-in')]; ins[3].value = 'https://video.example.com/v/1';
    [...document.querySelectorAll('.gmtask-bx button')].find(b => /حفظ/.test(b.textContent)).click();
  });
  await pg.waitForTimeout(800);
  const row = await pg.evaluate(() => { const r = document.querySelector('#free [data-fi]'); return r ? r.innerText : ''; });
  ok(/ضوء فلاش تجريبي X/.test(row) && /الرابط/.test(row) && /الفيديو/.test(row), 'يظهر في القائمة بروابطه: ' + row.replace(/\s+/g, ' ').slice(0, 80));
  const d = await H.call('/__dump', undefined, 'GET');
  const st = (d.gmt_settings || []).find(x => x.key === 'buy_wishlist');
  const saved = st ? JSON.parse(st.value) : [];
  ok(saved.length === 1 && saved[0].qty === 4 && saved[0].video === 'https://video.example.com/v/1', 'محفوظٌ مشتركاً في القاعدة (gmt_settings/buy_wishlist): ' + JSON.stringify(saved[0] || {}).slice(0, 90));

  /* التصدير: Excel · طباعة · نسخ — حتى بلا أيّ منتجٍ ناقص محدّد */
  await pg.evaluate(() => document.getElementById('f-none').click());
  await pg.evaluate(() => document.getElementById('b-xl').click());
  await pg.waitForFunction(() => window.__lastBuyBook, null, { timeout: 15000 }).catch(() => {});
  const xl = await pg.evaluate(() => { const wb = window.__lastBuyBook; if (!wb) return null; const ws = wb.getWorksheet('منتجات جديدة'); if (!ws) return { names: wb.worksheets.map(w => w.name) };
    const r = ws.getRow(2); const v = c => { const x = r.getCell(c).value; return x && x.hyperlink ? x.hyperlink : x; };
    return { names: wb.worksheets.map(w => w.name), name: v(3), link: v(4), video: v(5), qty: v(7), hdr: ws.getRow(1).values.join('|') }; });
  ok(xl && xl.name === 'ضوء فلاش تجريبي X' && xl.link === 'https://example.com/p/x' && xl.video === 'https://video.example.com/v/1' && xl.qty === 4,
    'ملف طلب عرض السعر فيه ورقة «منتجات جديدة» بالاسم والروابط والكمية: ' + JSON.stringify(xl || {}).slice(0, 120));
  ok(xl && !/الباركود/.test(xl.hdr || ''), 'ورقة «منتجات جديدة» بلا عمود باركود ⇒ استيراد العرض في المشتريات يتجاهلها');
  await pg.evaluate(() => document.getElementById('b-pr').click()); await pg.waitForTimeout(300);
  const pr = await pg.evaluate(() => window.__lastBuyPrint || '');
  ok(/منتجات جديدة رأيناها/.test(pr) && /ضوء فلاش تجريبي X/.test(pr) && /video\.example\.com/.test(pr), 'الطباعة/PDF للمورّد تتضمّن المنتج الجديد وروابطه');
  /* إلغاء التحديد ⇒ لا يدخل التصدير */
  await pg.evaluate(() => { const c = document.querySelector('#free .fck'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.waitForTimeout(400);
  const off = await pg.evaluate(() => document.getElementById('free-n').textContent);
  ok(/0 محدّد من 1/.test(off), 'إلغاء تحديده يُخرجه من التصدير: ' + off);
  await browser.close();

  /* فتحٌ جديد ⇒ القائمة من القاعدة */
  await H.call('/rest/v1/gmt_settings?key=eq.buy_wishlist', { value: JSON.stringify([{ name: 'منتج من جهاز آخر', qty: 2, on: true }]) }, 'PATCH');
  ({ browser, pg, errs } = await H.open('ما_يجب_شراؤه.html', { w: 390, h: 800, wait: 4000 }));
  const r2 = await pg.evaluate(() => ({ t: document.getElementById('free').innerText, ov: document.documentElement.scrollWidth - innerWidth }));
  ok(/منتج من جهاز آخر/.test(r2.t), 'القائمة مشتركة بين الأجهزة (تُقرأ من القاعدة)');
  ok(r2.ov <= 1, 'لا طفح أفقي على الموبايل: ' + r2.ov);
  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|favicon|vibrate/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
