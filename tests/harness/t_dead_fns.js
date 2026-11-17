// (ARC-MD-04#13) initClients الميتة أُزيلت من bridge.html ولا مرجع لها · _doCloseIntro حيّة (يناديها _tryCloseIntro) فتبقى في store.html
const fs = require('fs'), path = require('path');
const R = path.resolve(__dirname, '..', '..');
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const all = fs.readdirSync(R).filter(f => /\.(js|html)$/.test(f)).map(f => [f, fs.readFileSync(path.join(R, f), 'utf8')]);
ok(!all.some(([, t]) => /initClients/.test(t)), 'لا أثر لـ initClients في أي ملف');
const store = fs.readFileSync(path.join(R, 'store.html'), 'utf8');
ok(/setTimeout\(_doCloseIntro/.test(store) && /function _doCloseIntro/.test(store), '_doCloseIntro حيّة ومعرّفة في store.html (لم تُحذف)');
(async () => {
  await H.seed();
  const { browser, errs } = await H.open('bridge.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 3500 });
  const bad = errs.filter(e => !/vibrate/.test(e));
  ok(bad.length === 0, 'bridge.html بلا أخطاء كونسول: ' + JSON.stringify(bad.slice(0, 2)));
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
