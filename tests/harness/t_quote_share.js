// (seq B1068) عرض السعر ⇒ «💬 واتساب» يرسل صورة العرض مع نصّه (نافذة المشاركة: واتساب + واتساب بزنس) · إن لم تُشارَك ⇒ واتساب بالنصّ
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('quote.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 5000 });
  const r = await pg.evaluate(async () => {
    const calls = [], opened = []; window.open = u => { opened.push(String(u)); return null; };
    GMTShare.image = async (html, name, opt) => { calls.push({ html: html.length, hasItem: /عدسة تجربة/.test(html), name, text: opt && opt.text }); return 'saved'; };
    document.getElementById('q-manual').click();
    const n = document.querySelector('#q-items [data-f="name"]'); n.value = 'عدسة تجربة'; n.dispatchEvent(new Event('input', { bubbles: true }));
    const pr = document.querySelector('#q-items [data-f="price"]'); if (pr) { pr.value = '120'; pr.dispatchEvent(new Event('input', { bubbles: true })); }
    document.getElementById('q-wa').click(); await new Promise(z => setTimeout(z, 300));
    return { calls, opened };
  });
  ok(r.calls.length === 1 && r.calls[0].hasItem && /عرض سعر/.test(r.calls[0].name) && /عدسة تجربة/.test(r.calls[0].text || ''), 'واتساب ⇒ صورة العرض (فيها البند) + نصّه: ' + JSON.stringify(r.calls[0] || {}).slice(0, 160));
  ok(r.opened.length === 1 && /wa\.me/.test(r.opened[0]), 'لم تُشارَك عبر النافذة (كمبيوتر) ⇒ يُفتح واتساب بالنصّ بعد حفظ الصورة');
  ok(!errs.filter(e => !/favicon|404|400|406|Failed to load/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
