// (TASK-B0406 · REQ-0286) المتجر: صوت نتيجة البحث (بعد توقّف الكتابة) وصوت نهاية المتجر
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const st = { categories: [{ id: 'c0', name: 'قسم', order: 0 }], banners: [], offers: [], branches: [], products: [{ id: 'p1', name: 'كاميرا كانون', price: 10, category_id: 'c0', images: [] }] };
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  const o = await H.open('logo.jpg', { init: `try{localStorage.clear();localStorage.setItem('gmt_intro_seen_build','x');localStorage.setItem('gmt_sound','on')}catch(e){}`, w: 390, h: 800, mobile: true, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(5000);
  await o.pg.evaluate(() => { window.__e = []; const f = GMTAudio.emit; GMTAudio.emit = function (e) { window.__e.push(e); return f.apply(this, arguments); }; });
  await o.pg.evaluate(() => { performSearch('كام'); performSearch('كاميرا'); }); await o.pg.waitForTimeout(1000);
  ok(await o.pg.evaluate(() => JSON.stringify(window.__e)) === '["search.results"]', 'بحثٌ بنتيجة ⇒ صوتٌ واحد فقط رغم حرفين: ' + await o.pg.evaluate(() => JSON.stringify(window.__e)));
  await o.pg.evaluate(() => { window.__e = []; performSearch('zzzzqq'); }); await o.pg.waitForTimeout(1000);
  ok(await o.pg.evaluate(() => JSON.stringify(window.__e)) === '["search.empty"]', 'بحثٌ بلا نتيجة ⇒ صوت search.empty');
  await o.pg.evaluate(() => { window.__e = []; try { _endless.wrap = _endless.wrap || document.body; } catch (_) {} _endlessEnd(); });
  ok(await o.pg.evaluate(() => window.__e.indexOf('UI_LIST_END') !== -1), 'نهاية المتجر ⇒ UI_LIST_END');
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
