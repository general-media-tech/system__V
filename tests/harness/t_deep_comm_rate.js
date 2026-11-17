// (VER-3#REQ-0361) المفتّش العميق يحسب عمولة دورة «بيع ⇐ مرتجع» بنسبة الإعداد commission_rate الفعلية لا «÷٢» ثابتة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
async function run(rate) {
  await H.seed();
  if (rate !== null) await H.call('/rest/v1/gmt_settings', { key: 'commission_rate', value: String(rate) });
  const { browser, pg } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 3500 });
  const amounts = [];
  pg.on('request', r => { if (r.method() === 'POST' && /invoice_commissions/.test(r.url())) { try { amounts.push(JSON.parse(r.postData()).amount); } catch (_) {} } });
  await pg.addScriptTag({ url: '/gmt-deep-inspector.js' }).catch(() => {}); await pg.waitForTimeout(500);
  const has = await pg.evaluate(() => !!(window.GMTDeepInspector && GMTDeepInspector.full));
  if (has) await pg.evaluate(() => { window.GMTAsk = null; window.confirm = () => true; return GMTDeepInspector.full(); }).catch(() => {});
  await browser.close();
  return { has, amounts };
}
(async () => {
  const a = await run(0.3);
  ok(a.has, 'full متاحة');
  ok(a.amounts[1] === 24 && a.amounts[2] === -24, 'نسبة 0.3 ⇒ عمولة (100−60)×0.3×2 = 24 ثمّ عكسها: ' + JSON.stringify(a.amounts));
  const b = await run(null);
  ok(b.amounts[1] === 40 && b.amounts[2] === -40, 'بلا إعداد ⇒ الافتراضي 0.5 ⇒ 40: ' + JSON.stringify(b.amounts));
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
