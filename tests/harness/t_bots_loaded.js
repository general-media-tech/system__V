// (VER-1#REQ-0048) البوتات الأربعة (الحارس GMTBug · المفتّش GMTInspect · الفاحص GMTSelfTest · الفحص الذاتي GMTSelfCheck) معرّفة في كل صفحات الموظفين
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const PAGES = ['pos', 'inventory', 'orders', 'purchase', 'admin_pos', 'bridge', 'labels', 'backup'];
(async () => {
  await H.seed();
  for (const p of PAGES) {
    const { browser, pg } = await H.open(p + '.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 3500 });
    const r = await pg.evaluate(() => ({ bug: typeof window.GMTBug, ins: typeof window.GMTInspect, st: typeof window.GMTSelfTest, sc: typeof window.GMTSelfCheck }));
    ok(r.bug === 'object' && r.ins === 'object' && r.st === 'object' && r.sc === 'object', p + '.html: ' + JSON.stringify(r));
    await browser.close();
  }
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
