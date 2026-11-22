// (TASK-A0567 · المالك seq 959 «ركّزلي على الإشعارات والأصوات» · seq 965 «كمل»)
// قائمة الأوردرات: أوردرٌ جديد من جهازٍ آخر/المتجر كان يظهر مع دورة التحديث بصمت
//  ① دورة بلا جديد ⇒ لا صوت   ② أوردرٌ جديد ⇒ صوت «أوردر» واحد + إشعارٌ باسمه
//  ③ أوردرٌ قديم عُدّل (لم يكن بالقائمة) ⇒ لا صوت   ④ القراءة الكاملة (كلّ ٥ دقائق) تلتقط الجديد أيضاً
//  ⑤ أوردر أنشأه هذا الجهاز ⇒ لا صوت   ⑥ صندوق الإشعارات لا يضيف صوتاً ثانياً للحدث نفسه
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const now = Date.now(), iso = t => new Date(t).toISOString();
  const base = { phone: '0933000000', address: 'حلب', product: 'منتج', qty: 1, price: 10, branch: 'حلب', status: 'pending' };
  await H.call('/rest/v1/gmt_orders', [
    Object.assign({ id: 9201, name: 'زبون أ', created_at: iso(now - 3600e3), updated_at: iso(now - 3600e3) }, base),
    Object.assign({ id: 9202, name: 'زبون ب', created_at: iso(now - 7200e3), updated_at: iso(now - 7200e3) }, base)]);
  const { browser, pg, errs } = await H.open('orders.html', { init: H.ADMIN_INIT + `;try{localStorage.setItem('gmt_sound','on')}catch(_){}`, w: 1280, h: 900, mobile: false, wait: 7000 });
  await pg.evaluate(() => {
    window.__snd = []; let depth = 0;
    const f = GMTSound.play; GMTSound.play = function (n) { if (!depth) window.__snd.push(n); depth++; try { return f.apply(this, arguments); } finally { depth--; } };
    const c = GMTSound.cue; GMTSound.cue = function (n) { if (!depth) window.__snd.push('cue:' + n); depth++; try { return c.apply(this, arguments); } finally { depth--; } };
  });
  const cycle = async (js) => { await pg.evaluate(() => { window.__snd = []; }); await pg.evaluate(js || (() => loadOrders({ poll: true }))); await sleep(700); return pg.evaluate(() => ({ s: window.__snd.slice(), toast: document.getElementById('toast-wrap').innerText })); };
  // ①
  const r1 = await cycle();
  ok(r1.s.length === 0, '① دورة بلا جديد ⇒ لا صوت ' + JSON.stringify(r1.s));
  // ②
  await H.call('/rest/v1/gmt_orders', [Object.assign({ id: 9203, name: 'زبون المتجر', created_at: iso(Date.now()), updated_at: iso(Date.now()) }, base)]);
  const r2 = await cycle();
  ok(r2.s.filter(x => x === 'order').length === 1 && r2.s.length === 1, '② أوردرٌ جديد ⇒ صوت «أوردر» واحد ' + JSON.stringify(r2.s));
  ok(/أوردر جديد: زبون المتجر/.test(r2.toast), '② وإشعارٌ باسمه');
  // ③
  await H.call('/rest/v1/gmt_orders', [Object.assign({ id: 9204, name: 'أوردر قديم', created_at: iso(Date.now() - 40 * 864e5), updated_at: iso(Date.now()) }, base)]);
  const r3 = await cycle();
  ok(r3.s.length === 0, '③ أوردرٌ قديم عُدّل ⇒ لا صوت ' + JSON.stringify(r3.s));
  // ④
  await H.call('/rest/v1/gmt_orders', [Object.assign({ id: 9205, name: 'زبون خامس', created_at: iso(Date.now()), updated_at: iso(Date.now()) }, base)]);
  const r4 = await cycle(() => { _ordFullAt = Date.now() - 6 * 60000; return loadOrders({ poll: true }); });
  ok(r4.s.filter(x => x === 'order').length === 1, '④ القراءة الكاملة تلتقط الجديد ⇒ صوت ' + JSON.stringify(r4.s));
  // ⑤
  const r5 = await cycle(async () => {
    const id = 9206, o = Object.assign({ id, name: 'من هذا الجهاز', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { phone: '0933000000', address: 'حلب', product: 'منتج', qty: 1, price: 10, branch: 'حلب', status: 'pending' });
    await fetch(SUPA_URL + '/rest/v1/' + TABLE, { method: 'POST', headers: Object.assign({}, SB_HEADERS, { 'Content-Type': 'application/json' }), body: JSON.stringify(o) });
    orders.unshift(o); window.__snd = [];
    return loadOrders({ poll: true });
  });
  ok(r5.s.length === 0, '⑤ أوردر هذا الجهاز ⇒ لا صوت ' + JSON.stringify(r5.s));
  // ⑥
  const r6 = await pg.evaluate(() => typeof window.__gmtLocalSndAt === 'number' && Date.now() - window.__gmtLocalSndAt < 90000);
  ok(r6, '⑥ علامة «الصفحة نبّهت» لصندوق الإشعارات (لا صوت ثانٍ)');
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
