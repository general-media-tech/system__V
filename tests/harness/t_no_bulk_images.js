// (المالك seq 807) الصور على GitHub ⇒ لا تنزيل جماعي لكل صور المنتجات عند التثبيت — تُحفظ الصورة لحظة ظهورها فقط (كالمتجر)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('home.html', { wait: 5000 });
  const a = await pg.evaluate(() => ({ flag: window.GMTWarmup && GMTWarmup.AUTO_IMAGES, has: !!(window.GMTWarmup && GMTWarmup.images) }));
  ok(a.has && a.flag === false, 'التنزيل الجماعي التلقائي للصور مطفأ (AUTO_IMAGES=false) والتنزيل اليدوي باقٍ');
  await pg.evaluate(() => { window.dispatchEvent(new Event('appinstalled')); });
  await sleep(2500);
  const s = await pg.evaluate(() => { const S = GMTWarmup.imagesState ? GMTWarmup.imagesState() : {}; return { running: !!S.running, total: S.total || 0, card: !!document.getElementById('dv-img') }; });
  ok(!s.running && !s.total && !s.card, 'لحظة التثبيت: لا تنزيل لكل الصور ولا بطاقة تقدّم: ' + JSON.stringify(s));
  const t = await pg.evaluate(() => document.body.innerText.includes('عند التثبيت تنزل صور المنتجات'));
  ok(!t, 'لا نصّ يَعِد بتنزيل الصور عند التثبيت');
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
