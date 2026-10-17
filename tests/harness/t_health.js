const H = require('./h.js');
(async () => {
  await H.seed();
  for (const label of ['بعد الإصلاح']) {
    const { browser, pg, reqs } = await H.open('home.html', { init: H.ADMIN_INIT + " localStorage.setItem('gmt_tg_token','x:y'); localStorage.setItem('gmt_tg_chat','1');", w: 390, h: 800, wait: 4500 });
    await pg.evaluate(() => { window.__tg = []; const of = window.fetch; window.fetch = function (u, o) { if (/api\.telegram\.org/.test(String(u))) { try { window.__tg.push(JSON.parse(o.body).text); } catch (e) {} return Promise.resolve(new Response('{"ok":true}')); } return of.apply(this, arguments); }; console.error('خطأ حقيقي من الصفحة للتجربة'); });
    await pg.evaluate(async () => { await GMTSelfCheck.run(false); await GMTSelfCheck.run(false); });
    reqs.length = 0;
    await pg.evaluate(() => GMTBrain.healthReport());
    await pg.waitForTimeout(1500);
    console.log(label, '→ رسائل تيليغرام:', reqs.length);
    console.log((await pg.evaluate(() => window.__tg)).join('\n---\n'));
    await browser.close();
  }
})();
