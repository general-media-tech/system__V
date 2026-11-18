// (TASK-B0523 · الأمان م٢) رمز «جلسة الخادم» يُرسَل ترويسةً x-gmt-session مع طلبات القاعدة فقط — لا مع دوالّ الخادم (طلبها المسبق) ولا بلا جلسة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const TOK = 'a'.repeat(64);
  const { browser, pg } = await H.open('home.html', { wait: 500, init: H.STAFF_INIT + `;try{ var s=JSON.parse(localStorage.getItem('gmt_session')||'null'); if(s&&s.id){ var m={}; m[s.id]='${TOK}'; localStorage.setItem('gmt_sess_tok_v1', JSON.stringify(m)); } }catch(e){}` });
  const seen = await pg.evaluate(async () => {
    const out = {}; const of = window.__origFetchSpy = null;
    const cfg = (window.GMT_DB && GMT_DB.MAIN) || {};
    const grab = async (url) => { let h = null; const ro = window.fetch; const P = Request; try { const r = new P(url); } catch (_) {} return h; };
    return { hasSess: !!JSON.parse(localStorage.getItem('gmt_sess_tok_v1') || '{}'), url: cfg.url || '' };
  });
  const hdr = { rest: null, fn: null };
  pg.on('request', r => { const u = r.url(); const v = r.headers()['x-gmt-session'];
    if (/\/rest\/v1\//.test(u) && hdr.rest === null) hdr.rest = v || '';
    if (/\/functions\/v1\//.test(u) && hdr.fn === null) hdr.fn = v || ''; });
  await pg.evaluate(async () => { const d = GMT_DB.MAIN; await fetch(d.url + '/rest/v1/gmt_settings?select=key&limit=1', { headers: { apikey: d.key } }).catch(() => {}); await fetch(d.url + '/functions/v1/gmt-mufti', { method: 'POST', headers: { apikey: d.key, 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {}); });
  await pg.waitForTimeout(400);
  ok(seen.hasSess, 'رمز جلسة الموظّف محفوظ على الجهاز');
  ok(hdr.rest === TOK, 'طلب القاعدة يحمل x-gmt-session: ' + String(hdr.rest).slice(0, 8));
  ok(hdr.fn === '', 'طلب دالّة الخادم بلا الترويسة (لا يُكسر طلبها المسبق)');
  await pg.evaluate(() => { localStorage.removeItem('gmt_sess_tok_v1'); });
  hdr.rest = null;
  await pg.evaluate(async () => { const d = GMT_DB.MAIN; await fetch(d.url + '/rest/v1/gmt_settings?select=key&limit=1', { headers: { apikey: d.key } }).catch(() => {}); });
  await pg.waitForTimeout(300);
  ok(hdr.rest === '', 'بلا جلسة ⇒ بلا ترويسة');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
