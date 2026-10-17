const H = require('./h.js');
const OUT = __dirname + '/';
(async () => {
  await H.seed();
  const init = H.ADMIN_INIT.replace("localStorage.setItem('gmt_whatsnew_seen','999');", "localStorage.setItem('gmt_whatsnew_seen','0');");
  const { browser, pg, errs } = await H.open('inventory.html', { init, w: 393, h: 852, wait: 4500 });
  await pg.evaluate(() => { try { switchAppMode('transfer'); } catch (e) {} });
  await pg.waitForTimeout(1500);
  const m = await pg.evaluate(() => {
    const de = document.documentElement, vw = window.innerWidth;
    const bad = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed'; })
      .slice(0, 12).map(e => (e.tagName + '#' + e.id + '.' + String(e.className).slice(0, 30) + ' L' + Math.round(e.getBoundingClientRect().left) + ' R' + Math.round(e.getBoundingClientRect().right) + ' ' + (e.textContent || '').trim().slice(0, 18)));
    return { vw, scrollW: de.scrollWidth, bodyW: document.body.scrollWidth, bad };
  });
  console.log(JSON.stringify(m, null, 1));
  await pg.screenshot({ path: OUT + 'wn_before_panel.png' });
  await pg.evaluate(() => GMTWhatsNew.open());
  await pg.waitForTimeout(800);
  const d = await pg.evaluate(() => { const ov = document.getElementById('gmt-wn-ov'); if (!ov) return 'no overlay'; const r = ov.getBoundingClientRect(); const c = ov.firstElementChild.getBoundingClientRect(); return { ov: [r.left, r.right], dlg: [c.left, c.right], iw: innerWidth, vv: visualViewport && [visualViewport.width, visualViewport.scale] }; });
  console.log(JSON.stringify(d));
  await pg.screenshot({ path: OUT + 'wn_before_dialog.png' });
  console.log('errors:', errs.filter(e => !/404|400|Failed/.test(e)).slice(0, 3));
  await browser.close();
})();
