// (TASK-B0508 ١ · المالك seq 824 «الكفالة تُنشأ بلا إنترنت أوّلاً») بلا اتصال ⇒ الكفالة في طابورٍ دائم على الجهاز وتُسلَّم فوراً،
// وعند عودة الإنترنت تُرسل وحدها للقاعدة.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const o = await H.open('guarantee.html', { w: 390, wait: 4500 });
  const pg = o.pg;
  await o.ctx.setOffline(true);
  const sid = 'OFF' + Date.now().toString(36).toUpperCase().slice(-5);
  const r = await pg.evaluate(async sid => { const ok = await supabaseInsert({ short_id: sid, customer_name: 'زبون بلا إنترنت', product_name: 'EOS R50', serial_no: 'SN-OFF-1', purchase_date: '2026-11-19', expiry_date: '2027-11-19', warranty_type: 'سنة', status: 'active', activation_status: 'not_activated' }); const s = await GMTSync.status(); return { ok, queued: !!window.__warrantyQueued, pending: s.pending }; }, sid);
  ok(r.ok && r.queued && r.pending >= 1, 'بلا إنترنت ⇒ الكفالة في الطابور على الجهاز (' + JSON.stringify(r) + ')');
  await o.ctx.setOffline(false); await sleep(500);
  await pg.evaluate(() => GMTSync.flush()); await sleep(1500);
  const rows = await (await fetch(H.M + '/rest/v1/warranties?short_id=eq.' + sid + '&select=*')).json().catch(() => []);
  ok(Array.isArray(rows) && rows.length === 1 && rows[0].customer_name === 'زبون بلا إنترنت', 'عند عودة الإنترنت أُرسلت للقاعدة (' + (rows.length || 0) + ')');
  const left = await pg.evaluate(async () => (await GMTSync.status()).pending);
  ok(left === 0, 'الطابور فرغ بعد الإرسال');
  const real = o.errs.filter(e => !/status of (4\d\d|503)|Failed to load resource|ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' | '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
