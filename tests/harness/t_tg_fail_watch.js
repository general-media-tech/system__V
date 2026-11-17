// (VER-4#REQ-0432) فشل رسائل/تعديل تيليغرام يُسلَّم للمفتّش (GMTBug · type=tg_fail) دون تغيير الردّ؛ والنجاح لا يُسجَّل
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('orders.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 4000 });
  const bugs = () => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('gmt_bugs_v3') || '[]').map(x => x.type + ': ' + x.msg); } catch (_) { return []; } });
  const call = (url) => pg.evaluate(async (u) => { try { const r = await fetch(u, { method: 'POST', body: '{}' }); return r.status; } catch (e) { return 'ERR'; } }, url);
  await pg.evaluate(() => { try { localStorage.removeItem('gmt_bugs_v3'); } catch (_) {} });
  await call('https://api.telegram.org/botX/sendMessage');   // نجاح (200 من H.open)
  await pg.waitForTimeout(800);
  ok(!(await bugs()).some(b => /tg_fail/.test(b)), 'ردّ ناجح ⇒ لا بلاغ');
  await pg.route('https://api.telegram.org/**', r => r.fulfill({ status: 500, body: '{"ok":false}' }));
  const st = await call('https://api.telegram.org/botX/editMessageText');
  await call('https://api.telegram.org/botX/editMessageText');   // تكرار ⇒ لا يُغرق السجلّ
  await pg.waitForTimeout(1500);
  const b = (await bugs()).filter(x => /tg_fail/.test(x));
  ok(st === 500, 'الردّ يصل للمستدعي كما هو (500)');
  ok(b.length === 1 && /تيليغرام ردّ 500 \(editMessageText\)/.test(b[0]), 'بلاغ tg_fail واحد (مع كبح التكرار): ' + JSON.stringify(b));
  await pg.unroute('https://api.telegram.org/**');
  await pg.route('https://api.telegram.org/**', r => r.abort());
  const e = await call('https://api.telegram.org/botX/sendPhoto'); await pg.waitForTimeout(1500);
  ok(e === 'ERR' && (await bugs()).some(x => /تيليغرام لم يصل \(sendPhoto\)/.test(x)), 'انقطاع الشبكة ⇒ «تيليغرام لم يصل» والخطأ يُمرَّر للمستدعي');
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
