// (TASK-B0420 · المهمّة ٨ و٩) واجهة الإشعارات: الحالات · التفعيل من لمسة · الاشتراك بالفرع والموضوع · التفضيلات · iOS · استقبال إشعار والصفحة مفتوحة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const STUB = (supported) => `
(function(){
  window.__sub = null; window.__swl = [];
  ${supported ? `
  window.Notification = function(){}; Notification.permission = 'default'; Notification.requestPermission = async () => (Notification.permission = 'granted');
  window.PushManager = function(){};
  const reg = { active: { postMessage(){} }, pushManager: { getSubscription: async () => window.__sub, subscribe: async () => (window.__sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/TEST', toJSON(){ return { endpoint: this.endpoint, keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } }; }, unsubscribe: async () => { window.__sub = null; return true; } }) } };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve(reg), register: async () => reg, getRegistration: async () => reg, getRegistrations: async () => [reg], controller: null, addEventListener(t, f){ window.__swl.push([t, f]); } } });
  ` : `try { delete window.PushManager; } catch(e) { window.PushManager = undefined; }`}
})();`;
(async () => {
  await H.seed();
  // ① أندرويد/كمبيوتر مدعوم
  let o = await H.open('pos.html', { init: H.STAFF_INIT + STUB(true), w: 390, mobile: true, wait: 5500 });
  const calls = [];
  await o.ctx.route('**/functions/v1/push-subscribe**', async r => { const b = JSON.parse(r.request().postData() || '{}'); calls.push(b); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(b.action === 'key' ? { ok: true, key: 'B'.repeat(87) } : { ok: true }) }); });
  ok(await o.pg.evaluate(() => typeof GMTPush === 'object') && await o.pg.evaluate(() => GMTPush.status()) === 'off', 'الحالة الأولى «off»');
  await o.pg.evaluate(() => GMTPush.openPanel(['pos'])); await o.pg.waitForTimeout(400);
  ok(await o.pg.evaluate(() => !!document.querySelector('#gmt-push-ov [data-en]')), 'اللوحة تعرض زرّ «فعّل الإشعارات»');
  await o.pg.click('#gmt-push-ov [data-en]'); await o.pg.waitForTimeout(900);
  const sub = calls.find(c => c.action === 'subscribe');
  ok(calls[0] && calls[0].action === 'key' && sub && sub.branch_key === 'daraa' && JSON.stringify(sub.topics) === '["pos"]' && sub.sub.endpoint.indexOf('fcm.googleapis.com') > 0 && sub.user_id === '2' && sub.platform === 'desktop', 'نقرة التفعيل ⇒ طلب key ثمّ subscribe بفرع درعا وموضوع pos: ' + JSON.stringify(sub && { b: sub.branch_key, t: sub.topics, u: sub.user_id }));
  ok(await o.pg.evaluate(() => GMTPush.status()) === 'on' && await o.pg.evaluate(() => !!document.querySelector('#gmt-push-ov input[data-k="price"]')), 'الحالة «on» والمفاتيح لكلّ نوع ظاهرة');
  await o.pg.evaluate(() => { const i = document.querySelector('#gmt-push-ov input[data-k="price"]'); i.checked = false; i.dispatchEvent(new Event('change')); }); await o.pg.waitForTimeout(400);
  const pf = calls.find(c => c.action === 'prefs');
  ok(pf && pf.prefs.price === false && pf.endpoint.indexOf('TEST') > 0 && pf.auth === 'A'.repeat(22), 'إطفاء «الأسعار» ⇒ prefs بإثبات الجهاز');
  // استقبال إشعار والصفحة مفتوحة
  await o.pg.evaluate(() => { window.__ev = []; addEventListener('gmt-push', e => window.__ev.push(e.detail.k)); const h = window.__swl.find(x => x[0] === 'message'); h[1]({ data: { type: 'gmt-push', d: { t: '📦 فاتورة نقل واردة', b: 'TRF-1', k: 'transfer', u: 'pos.html?go=incoming' } } }); });
  await o.pg.waitForTimeout(400);
  const rx = await o.pg.evaluate(() => ({ ev: window.__ev, strip: (document.getElementById('gmt-push-strip') || {}).textContent || '', last: window.GMTSound && GMTSound.last() }));
  ok(rx.ev[0] === 'transfer' && /فاتورة نقل واردة/.test(rx.strip), 'الإشعار والصفحة مفتوحة ⇒ حدث gmt-push + شريط: ' + rx.strip);
  ok(rx.last === 'truck', 'وصوت «truck» لفاتورة النقل: ' + rx.last);
  await o.pg.evaluate(() => { document.querySelector('#gmt-push-ov [data-off]').click(); }); await o.pg.waitForTimeout(500);
  ok(calls.some(c => c.action === 'unsubscribe') && await o.pg.evaluate(() => GMTPush.status()) === 'off', 'إيقاف الجهاز ⇒ unsubscribe والحالة «off»');
  const real = o.errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|navigator.vibrate|Estimating/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  // ①ب المالك/الأدمن بلا حساب في gmt_users ⇒ ادّعاء admin بموضوعَي pos/orders
  o = await H.open('pos.html', { init: H.ADMIN_INIT.replace(/localStorage.setItem\('gmt_session'[^;]*;/, "localStorage.removeItem('gmt_session');") + STUB(true), w: 390, mobile: true, wait: 5500 });
  const calls2 = [];
  await o.ctx.route('**/functions/v1/push-subscribe**', async r => { const b = JSON.parse(r.request().postData() || '{}'); calls2.push(b); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(b.action === 'key' ? { ok: true, key: 'B'.repeat(87) } : { ok: true }) }); });
  const er = await o.pg.evaluate(async () => GMTPush.enable(['pos']));
  const s2 = calls2.find(c => c.action === 'subscribe');
  ok(er.ok && s2 && s2.claim === 'admin' && !s2.user_id && JSON.stringify(s2.topics) === '["pos","orders"]' && !!s2.branch_key, 'جهاز الأدمن بلا حساب ⇒ subscribe بادّعاء admin وموضوعَي pos و orders: ' + JSON.stringify(s2 && { c: s2.claim, t: s2.topics, b: s2.branch_key }));
  await o.browser.close();
  // ② آيفون بلا تثبيت
  o = await H.open('pos.html', { init: H.STAFF_INIT + STUB(false), w: 390, mobile: true, wait: 4500 });
  const ios = await o.pg.evaluate(() => { Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', configurable: true }); return GMTPush.status(); });
  ok(ios === 'ios-install', 'آيفون غير مثبَّت ⇒ «ios-install»: ' + ios);
  await o.pg.evaluate(() => GMTPush.openPanel(['pos'])); await o.pg.waitForTimeout(300);
  ok(await o.pg.evaluate(() => /أضف إلى الشاشة الرئيسية/.test(document.getElementById('gmt-push-ov').textContent)), 'ودليل التثبيت ظاهر');
  await o.browser.close();
  // ③ صفحة الزبون: لا شيء
  o = await H.open('store.html', { init: H.STAFF_INIT + STUB(true), w: 390, mobile: true, wait: 3500 });
  ok(await o.pg.evaluate(() => typeof GMTPush === 'undefined' || GMTPush.status() instanceof Promise), 'صفحة الزبون: الوحدة غير محمّلة أو خاملة');
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
