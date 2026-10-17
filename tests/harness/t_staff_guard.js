const H = require('./h.js');
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('inventory.html', { init: H.STAFF_INIT, w: 1200, h: 900, wait: 7000, mobile: false });
  const info = await pg.evaluate(() => { const els = [...document.querySelectorAll('[data-admin]')]; return { n: els.length, sample: els.slice(0, 8).map(e => (e.getAttribute('data-admin') || '') + ':' + (e.textContent || e.title || '').trim().slice(0, 14)), admin: GMTRole.isAdmin() }; });
  console.log(JSON.stringify(info));
  // اضغط زر إدارة (أول عنصر data-admin ظاهر) كموظف
  const clicked = await pg.evaluate(() => { const e = [...document.querySelectorAll('[data-admin]')].find(x => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; }); if (!e) return null; window.__ran = false; const orig = e.getAttribute('onclick'); e.click(); return (e.getAttribute('data-admin') || '') + '|' + (e.textContent || '').trim().slice(0, 20); });
  await pg.waitForTimeout(800);
  const dlg = await pg.evaluate(() => { const o = document.querySelector('.gmtask-ov'); return o ? (o.querySelector('.gmtask-hd') || {}).textContent + ' | ' + (o.querySelector('.gmtask-bd') || {}).textContent.slice(0, 80) : null; });
  ok(!!dlg && /الإدارة|للأدمن/.test(dlg), 'الموظّف يضغط زرّ إدارة ⇒ نافذة دخول الأدمن (لا تنفيذ): ' + clicked + ' → ' + dlg);
  console.log('errors:', errs.filter(e => !/404|400|Failed|favicon/.test(e)).slice(0, 3));
  await browser.close();
})();
