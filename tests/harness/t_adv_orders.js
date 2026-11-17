// (ARC-CODE-2#14 · فحوصات مضادّة — الأوردرات) لا «نجاح وهمي»: كتابة لم تُعدّل صفاً (RLS) · خطأ خادم 500 · انقطاع شبكة
// المعيار: لا رسالة نجاح، الحالة في الذاكرة لا تتغيّر، رسالة واضحة، والإعادة بعد زوال العطل تنجح.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dump = () => H.call('/__dump', undefined, 'GET');
(async () => {
  await H.seed();
  const now = new Date().toISOString();
  const [o] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون عطل', phone: '0933700099', status: 'pending', qty: 1, branch: 'المتجر الإلكتروني', product: 'منتج', price: 40, address: 'حمص', items_json: '[{"name":"منتج","qty":1,"price":40}]', created_at: now, order_number: 'ORD-9' }]);
  const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, mobile: true, wait: 5000, init: H.ADMIN_INIT });
  await pg.evaluate(() => { window.__toasts = []; const st = window.showToast; window.showToast = function (m, t) { window.__toasts.push((t || '') + '|' + m); return st && st.apply(this, arguments); }; GMTAsk.confirm = async () => true; });
  const state = () => pg.evaluate(id => { const x = orders.find(z => z.id == id); return { conf: !!(x.confirmation && x.confirmation.confirmed_at), t: window.__toasts.slice() }; }, o.id);

  // ① RLS يحجب الكتابة (PATCH يمرّ بلا صفوف)
  await H.call('/__opts', { rls_block: ['gmt_orders'] });
  await pg.evaluate(id => confirmDone(id), o.id); await sleep(900);
  let s = await state(), d = await dump();
  ok(!s.conf && !s.t.some(x => /أُكّد الطلب/.test(x)) && s.t.some(x => /^err\|/.test(x)), 'RLS ⇒ لا «أُكّد» ولا تغيير في الذاكرة، ورسالة خطأ: ' + s.t.slice(-1));
  ok(!(d.gmt_orders.find(x => x.id === o.id).confirmation || {}).confirmed_at, 'القاعدة لم تتغيّر');
  await H.call('/__opts', { rls_block: [] });

  // ② خطأ خادم 500
  await pg.evaluate(() => { window.__toasts = []; });
  await pg.route(/\/rest\/v1\/gmt_orders\?id=eq\./, r => r.request().method() === 'PATCH' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"simulated"}' }) : r.fallback());
  await pg.evaluate(id => confirmDone(id), o.id); await sleep(900);
  s = await state();
  ok(!s.t.some(x => /أُكّد الطلب/.test(x)) && s.t.some(x => /^(err|inf)\|/.test(x)), '500 ⇒ لا «✅ أُكّد»؛ رسالة خطأ أو «بانتظار الإنترنت» (طابور الجهاز): ' + s.t.slice(-1));
  await pg.unroute(/\/rest\/v1\/gmt_orders\?id=eq\./);

  // ③ انقطاع شبكة
  await pg.evaluate(() => { window.__toasts = []; });
  await pg.route(/\/rest\/v1\/gmt_orders\?id=eq\./, r => r.request().method() === 'PATCH' ? r.abort('internetdisconnected') : r.fallback());
  await pg.evaluate(id => confirmDone(id).catch(e => window.__toasts.push('throw|' + e.message)), o.id); await sleep(1500);
  s = await state();
  ok(!s.t.some(x => /أُكّد الطلب/.test(x)) && s.t.some(x => /بانتظار الإنترنت|^err\|/.test(x)), 'انقطاع ⇒ لا نجاح وهمي — «بانتظار الإنترنت»: ' + s.t.slice(-1));
  await pg.unroute(/\/rest\/v1\/gmt_orders\?id=eq\./);

  // ④ بعد زوال العطل: الإعادة تنجح مرّة واحدة
  await pg.evaluate(() => { window.__toasts = []; });
  await pg.evaluate(id => confirmDone(id), o.id); await sleep(900);
  s = await state(); d = await dump();
  ok(s.conf && s.t.some(x => /أُكّد الطلب/.test(x)) && (d.gmt_orders.find(x => x.id === o.id).confirmation || {}).confirmed_at, 'الإعادة بعد العطل ⇒ تُحفظ وتُعلَن');
  const realErr = errs.filter(e => !/status of (400|401|404|406|409|500)|Failed to load resource|ERR_|simulated|vibrate/.test(e));
  ok(!realErr.length, 'لا أخطاء JS ' + realErr.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
