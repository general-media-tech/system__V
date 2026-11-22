// (TASK-A0561 · المالك seq 959 «ركّز على الإشعارات والأصوات»)
//  ① فحص التحديث الخلفيّ (sw.js?vc=) يفشل بانقطاع ⇒ لا «خطأ حرج: شبكة»
//  ② عدّاد صندوق الإشعارات (notify-inbox count) يفشل ⇒ لا خطأ
//  ③ طلبٌ حقيقيّ يفشل ⇒ ما زال يُسجَّل «شبكة» — في صفحة موظّفين (gmt-staff كان يُسقط الجامع من السلسلة)
//  ④ كتابةٌ شرطيّة لا تجد صفّاً (حجزٌ سبقه جهازٌ آخر) ⇒ ليست «كتابة بلا أثر» · ⑤ كتابةٌ عاديّة بلا أثر ⇒ ما زالت تُسجَّل
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('orders.html', { w: 390, h: 800, wait: 6000 });
  await pg.route('**/sw.js?vc=*', r => r.abort('internetdisconnected'));
  await pg.route('**/functions/v1/notify-inbox', r => r.abort('internetdisconnected'));
  await pg.route('**/rest/v1/gmt_a0561_probe*', r => r.abort('internetdisconnected'));
  const net = () => pg.evaluate(() => GMTBug.list().filter(e => e.type === 'شبكة').map(e => e.msg));
  const n0 = (await net()).length;
  await pg.evaluate(async () => { try { await fetch('sw.js?vc=' + Date.now(), { cache: 'no-store' }); } catch (_) {} });
  ok((await net()).length === n0, '① فحص التحديث الخلفيّ لا يُسجَّل');
  await pg.evaluate(async () => { const d = GMT_DB.MAIN; try { await fetch(d.url + '/functions/v1/notify-inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'count' }) }); } catch (_) {} });
  ok((await net()).length === n0, '② عدّاد صندوق الإشعارات لا يُسجَّل');
  await pg.evaluate(async () => { const d = GMT_DB.MAIN; try { await fetch(d.url + '/rest/v1/gmt_a0561_probe?select=id', { headers: { apikey: d.key } }); } catch (_) {} });
  const L = await net();
  ok(L.length === n0 + 1 && /gmt_a0561_probe/.test(L[L.length - 1] || ''), '③ الطلب الحقيقيّ ما زال يُسجَّل «شبكة» في صفحة الأوردرات ' + JSON.stringify(L.slice(-1)));
  const noop = () => pg.evaluate(() => GMTBug.list().filter(e => e.type === 'كتابة بلا أثر').length);
  const w0 = await noop();
  await pg.evaluate(async () => { const d = GMT_DB.MAIN; await fetch(d.url + '/rest/v1/gmt_orders?id=eq.987654&stock_deducted=is.null', { method: 'PATCH', headers: { apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ stock_deducted: { at: 'x' } }) }); });
  await sleep(300);
  ok(await noop() === w0, '④ كتابةٌ شرطيّة بلا صفّ ليست «كتابة بلا أثر»');
  await pg.evaluate(async () => { const d = GMT_DB.MAIN; await fetch(d.url + '/rest/v1/gmt_orders?id=eq.987655', { method: 'PATCH', headers: { apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ notes: 'x' }) }); });
  await sleep(300);
  ok(await noop() === w0 + 1, '⑤ كتابةٌ عاديّة بلا صفّ ما زالت تُسجَّل');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
