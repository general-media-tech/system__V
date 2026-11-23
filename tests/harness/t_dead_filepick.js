// (TASK-A0580 · المالك seq 978) تنبيه البوت «زر بلا أثر: صوّر المنتج / العلبة» كان كاذباً: الزرّ يفتح منتقي الملفّات/الكاميرا (نافذة النظام
// لا تغيّر الصفحة). صيد النمط: كلّ فتحٍ لمنتقي ملفّ (input[type=file].click/showPicker) أو للكاميرا (getUserMedia) أثرٌ — وزرٌّ ميّتٌ حقيقيّ ما زال يُسجَّل.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 0 });
  await pg.route(/\/functions\/v1\/gmt-tg\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await pg.waitForTimeout(6000);
  const grab = () => pg.evaluate(() => { let a = []; try { a = JSON.parse(localStorage.getItem('gmt_bugs_v3') || '[]'); } catch (_) {} return a.map(x => x.type + ': ' + x.msg); });
  const clear = () => pg.evaluate(() => { try { localStorage.removeItem('gmt_bugs_v3'); } catch (_) {} });
  await pg.evaluate(() => {
    const host = document.getElementById('tab-btn-log').parentNode;
    const f = document.createElement('input'); f.type = 'file'; f.hidden = true; f.id = 'fp'; document.body.appendChild(f);
    const b = document.createElement('button'); b.id = 'shotbtn'; b.textContent = '📸 صوّر المنتج / العلبة'; b.onclick = () => f.click(); host.appendChild(b);
    const c = document.createElement('button'); c.id = 'cambtn'; c.textContent = 'كاميرا تجريبية'; c.onclick = () => { navigator.mediaDevices && navigator.mediaDevices.getUserMedia({ video: true }).catch(() => {}); }; host.appendChild(c);
    const d = document.createElement('button'); d.id = 'deadbtn'; d.textContent = 'زر تجريبي ميّت'; d.setAttribute('onclick', 'void 0'); host.appendChild(d);
  });
  pg.on('filechooser', fc => {});
  await pg.waitForTimeout(800); await clear();
  await pg.click('#shotbtn'); await pg.waitForTimeout(2600);
  let L = await grab();
  ok(!L.some(x => /بلا أثر/.test(x) && /صوّر المنتج/.test(x)), '«صوّر المنتج / العلبة» (يفتح منتقي الملفّات) ⇒ لا «زر بلا أثر»: ' + JSON.stringify(L.filter(x => /بلا أثر/.test(x))));
  await clear(); await pg.click('#cambtn'); await pg.waitForTimeout(2600); L = await grab();
  ok(!L.some(x => /بلا أثر/.test(x) && /كاميرا تجريبية/.test(x)), 'زرّ يفتح الكاميرا ⇒ لا «زر بلا أثر»');
  await clear(); await pg.click('#deadbtn'); await pg.waitForTimeout(2600); L = await grab();
  ok(L.some(x => /بلا أثر/.test(x) && /زر تجريبي ميّت/.test(x)), 'زرّ ميّت حقيقي ما زال يُسجَّل');
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
