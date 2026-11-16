// (TASK-A0525) الكفالات في القاعدة الرئيسية · أدلّة التفعيل (التوقيع · IP · الجهاز) في سجلّ التفعيل وحده لا في صفّ الكفالة
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
require(require('path').join(__dirname, '_net_guard.js'));
const BASE = 'http://127.0.0.1:' + (process.env.BASE_PORT || 8765) + '/';
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const MAIN = 'ysawzwtmodkqqbqoiojj.supabase.co';
const SIG = 'data:image/png;base64,iVBORw0KGgo=';
const ROW = { id: 7, short_id: 'TST001', customer_name: 'زبون تجربة', product_name: 'Canon R8', serial_no: 'SN1', invoice_no: '1-1',
  purchase_date: '2026-11-01', expiry_date: '2027-11-01', warranty_type: 'standard', status: 'active', activation_status: 'activated',
  activation_date: '2026-11-02', activation_time: '10:00:00', customer_typed_name: 'زبون تجربة', biometric_verified: false };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' });
  const log = []; const hosts = new Set();
  await ctx.route(/^https:\/\/(?!127)/, async route => {
    const rq = route.request(), u = rq.url(); hosts.add(new URL(u).host);
    if (u.includes('/rest/v1/')) log.push({ m: rq.method(), u, b: rq.postData() || '' });
    if (u.includes('/rpc/gmt_warranty_signature')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SIG) });
    if (/\/rest\/v1\/warranties\?.*short_id=eq\.TST001/.test(u) && rq.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([ROW]) });
    if (u.includes('/rest/v1/')) return route.fulfill({ status: rq.method() === 'GET' ? 200 : 201, contentType: 'application/json', body: rq.method() === 'GET' ? '[]' : '' });
    if (/ipify/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ip":"10.0.0.9"}' });
    return route.fulfill({ status: 404, body: '' });
  });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await pg.goto(BASE + 'guarantee.html?w=TST001', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4000);

  // ١) كلّ الطلبات للقاعدة الرئيسية — لا للمشروع القديم
  ok(!hosts.has('abppuwylukzpqckazegk.supabase.co'), 'لا طلب للمشروع القديم');
  ok(log.some(x => x.u.includes(MAIN + '/rest/v1/warranties')), 'قراءة الكفالة من القاعدة الرئيسية');
  // ٢) التوقيع يُجلب لهذه الكفالة وحدها
  const rpc = log.filter(x => x.u.includes('/rpc/gmt_warranty_signature'));
  ok(rpc.length === 1 && JSON.parse(rpc[0].b).p_short_id === 'TST001', 'التوقيع عبر gmt_warranty_signature لرقم الكفالة نفسه');
  ok(!log.some(x => x.m === 'GET' && x.u.includes('/rest/v1/activation_logs')), 'لا قراءة لسجلّ التفعيل');
  await pg.waitForFunction(s => { const i = document.getElementById('signatureDisplayImg'); return i && i.getAttribute('src') === s; }, SIG, { timeout: 15000 }).catch(() => {});   /* بعد انترو الكفالة */
  const sig = await pg.evaluate(() => { const i = document.getElementById('signatureDisplayImg'); return i ? i.getAttribute('src') : null; });
  ok(sig === SIG, 'التوقيع يظهر في بطاقة الكفالة المفعَّلة');

  // ٣) التفعيل: السجلّ (مع الدليل) أوّلاً ثمّ تعديل الكفالة بلا دليل
  log.length = 0;
  await pg.evaluate(async () => {
    currentShortId = 'TST002';
    currentActivationData = { c: 'زبون', p: 'منتج', s: 'SN2', inv: '2-2', t: 'standard' };
    sigHasDrawn = true;
    document.getElementById('sigFullName').value = 'زبون';
    document.getElementById('sigOwnCheckbox').checked = true;
    const b = document.getElementById('activateBtn'); b.disabled = false;
    await submitActivation();
  });
  await pg.waitForTimeout(800);
  const iLog = log.findIndex(x => x.m === 'POST' && x.u.includes('/rest/v1/activation_logs'));
  const iPatch = log.findIndex(x => x.m === 'PATCH' && x.u.includes('/rest/v1/warranties?short_id=eq.TST002'));
  ok(iLog >= 0 && iPatch > iLog, 'سجلّ التفعيل يُكتب قبل تعليم الكفالة مفعَّلة (' + iLog + ' < ' + iPatch + ')');
  const lb = iLog >= 0 ? JSON.parse(log[iLog].b) : {};
  ok(lb.short_id === 'TST002' && /^data:image\/png/.test(lb.signature_base64 || '') && lb.ip_address === '10.0.0.9' && lb.user_agent, 'السجلّ يحمل الدليل كاملاً (توقيع · IP · الجهاز)');
  const pb = iPatch >= 0 ? JSON.parse(log[iPatch].b) : {};
  const leaked = ['signature_base64', 'ip_address', 'user_agent', 'browser_name', 'operating_system', 'device_type', 'screen_width', 'referrer', 'biometric_credential_id'].filter(k => k in pb);
  ok(pb.activation_status === 'activated' && !leaked.length, 'صفّ الكفالة بلا دليل ' + (leaked.length ? JSON.stringify(leaked) : ''));
  ok(log.filter(x => x.m === 'POST' && x.u.includes('/rest/v1/activation_logs')).length === 1, 'سجلّ واحد لا مكرّر');

  // ٤) فشل السجلّ ⇒ لا تُعلَّم الكفالة مفعَّلة
  log.length = 0;
  await ctx.unroute(/^https:\/\/(?!127)/);
  await ctx.route(/^https:\/\/(?!127)/, async route => {
    const rq = route.request(), u = rq.url();
    if (u.includes('/rest/v1/')) log.push({ m: rq.method(), u, b: rq.postData() || '' });
    if (u.includes('/rest/v1/activation_logs')) return route.fulfill({ status: 401, body: '{"message":"denied"}' });
    if (u.includes('/rest/v1/')) return route.fulfill({ status: 201, body: '' });
    return route.fulfill({ status: 404, body: '' });
  });
  await pg.evaluate(async () => { window.alert = () => {}; currentShortId = 'TST003'; const b = document.getElementById('activateBtn'); b.disabled = false; await submitActivation(); });
  await pg.waitForTimeout(500);
  ok(!log.some(x => x.m === 'PATCH'), 'فشل حفظ السجلّ ⇒ لا تعديل للكفالة (لا تفعيل بلا دليل)');
  ok(await pg.evaluate(() => !document.getElementById('activateBtn').disabled), 'زرّ التفعيل يعود متاحاً لإعادة المحاولة');
  ok(!errs.length, 'لا أخطاء JS: ' + errs.join(' | '));
  await browser.close(); console.log(fails ? 'FAILS=' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
