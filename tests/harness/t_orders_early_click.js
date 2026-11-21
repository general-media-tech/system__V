// (TASK-A0543 · المالك seq 928) «خطأ حرج: rcptBatchOpen is not defined» — ضغطة على زرٍّ قبل أن يُنفَّذ كود الصفحة (تحميلٌ بطيء على الهاتف)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  await H.seed();
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript({ content: H.ADMIN_INIT });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  /* محاكاة هاتفٍ بطيء: سكربتٌ يتأخّر 4ث يُحقن مباشرةً قبل كود الصفحة الكبير — الأزرار ظاهرة والكود لم يُنفَّذ (فجوة القراءة على الهاتف) */
  await pg.route('**/__slow.js', async r => { await sleep(4000); r.fulfill({ contentType: 'application/javascript', body: '/* slow */' }); });
  await pg.route(/\/orders\.html(\?|$)/, async r => { const res = await r.fetch(); let body = await res.text(); const lines = body.split('\n'), i = lines.findIndex((l, k) => k > 1000 && l.trim() === '<script>'); lines.splice(i, 0, '<script src="/__slow.js"></script>'); r.fulfill({ response: res, body: lines.join('\n'), headers: Object.assign({}, res.headers(), { 'content-type': 'text/html; charset=utf-8' }) }); });
  pg.goto('http://127.0.0.1:8765/orders.html?new=1').catch(() => {});
  await pg.waitForSelector('[data-rcpt-cam]', { timeout: 15000 });
  const early = await pg.evaluate(() => ({ guard: !!window.__gmtEarlyGuard, fn: typeof window.rcptBatchQuick }));
  ok(early.guard && early.fn === 'undefined', 'الزرّ ظاهر وكود الصفحة لم يُنفَّذ بعد (الحالة التي سبّبت الخطأ): ' + JSON.stringify(early));
  await pg.click('[data-rcpt-cam]'); await sleep(200);
  const note = await pg.evaluate(() => { const n = document.getElementById('gmt-wait-note'); return n && n.style.display !== 'none' ? n.textContent : ''; });
  ok(!errs.some(e => /is not defined/.test(e)) && /تتحمّل/.test(note), 'ضغطة أثناء التحميل ⇒ «⏳ الصفحة عم تتحمّل» لا «خطأ حرج»: ' + note);
  await pg.waitForFunction(() => typeof window.rcptBatchQuick === 'function', null, { timeout: 30000 }); await sleep(800);
  await pg.evaluate(() => { const i = document.createElement('input'); }); 
  await pg.click('[data-rcpt-files]', { noWaitAfter: true }).catch(() => {}); await sleep(400);
  ok(await pg.evaluate(() => !!document.getElementById('rb-ov') && document.getElementById('rb-ov').style.display !== 'none'), 'بعد التحميل ⇒ الزرّ يعمل (نافذة الإيصالات)');
  // صيد النمط: «الأمان والمستخدمون» — «دخول» (unlock) قبل أن يُعرَّف (خطأ 17/11)
  const p2 = await ctx.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(e.message));
  await p2.route('**/__slow2.js', async r => { await sleep(4000); r.fulfill({ contentType: 'application/javascript', body: '/* slow */' }); });
  await p2.route(u => /الأمان_والمستخدمون\.html/.test(decodeURIComponent(u.href || String(u))), async r => { const res = await r.fetch(); const body = (await res.text()).replace('<script src="gmt-core.js', '<script src="/__slow2.js"></script><script src="gmt-core.js'); r.fulfill({ response: res, body, headers: Object.assign({}, res.headers(), { 'content-type': 'text/html; charset=utf-8' }) }); });
  p2.goto('http://127.0.0.1:8765/' + encodeURIComponent('الأمان_والمستخدمون.html')).catch(() => {});
  await p2.waitForSelector('#gate button', { timeout: 15000 }); await sleep(300);
  const u0 = await p2.evaluate(() => typeof window.unlock);
  await p2.click('#gate button'); await sleep(200);
  const n2 = await p2.evaluate(() => { const n = document.getElementById('gmt-wait-note'); return n && n.style.display !== 'none' ? n.textContent : ''; });
  ok(u0 === 'undefined' && !e2.some(e => /is not defined/.test(e)) && /تتحمّل/.test(n2), '«الأمان والمستخدمون»: «دخول» قبل التحميل ⇒ «⏳» لا خطأ (unlock: ' + u0 + ')');
  await p2.close();
  ok(!errs.length, 'لا أخطاء JS ' + errs.slice(0, 2).join(' / '));
  await b.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
