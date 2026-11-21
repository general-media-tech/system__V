// (TASK-A0538 · المالك seq 873) «قارئ سكانر يقرأ رقم الكاميرا عبر صورة أو سكانر مباشر يربطه بالكفالة»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('guarantee.html', { w: 390, h: 844, wait: 4500 });
  const ui = await pg.evaluate(() => ({ sn: !!document.querySelector('[data-serial-scan] [data-gmt-scan]'), snPhoto: !!document.querySelector('[data-serial-scan] [data-gmt-scan-photo]'), q: !!document.querySelector('[data-search-scan] [data-gmt-scan-photo]') }));
  ok(ui.sn && ui.snPhoto && ui.q, 'حقل الرقم التسلسلي: «باركود» + «📸 صورة» · وحقل البحث كذلك: ' + JSON.stringify(ui));
  // السكانر المربوط: كتابة سريعة + Enter وحقل الرقم التسلسلي فيه المؤشّر
  const scan = async (id, code) => { await pg.evaluate(id => { const e = document.getElementById(id); e.value = ''; e.focus(); }, id); for (const ch of code) await pg.keyboard.press(ch === '/' ? 'Slash' : ch, { delay: 0 }); await pg.keyboard.press('Enter'); await sleep(400); };
  await scan('serialNo', 'SN123456789012');
  ok(await pg.evaluate(() => document.getElementById('serialNo').value) === '123456789012', 'السكانر ⇒ الرقم في حقل S/N بلا البادئة «SN»');
  // باركود المنتج EAN-13 ⇒ يُسأل · الرفض يُفرغ الحقل
  await pg.evaluate(() => { window.__asked = 0; GMTAsk.confirm = async () => { window.__asked++; return false; }; });
  const EAN = (b => { let t = 0; for (let i = 0; i < 12; i++) t += (+b[i]) * (i % 2 ? 3 : 1); return b + (10 - t % 10) % 10; })('454929213511');
  await scan('serialNo', EAN);
  const ean = await pg.evaluate(() => ({ v: document.getElementById('serialNo').value, a: window.__asked }));
  ok(ean.a === 1 && ean.v === '', 'باركود المنتج (EAN-13 صحيح) ⇒ سؤال «هذا ليس S/N» · الرفض لا يعتمده: ' + JSON.stringify(ean));
  // السكانر يكتب في الحقل الذي فيه المؤشّر (البحث) لا في أوّل حقلٍ رُبط
  await pg.evaluate(() => { document.getElementById('serialNo').value = 'KEEP'; let e = document.getElementById('adminSearch'); while (e) { if (e.style) { e.style.display = e.style.display === 'none' ? 'block' : e.style.display; e.classList && e.classList.remove('hidden'); } e = e.parentElement; } });
  await scan('adminSearch', 'ABC98765');
  const two = await pg.evaluate(() => [document.getElementById('serialNo').value, document.getElementById('adminSearch').value]);
  ok(two[0] === 'KEEP' && two[1] === 'ABC98765', 'السكانر يملأ الحقل الذي فيه المؤشّر: ' + JSON.stringify(two));
  // قراءة باركود من صورة (Code128 مولَّد بـJsBarcode ⇒ GMTScan.decodeFile)
  const fromPhoto = await pg.evaluate(async () => {
    await new Promise((ok, bad) => { if (window.JsBarcode) return ok(); const s = document.createElement('script'); s.src = 'lib/JsBarcode.all.min.js'; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
    const c = document.createElement('canvas'); JsBarcode(c, '0123456789AB', { format: 'CODE128', width: 3, height: 120, margin: 30 });
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    return GMTScan.decodeFile(new File([blob], 'sn.png', { type: 'image/png' }));
  });
  ok(fromPhoto === '0123456789AB', '«📸 صورة»: يقرأ الباركود من صورة على الجهاز: ' + JSON.stringify(fromPhoto));
  const real = errs.filter(e => !/Failed to load resource|status of (400|401|404)/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
