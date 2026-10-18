// (18 ت1 · لقطة المالك ٦) «زرّ التخصيص لا يعمل · الشريط السفلي لا يُربط بشيء» — نافذة تخصيص: إزالة · إضافة · ترتيب · الشريط السفلي و＋
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  for (const w of [390, 1366]) {
    console.log('— ' + w);
    const { browser, pg, errs } = await H.open('home.html', { w, mobile: w < 700, wait: 5000 });
    const tools = () => pg.evaluate(() => [...document.querySelectorAll('.k1 .tool')].map(a => a.getAttribute('data-tool')));
    const before = await tools();
    await pg.click('[data-act="edit"]'); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => /تخصيص الرئيسية/.test((document.querySelector('.ov .md') || {}).innerText || '')), '«تخصيص» يفتح نافذة التخصيص');
    // إزالة الأولى
    await pg.click('[data-cs-rm="0"]'); await pg.waitForTimeout(150);
    // إضافة أداة بالبحث
    await pg.click('[data-cs-addopen]'); await pg.waitForTimeout(150);
    await pg.fill('#cs-q', 'الكفالة'); await pg.waitForTimeout(200);
    const addF = await pg.evaluate(() => (document.querySelector('[data-cs-add]') || {}).getAttribute && document.querySelector('[data-cs-add]').getAttribute('data-cs-add'));
    if (addF) { await pg.click('[data-cs-add]'); await pg.waitForTimeout(150); }
    // ترتيب: الأخيرة ↑
    const n = await pg.evaluate(() => document.querySelectorAll('[data-cs-rm]').length);
    await pg.click('[data-cs-up="' + (n - 1) + '"]'); await pg.waitForTimeout(150);
    // الشريط السفلي: الخانة ١ = الكفالة · ＋ = الملصقات
    await pg.selectOption('[data-cs-slot="0"]', 'guarantee.html');
    await pg.selectOption('[data-cs-plus]', 'labels.html');
    await pg.click('[data-cs-save]'); await pg.waitForTimeout(500);
    const after = await tools();
    ok(!after.includes(before[0]), 'الأداة المُزالة اختفت فعلاً (' + before[0] + ') ولم تحلّ محلّها أخرى تلقائياً');
    ok(addF && after.includes(addF), 'الأداة المُضافة ظهرت: ' + addF);
    ok(after.length === before.length - 1 + (addF ? 1 : 0) || w < 700, 'العدد صحيح: ' + before.length + ' ⇠ ' + after.length);
    if (w < 700) {
      const pillHref = await pg.evaluate(() => [...document.querySelectorAll('.pill a[data-tool], .pill .pplus')].map(a => a.getAttribute('data-tool') || a.getAttribute('data-act')));
      ok(pillHref[0] === 'guarantee.html', 'الخانة الأولى بالشريط السفلي = الكفالة · ' + pillHref.join(','));
      ok(pillHref.includes('labels.html'), 'زرّ ＋ الأوسط صار يفتح الملصقات');
    }
    await pg.reload(); await pg.waitForTimeout(4500);
    const again = await tools();
    ok(JSON.stringify(again) === JSON.stringify(after), 'التخصيص باقٍ بعد إعادة التحميل');
    await pg.click('[data-act="edit"]'); await pg.waitForTimeout(300);
    await pg.click('[data-cs-reset]'); await pg.waitForTimeout(500);
    const reset = await tools();
    ok(JSON.stringify(reset) === JSON.stringify(before), '«الافتراضي» يعيد الأدوات كما كانت');
    if (w === 390) await pg.screenshot({ path: '/tmp/claude-0/-home-user-system--V/dfe65fb9-bcc1-5e5a-be94-906828e1c021/scratchpad/harness/home_custom_390.png' });
    const real = errs.filter(e => !/404|400|favicon|Failed to load/.test(e));
    ok(real.length === 0, 'لا أخطاء JS ' + real.slice(0, 2).join(' | '));
    await browser.close();
  }
  console.log(`PASS=${pass} FAIL=${fails}`);
})();
