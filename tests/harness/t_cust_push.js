// (TASK-B0424 · المرحلة ٦ · seq 814) إشعارات الزبون: من صفحة التتبّع بتأكيد الجوال · سجلّ إشعارات طلبه · إيقاف · وزرّ «إشعار للزبون» في الأوردرات
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const STUB = `(function(){ window.__sub=null;
  window.Notification=function(){}; Notification.permission='default'; Notification.requestPermission=async()=>(Notification.permission='granted');
  window.PushManager=function(){};
  const reg={ pushManager:{ getSubscription:async()=>window.__sub, subscribe:async()=>(window.__sub={endpoint:'https://fcm.googleapis.com/fcm/send/CUST',toJSON(){return{endpoint:this.endpoint,keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}}}}) } };
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve(reg),register:async()=>reg,getRegistration:async()=>reg,getRegistrations:async()=>[reg],controller:null,addEventListener(){} }});
})();`;
(async () => {
  await H.seed();
  const [O] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون التتبّع', phone: '0933123456', status: 'pending', serial_code: 'TRK-77', product: 'كاميرا', qty: 1, price: 100, address: 'حمص', created_at: new Date().toISOString() }]);
  const calls = [];
  const route = async ctx => ctx.route('**/functions/v1/customer-push**', r => {
    const b = JSON.parse(r.request().postData() || '{}'); calls.push(b);
    const send = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });
    if (b.action === 'key') return send({ ok: true, key: 'B'.repeat(87) });
    const good = String(b.phone || '').replace(/\D/g, '').slice(-9) === '933123456';
    if (b.action === 'subscribe') return send(good ? { ok: true } : { ok: false, err: 'proof', msg: 'رقم الجوال لا يطابق الرقم المسجَّل في هذا الطلب' });
    if (b.action === 'feed') return send(good ? { ok: true, items: [{ t: '✅ تمّ تأكيد طلبك', b: 'طلبك TRK-77 قيد التجهيز الآن', k: 'confirmed', at: new Date().toISOString() }] } : { ok: false });
    if (b.action === 'staff_msg') return send({ ok: true, devices: 1 });
    return send({ ok: true });
  });
  let o = await H.open('track_order.html', { init: STUB, wait: 2500 });
  await route(o.ctx);
  await o.pg.reload(); await sleep(3500);
  /* صفحة التتبّع ترسم الطلب عبر showTimeline(o) — نستدعيها بالطلب نفسه كما يفعل البحث */
  await o.pg.evaluate(ord => { document.getElementById('resultCard').classList.remove('hidden'); showTimeline(ord, null); }, O); await sleep(800);
  const m = await o.pg.evaluate(() => ({ box: !!document.getElementById('cust-push'), hook: !!(window.showTimeline && window.showTimeline.__cust), txt: (document.getElementById('cust-push') || {}).innerText || '' }));
  ok(m.hook && m.box && /أعلمني بكل تحديث لطلبك/.test(m.txt), 'بعد ظهور الطلب: «🔔 أعلمني بكل تحديث لطلبك» مع خانة الجوال ' + JSON.stringify({ hook: m.hook, box: m.box }));
  await o.pg.fill('#cust-push [data-ph]', '0999999999'); await o.pg.click('#cust-push [data-on]'); await sleep(1200);
  const e1 = await o.pg.evaluate(() => document.querySelector('#cust-push [data-msg]').textContent);
  ok(/لا يطابق/.test(e1), 'جوال لا يطابق الطلب ⇒ رفض واضح: ' + e1);
  await o.pg.fill('#cust-push [data-ph]', '0933 123 456'); await o.pg.click('#cust-push [data-on]'); await sleep(1500);
  const sub = calls.filter(c => c.action === 'subscribe').pop();
  const on = await o.pg.evaluate(() => (document.getElementById('cust-push') || {}).innerText || '');
  ok(sub && String(sub.order_id) === String(O.id) && sub.sub && /fcm/.test(sub.sub.endpoint), 'الاشتراك مربوط بالطلب نفسه (order_id) واشتراك الجهاز');
  ok(/مفعّلة على هذا الجهاز/.test(on) && /سجلّ إشعارات طلبك/.test(on) && /تمّ تأكيد طلبك/.test(on), 'بعد التفعيل: «مفعّلة» + سجلّ إشعارات طلبه');
  await o.pg.click('#cust-push [data-off]'); await sleep(800);
  ok(calls.some(c => c.action === 'unsubscribe') && /أعلمني/.test(await o.pg.evaluate(() => document.getElementById('cust-push').innerText)), 'إيقاف بضغطة ⇒ يعود زرّ التفعيل');
  const realErr = o.errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|vibrate|Estimating|mufti|ERR_/.test(e));
  ok(!realErr.length, 'لا أخطاء JS في صفحة التتبّع: ' + realErr.slice(0, 2).join(' | '));
  await o.browser.close();
  // ② الأوردرات: زرّ «إشعار للزبون»
  o = await H.open('orders.html', { init: H.ADMIN_INIT + ";localStorage.setItem('gmt_inbox_token','" + 'd'.repeat(64) + "')", w: 390, wait: 5000 });
  await route(o.ctx);
  const has = await o.pg.evaluate(id => !!document.querySelector('[data-cust-notify][onclick="custNotify(' + id + ')"]'), O.id);
  ok(has, 'بطاقة الأوردر فيها زرّ «إشعار للزبون»');
  await o.pg.evaluate(() => { GMTAsk.prompt = async () => 'تمّ تجهيز طلبك وسيُشحن اليوم'; });
  await o.pg.evaluate(id => custNotify(id), O.id); await sleep(1200);
  const st = calls.filter(c => c.action === 'staff_msg').pop();
  ok(st && st.token === 'd'.repeat(64) && String(st.order_id) === String(O.id) && /سيُشحن اليوم/.test(st.text), 'الرسالة تُرسل برمز الجهاز الموثَّق ومربوطة بالطلب');
  await o.browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
