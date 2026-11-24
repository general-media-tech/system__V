// (seq B1048 «ما في كلّ شوي يطلب كلمة سرّ سيادية … صلاحيات المستخدم للحساب») أدمنٌ داخلٌ بحسابه (رمز الخادم باسمه ساري) ⇒
// لا نافذة كلمة سيادية والعملية تُسجَّل باسمه · رمزٌ منتهٍ أو موظّف ⇒ النافذة كما كانت
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const tok = (name, exp) => Buffer.from(unescape(encodeURIComponent(name)), 'binary').toString('base64') + '.' + exp + '.sig';
  const run = async (init) => {
    const o = await H.open('inventory.html', { init, w: 1366, h: 900, mobile: false, wait: 5000 });
    const r = await o.pg.evaluate(async () => { let asked = 0; GMTAsk.prompt = async () => { asked++; return null; };
      const a = await GMTAuth.ask('sovereign', 'اختبار'); const g = await GMTAuth.gate('purchase', 'اختبار ٢'); return { a, g, asked, who: GMTAuth.accountAdmin() }; });
    await o.browser.close(); return r;
  };
  let r = await run(H.ADMIN_INIT + `;sessionStorage.setItem('gmt_admin_mode','1');sessionStorage.setItem('gmt_adm_tok','${tok('محمد خير', Date.now() + 3600e3)}')`);
  ok(r.a === true && r.g === true && r.asked === 0 && r.who === 'محمد خير', 'أدمن بحسابه ⇒ لا نافذة · العملية باسمه: ' + JSON.stringify(r));
  r = await run(H.ADMIN_INIT + `;sessionStorage.setItem('gmt_admin_mode','1');sessionStorage.setItem('gmt_adm_tok','${tok('محمد خير', Date.now() - 1000)}')`);
  ok(r.a === false && r.asked === 2 && !r.who, 'رمزٌ منتهٍ ⇒ النافذة تظهر كما كانت: ' + JSON.stringify(r));
  r = await run(H.STAFF_INIT + `;sessionStorage.removeItem('gmt_admin_mode');sessionStorage.removeItem('gmt_adm_tok')`);
  ok(r.a === false && r.asked === 2, 'موظّف ⇒ النافذة كما كانت: ' + JSON.stringify(r));
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
