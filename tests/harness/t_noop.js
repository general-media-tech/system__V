const H = require('./h.js');
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('home.html', { w: 1280, h: 800, wait: 4500, mobile: false });
  ok(await pg.evaluate(() => !!window.GMTOpLog && !!window.__gmtOpLogFetch), 'oplog + الحارس مثبّتان على الصفحة');
  const dbk = await pg.evaluate(() => GMT_DB.MAIN);
  const U = dbk.url + '/rest/v1/';
  const hdr = { apikey: dbk.key, Authorization: 'Bearer ' + dbk.key, 'Content-Type': 'application/json' };
  await H.call('/rest/v1/gmt_users', [{ id: 901, username: 'ali1', display_name: 'علي', is_active: true }, { id: 902, username: 'ali2', display_name: 'علي٢', is_active: true }]);
  const toasts = () => pg.evaluate(() => [...document.querySelectorAll('.gu-toast')].map(e => e.textContent));
  const run = (code) => pg.evaluate(code);
  // ١) تعديل ناجح بـreturn=minimal: لا تنبيه، والرمز 204 كما هو
  let r = await run(`fetch('${U}gmt_users?id=eq.901', {method:'PATCH', headers:Object.assign({Prefer:'return=minimal'}, ${JSON.stringify(hdr)}), body: JSON.stringify({display_name:'علي جديد'})}).then(r=>[r.status, r.ok])`);
  ok(r[0] === 204 && r[1], 'PATCH ناجح بـminimal يبقى 204: ' + r);
  await pg.waitForTimeout(300); ok((await toasts()).length === 0, 'لا تنبيه عند نجاح التعديل');
  // ٢) نفس الطلب مع رؤوس بصيغ مختلفة (Headers / مصفوفة / بلا Prefer)
  r = await run(`(async()=>{ const o=[]; const base=${JSON.stringify(hdr)};
    o.push((await fetch('${U}gmt_users?id=eq.901',{method:'PATCH',headers:new Headers(Object.assign({Prefer:'return=minimal'},base)),body:'{"display_name":"a"}'})).status);
    o.push((await fetch('${U}gmt_users?id=eq.901',{method:'PATCH',headers:Object.entries(Object.assign({Prefer:'return=minimal'},base)),body:'{"display_name":"b"}'})).status);
    o.push((await fetch('${U}gmt_users?id=eq.901',{method:'PATCH',headers:base,body:'{"display_name":"c"}'})).status);
    return o; })()`);
  ok(JSON.stringify(r) === '[204,204,200]', 'صيغ الرؤوس الثلاث تعمل ولا تغيّر الحالة: ' + r);
  await pg.waitForTimeout(300); ok((await toasts()).length === 0, 'ما زال بلا تنبيه');
  // ٣) RLS يمنع: صفر صفوف ⇒ تنبيه صريح
  await H.call('/__opts', { rls_block: ['gmt_users'] });
  r = await run(`fetch('${U}gmt_users?id=eq.902', {method:'PATCH', headers:Object.assign({Prefer:'return=minimal'}, ${JSON.stringify(hdr)}), body: JSON.stringify({is_active:false})}).then(r=>[r.status, r.ok])`);
  ok(r[0] === 204, 'الردّ لم يُغيَّر (204 «ناجح» كما يردّ PostgREST): ' + r);
  await pg.waitForTimeout(400);
  const t1 = await toasts(); ok(t1.length === 1 && /لم يُحفَظ/.test(t1[0]), 'ظهر التنبيه الصريح: ' + (t1[0] || '').slice(0, 70));
  // ٤) حذف مرفوض
  await run(`fetch('${U}gmt_users?id=eq.901', {method:'DELETE', headers:Object.assign({Prefer:'return=minimal'}, ${JSON.stringify(hdr)})})`);
  await pg.waitForTimeout(400); ok((await toasts()).length >= 1, 'حذف مرفوض أيضاً يُنبَّه');
  // ٥) تحديد النطاق: تعديل واسع (status=eq) لا يُعامَل كهدف مفرد
  await H.call('/__opts', { rls_block: [] });
  await H.call('/rest/v1/gmt_orders', [{ id: 701, status: 'pending', customer_name: 'س' }]);
  await pg.evaluate(() => document.querySelectorAll('.gu-toast').forEach(e => e.remove()));
  await H.call('/__opts', { rls_block: ['gmt_orders'] });
  await run(`fetch('${U}gmt_orders?status=eq.zzz', {method:'PATCH', headers:Object.assign({Prefer:'return=minimal'}, ${JSON.stringify(hdr)}), body: '{"status":"x"}'})`);
  await pg.waitForTimeout(400); ok((await toasts()).length === 0, 'تعديل بفلتر غير مفتاحيّ (status=eq) لا يُنبَّه (قد يكون صفراً مشروعاً)');
  // ٦) سجل العمليات: لا «تعديل ناجح» كاذب، بل write_noop
  await run(`fetch('${U}gmt_orders?id=eq.701', {method:'PATCH', headers:Object.assign({Prefer:'return=minimal'}, ${JSON.stringify(hdr)}), body: '{"status":"shipped"}'})`);
  await pg.waitForTimeout(500);
  await H.call('/__opts', { rls_block: [] });
  await run(`GMTOpLog.flush ? GMTOpLog.flush() : null`); await pg.waitForTimeout(1500);
  await pg.evaluate(() => { window.dispatchEvent(new Event('pagehide')); }); await pg.waitForTimeout(1200);
  const d = await H.call('/__dump', undefined, 'GET'); const au = (d.gmt_audit || []);
  console.log('audit actions:', au.map(x => x.action + ':' + x.entity).join(' | '));
  ok(au.some(x => x.action === 'write_noop' && x.entity === 'gmt_orders'), 'سُجّل write_noop للأوردر');
  ok(!au.some(x => x.action === 'update:gmt_orders' && /shipped/.test(x.new_value || '')), 'لم يُسجَّل «تعديل أوردر» ناجحاً كاذباً');
  ok(au.some(x => x.action === 'update:gmt_users' || x.action === 'user_toggle' || x.entity === 'gmt_users'), 'التعديل الناجح لمستخدم سُجّل عادياً');
  // ٧) تعطيل داخل الفحص العميق (mute)
  await H.call('/__opts', { rls_block: ['gmt_users'] });
  await pg.evaluate(() => document.querySelectorAll('.gu-toast').forEach(e => e.remove()));
  await run(`(async()=>{ window.__gmtOpLogMute=true; await fetch('${U}gmt_users?id=eq.902',{method:'PATCH',headers:Object.assign({Prefer:'return=minimal'},${JSON.stringify(hdr)}),body:'{"is_active":true}'}); window.__gmtOpLogMute=false; })()`);
  await pg.waitForTimeout(400); ok((await toasts()).length === 0, 'أثناء الفحص العميق (mute) لا تنبيه');
  console.log('errs', errs.filter(e => !/404|400|Failed|favicon/.test(e)));
  await browser.close();
})();
