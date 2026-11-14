// (seq B693 · اقتراحات المتجر ٥) بحث صوتيّ بالعربي في شريط البحث — الزرّ يظهر فقط مع دعم المتصفّح
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const prods = [{ id: 'v1', name: 'كاميرا كانون R50', price: 700, category_id: 'c0' }, { id: 'v2', name: 'حقيبة ظهر', price: 30, category_id: 'c0' }, { id: 'v3', name: 'ميكروفون لاسلكي', price: 60, category_id: 'c0' }];
const st = { categories: [{ id: 'c0', name: 'قسم', order: 0 }], banners: [], offers: [], branches: [], products: prods };
const VISITOR = `try{ localStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
const FAKE_SR = `window.__srStarted=0; window.webkitSpeechRecognition=function(){ const me=this; window.__sr=me; this.start=function(){ window.__srStarted++; me.__lang=me.lang; }; this.stop=function(){ me.onend&&me.onend(); }; }; window.SpeechRecognition=window.webkitSpeechRecognition;`;
async function page(init) {
  const o = await H.open('logo.jpg', { init: VISITOR + init, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(4000);
  return o;
}
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  const o = await page(FAKE_SR);
  await o.pg.evaluate(() => openSearchBar()); await o.pg.waitForTimeout(500);
  const vis = await o.pg.evaluate(() => { const b = document.getElementById('search-mic'); return b && !b.classList.contains('hidden') && b.getBoundingClientRect().width > 0; });
  ok(vis, '① مع دعم المتصفّح: زرّ الميكروفون ظاهر في شريط البحث');
  await o.pg.click('#search-mic');
  const st1 = await o.pg.evaluate(() => ({ n: window.__srStarted, lang: window.__sr && window.__sr.__lang, rec: document.getElementById('search-mic').classList.contains('text-red-500') }));
  ok(st1.n === 1 && st1.lang === 'ar-SY' && st1.rec, '② الضغط يبدأ الاستماع بالعربي ويُظهر حالة التسجيل ' + JSON.stringify(st1));
  await o.pg.evaluate(() => { const r = window.__sr; r.onresult({ results: [[{ transcript: 'حقيبة' }]] }); r.onend(); });
  await o.pg.waitForTimeout(700);
  const res = await o.pg.evaluate(() => ({ v: document.getElementById('search-input').value, txt: document.body.innerText, rec: document.getElementById('search-mic').classList.contains('text-red-500') }));
  ok(res.v === 'حقيبة' && /حقيبة ظهر/.test(res.txt) && !res.rec, '③ الكلام يُكتب في البحث وتظهر النتيجة وتنتهي حالة التسجيل');
  await o.pg.evaluate(() => { window.__toasts = []; const t = window.showToast; window.showToast = (m, k) => { window.__toasts.push(m); }; });
  await o.pg.click('#search-mic'); await o.pg.evaluate(() => { const r = window.__sr; r.onerror({ error: 'not-allowed' }); r.onend(); });
  const tst = await o.pg.evaluate(() => window.__toasts.join(' | '));
  ok(/اسمح باستخدام الميكروفون/.test(tst), '④ رفض الإذن ⇒ رسالة واضحة ' + tst);
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  const o2 = await page(`delete window.webkitSpeechRecognition; delete window.SpeechRecognition; window.webkitSpeechRecognition=undefined; window.SpeechRecognition=undefined;`);
  const hid = await o2.pg.evaluate(() => document.getElementById('search-mic').classList.contains('hidden'));
  ok(hid, '⑤ بلا دعم: الزرّ مخفي');
  await o2.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
