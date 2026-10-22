// (22 ت1 · TASK-0121) المالك: «لما بفتح الأوردرات لا تلقائياً يدخلني على إنشاء أوردر إلا إذا أنا كبست على زر إنشاء أوردر»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  for (const url of ['orders.html', 'orders.html?new=1']) {
    const { browser, pg, errs } = await H.open(url, { w: 390, h: 844, wait: 4500 });
    await pg.waitForTimeout(1500);
    const r = await pg.evaluate(() => {
      const b = document.querySelector('button[onclick*="addModal"]');
      return { open: !document.getElementById('addModal').classList.contains('hidden'), url: location.search, outline: b && b.style.outline };
    });
    ok(!r.open, url + ': نافذة «إضافة طلب» مغلقة عند الفتح');
    if (/new=1/.test(url)) ok(r.url === '' && /solid/.test(r.outline || ''), url + ': زرّ «إضافة طلب» مُبرَز فقط، والرابط نُظِّف (' + r.outline + ')');
    await pg.click('button[onclick*="addModal"]'); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => !document.getElementById('addModal').classList.contains('hidden')), url + ': ضغطة الزرّ تفتح النافذة');
    const real = errs.filter(e => !/status of (400|503)/.test(e)); ok(!real.length, url + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
