// (TASK-B0514 · المالك seq 829 «هون زر الخروج ما عم يعمل وباكثر من مكان صيد هالنمط») — زرّ «خروج» في أدمن النقاط وأدمن المتجر
// كان يمسح علامة الصفحة فقط فيعيد «وضع الإدارة» فتح اللوحة. الآن: يُغلق وضع الإدارة ويعود للرئيسيّة.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  for (const [page, btn] of [['admin_pos.html', '.tb-logout'], ['admin_store.html', 'button[onclick="adminLogout()"]']]) {
    const INIT = 'if(!sessionStorage.getItem("t_once")){' + H.ADMIN_INIT + ';sessionStorage.setItem("t_once","1")}';   // وضع الإدارة مرّةً واحدة — لا يُعاد عند الانتقال
    const o = await H.open(page, { w: 1366, h: 860, mobile: false, wait: 5000, init: INIT });
    const vis = await o.pg.$eval(btn, b => b.getBoundingClientRect().width > 0).catch(() => false);
    ok(vis, page + ': زرّ الخروج ظاهر');
    await o.pg.click(btn).catch(() => {});
    await o.pg.waitForTimeout(500);
    await o.pg.evaluate(() => { const b = [...document.querySelectorAll('.gmtask-ov button')].find(x => x.textContent.trim() === 'خروج'); if (b) b.click(); });
    await o.pg.waitForURL(/home\.html/, { timeout: 6000 }).catch(() => {});
    const r = await o.pg.evaluate(() => ({ url: location.pathname.split('/').pop(), adm: sessionStorage.getItem('gmt_admin_mode'), auth: localStorage.getItem('gmt_admin_auth') }));
    ok(r.url === 'home.html' && r.adm !== '1' && r.auth !== '1', page + ': «خروج» يُغلق وضع الإدارة ويعود للرئيسيّة — ' + JSON.stringify(r));
    await o.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
