// (TASK-A0551 · سجلّ الأخطاء: قائمة الأوردرات «طلب بطيء جداً» ×41 + «تجمّدت الواجهة» — المالك seq 948 «كمّل»)
//  ① دورة الـ٣٠ث تجلب ما تغيّر فقط (updated_at=gte) لا القائمة كلّها
//  ② بلا تغيير ⇒ لا إعادة رسم
//  ③ تعديلٌ من جهازٍ آخر ⇒ يظهر بعد الدورة · وأوردرٌ جديد يُضاف
//  ④ بعد ٥ دقائق ⇒ قراءةٌ كاملة (حذفٌ فعليّ يختفي)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const now = Date.now(), iso = t => new Date(t).toISOString();
  const base = { phone: '0933000000', address: 'حلب', product: 'منتج', qty: 1, price: 10, branch: 'حلب' };
  await H.call('/rest/v1/gmt_orders', [
    Object.assign({ id: 9101, name: 'زبون أ', status: 'pending', created_at: iso(now - 3600e3), updated_at: iso(now - 3600e3) }, base),
    Object.assign({ id: 9102, name: 'زبون ب', status: 'pending', created_at: iso(now - 7200e3), updated_at: iso(now - 7200e3) }, base),
    Object.assign({ id: 9103, name: 'زبون ج', status: 'pending', created_at: iso(now - 9000e3), updated_at: iso(now - 9000e3) }, base)]);
  const { browser, pg, errs } = await H.open('orders.html', { w: 1280, h: 900, mobile: false, wait: 7000 });
  const reqs = []; pg.on('request', r => { const u = r.url(); if (/\/rest\/v1\/gmt_orders\?/.test(u) && r.method() === 'GET') reqs.push(decodeURIComponent(u)); });
  await pg.evaluate(() => { window.__rc = 0; const r0 = render; render = function () { window.__rc++; return r0.apply(this, arguments); }; });
  // ①②
  reqs.length = 0;
  await pg.evaluate(() => loadOrders({ poll: true })); await sleep(500);
  const st1 = await pg.evaluate(() => ({ rc: window.__rc, n: orders.length }));
  ok(reqs.length === 1 && /updated_at=gte\./.test(reqs[0]) && !/created_at=gte/.test(reqs[0]), '① الدورة طلبٌ واحد بما تغيّر فقط ' + (reqs[0] || '').replace(/.*gmt_orders\?/, '').slice(0, 40).replace(/select=[^&]*&/, ''));
  ok(st1.rc === 0 && st1.n === 3, '② بلا تغيير ⇒ لا إعادة رسم (' + st1.rc + ')');
  // ③
  await H.call('/rest/v1/gmt_orders?id=eq.9102', { name: 'زبون ب المعدَّل', updated_at: iso(Date.now()) }, 'PATCH');
  await H.call('/rest/v1/gmt_orders', [Object.assign({ id: 9104, name: 'زبون جديد', status: 'pending', created_at: iso(Date.now()), updated_at: iso(Date.now()) }, base)]);
  reqs.length = 0;
  await pg.evaluate(() => loadOrders({ poll: true })); await sleep(600);
  const st2 = await pg.evaluate(() => ({ rc: window.__rc, n: orders.length, b: (orders.find(o => o.id == 9102) || {}).name, first: orders[0] && orders[0].id, txt: document.body.innerText }));
  ok(st2.b === 'زبون ب المعدَّل' && /زبون ب المعدَّل/.test(st2.txt), '③ التعديل من جهازٍ آخر ظهر');
  ok(st2.n === 4 && String(st2.first) === '9104' && /زبون جديد/.test(st2.txt), '③ الأوردر الجديد أُضيف في أوّل القائمة');
  ok(st2.rc === 1 && reqs.length === 1, '③ رسمٌ واحد وطلبٌ واحد (' + st2.rc + ' · ' + reqs.length + ')');
  // ④
  await H.call('/__opts', { block_delete: [] });
  await H.call('/rest/v1/gmt_orders?id=eq.9103', undefined, 'DELETE');
  reqs.length = 0;
  await pg.evaluate(() => { _ordFullAt = Date.now() - 6 * 60000; return loadOrders({ poll: true }); }); await sleep(800);
  const st3 = await pg.evaluate(() => ({ n: orders.length, has3: orders.some(o => o.id == 9103) }));
  ok(reqs.some(u => /created_at=gte\./.test(u)) && !st3.has3 && st3.n === 3, '④ بعد ٥ دقائق: قراءةٌ كاملة والمحذوف اختفى (' + st3.n + ')');
  // بعد عملية من المستخدم (loadOrders بلا poll) ⇒ كاملة دائماً
  reqs.length = 0;
  await pg.evaluate(() => loadOrders()); await sleep(500);
  ok(reqs.some(u => /created_at=gte\./.test(u)), 'بعد عملية: قراءةٌ كاملة كما كانت');
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
