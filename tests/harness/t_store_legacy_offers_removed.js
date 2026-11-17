// (VER-3#REQ-0353) أدمن المتجر: لا كود قديم يكتب عروضاً في adminData.offers خارج gmt_offers — التبويب واجهة الأداة الموحّدة فقط
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const o = await H.open('admin_store.html', { w: 1100, h: 800, mobile: false, wait: 3500 });
  const r = await o.pg.evaluate(() => ({ m: !!document.getElementById('offer-modal'), a: typeof window.openOfferModal, b: typeof window.saveOffer, c: typeof window.confirmDeleteOffer, t: !!window.GMTOffersTool, mount: !!document.getElementById('gmt-offers-mount-store') }));
  ok(!r.m, 'نافذة offer-modal القديمة محذوفة');
  ok(r.a === 'undefined' && r.b === 'undefined' && r.c === 'undefined', 'دوال العروض القديمة محذوفة');
  ok(r.t && r.mount, 'الأداة الموحّدة GMTOffersTool وعقدة تركيبها موجودتان');
  await o.pg.evaluate(() => { switchTab('offers'); renderOffersAdmin(); }); await o.pg.waitForTimeout(800);
  ok(await o.pg.evaluate(() => document.getElementById('gmt-offers-mount-store').children.length > 0), 'تبويب العروض يُركَّب من الأداة الموحّدة');
  ok(!o.errs.filter(e => !/vibrate|406/.test(e)).length, 'بلا أخطاء JS: ' + o.errs.join('|'));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
