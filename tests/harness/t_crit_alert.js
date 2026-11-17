// (REQ-0314) تنبيه المالك فوراً عند خطأ حرج أثناء العمل — عبر الوسيط، بحدّ معدّل ومفتاح إيقاف
const H = require('./h.js');
let bad = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) bad++; };
async function page(url) {
  const o = await H.open(url, { w: 1200, h: 900, wait: 3000 });
  o.relay = []; o.direct = [];
  await o.ctx.route('**/functions/v1/gmt-tg/**', r => { o.relay.push(r.request().postData() || ''); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  await o.ctx.route('https://api.telegram.org/**', r => { o.direct.push(r.request().url()); r.fulfill({ status: 200, body: '{"ok":true}' }); });
  await o.pg.evaluate(() => { try { localStorage.removeItem('gmt_crit_alerts_v1'); } catch (_) {} });
  return o;
}
const boom = (pg, m) => pg.evaluate(m => { setTimeout(() => { throw new Error(m); }, 0); }, m);
(async () => {
  await H.seed();
  let o = await page('morning.html');
  await boom(o.pg, 'عطل تجريبي أ'); await o.pg.waitForTimeout(700);
  await boom(o.pg, 'عطل تجريبي أ'); await o.pg.waitForTimeout(700);
  ok(o.relay.length === 1, 'خطأ حرج مكرّر ⇒ تنبيه واحد عبر الوسيط ← ' + o.relay.length);
  ok(!o.direct.length, 'لا طلب مباشر لتيليغرام');
  ok(/خطأ حرج أثناء العمل/.test(o.relay[0] || '') && /عطل تجريبي أ/.test(o.relay[0] || ''), 'نصّ التنبيه فيه الخطأ');
  await boom(o.pg, 'عطل تجريبي ب'); await o.pg.waitForTimeout(700);
  ok(o.relay.length === 2, 'خطأ حرج مختلف ⇒ تنبيه ثانٍ ← ' + o.relay.length);
  await o.pg.evaluate(() => console.error('تحذير فقط')); await o.pg.waitForTimeout(500);
  ok(o.relay.length === 2, 'تحذير (warn) ⇒ لا تنبيه');
  for (let i = 0; i < 6; i++) await boom(o.pg, 'سيل ' + i);
  await o.pg.waitForTimeout(1200);
  ok(o.relay.length === 5, 'حدّ ٥ تنبيهات في الساعة للجهاز ← ' + o.relay.length);
  await o.browser.close();

  // مفتاح الإيقاف
  await H.call('/rest/v1/gmt_settings', { key: 'gmt_crit_alert_off', value: '1' });
  o = await page('morning.html');
  await boom(o.pg, 'عطل مع الإيقاف'); await o.pg.waitForTimeout(900);
  ok(o.relay.length === 0, 'gmt_crit_alert_off=1 ⇒ لا تنبيه ← ' + o.relay.length);
  await o.browser.close();
  await H.call('/rest/v1/gmt_settings?key=eq.gmt_crit_alert_off', undefined, 'DELETE');

  // صفحة الزبون (غير داخلية) ⇒ لا تنبيه
  o = await page('store.html');
  await boom(o.pg, 'عطل في المتجر'); await o.pg.waitForTimeout(900);
  ok(o.relay.length === 0, 'صفحة عامّة ⇒ لا تنبيه ← ' + o.relay.length);
  await o.browser.close();

  console.log(bad ? `❌ ${bad} فشل` : '✅ كلّ الفحوص نجحت');
  process.exit(bad ? 1 : 0);
})();
