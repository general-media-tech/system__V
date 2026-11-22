// (TASK-A0571/A0573 · المالك seq 970 «أي جهاز أوّل مرّة بفتحه ما بتطلع لي فقط شاشة بيضاء»)
// كلّ صفحة موظّفين سكربتاتها قبل محتواها: ① تنزيلٌ بطيء ⇒ شاشة «جارٍ تجهيز …» ظاهرة (لا بيضاء)
//  ② وتختفي حين تجهز الصفحة   ③ فتحٌ سريع ⇒ لا وميض (مخفيّة أوّل ٠٫٦ث ثمّ تُزال)
const H = require('./h.js');
const { chromium } = require('playwright');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAGES = ['pos.html', 'inventory.html', 'orders.html', 'purchase.html', 'admin_pos.html', 'home.html', 'center.html'];
(async () => {
  await H.seed();
  const b = await chromium.launch();
  for (const pgName of PAGES) {
    // ①②
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
    await ctx.addInitScript(H.ADMIN_INIT);
    await ctx.route('**/gmt-core.js*', async r => { await sleep(3000); r.continue(); });
    const pg = await ctx.newPage();
    pg.goto(H.BASE + '/' + encodeURI(pgName)).catch(() => {});
    await sleep(1600);
    const st = await pg.evaluate(() => { const s = document.getElementById('gmt-first-splash'); return s ? { op: +getComputedStyle(s).opacity, txt: s.innerText.replace(/\s+/g, ' ').slice(0, 60) } : null; }).catch(() => null);
    ok(st && st.op > 0.9 && /جارٍ تجهيز/.test(st.txt), pgName + ' ① تنزيلٌ بطيء ⇒ ' + (st ? st.txt : 'لا شاشة'));
    await sleep(6500);
    const gone = await pg.evaluate(() => !document.getElementById('gmt-first-splash')).catch(() => false);
    ok(gone, pgName + ' ② اختفت حين جهزت الصفحة');
    await ctx.close();
    // ③
    const ctx2 = await b.newContext({ viewport: { width: 390, height: 800 } });
    await ctx2.addInitScript(H.ADMIN_INIT);
    const pg2 = await ctx2.newPage();
    pg2.goto(H.BASE + '/' + encodeURI(pgName)).catch(() => {});
    await sleep(350);
    const early = await pg2.evaluate(() => { const s = document.getElementById('gmt-first-splash'); return s ? +getComputedStyle(s).opacity : -1; }).catch(() => -1);
    ok(early < 0.05, pgName + ' ③ فتحٌ سريع ⇒ لا وميض (الشفافية ' + early + ')');
    await ctx2.close();
  }
  await b.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
