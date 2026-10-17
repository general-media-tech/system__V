const H = require('./h.js');
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('inventory.html', { init: H.ADMIN_INIT, w: 393, h: 852, wait: 4500 });
  await pg.evaluate(() => { try { switchAppMode('transfer'); } catch (e) {} });
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(() => {
    const out = [];
    const panel = document.getElementById('transfer-panel');
    const all = [panel, ...panel.querySelectorAll('*')];
    for (const e of all) {
      const cs = getComputedStyle(e); if (cs.display === 'none') continue;
      const b = e.getBoundingClientRect();
      if (b.width > 400) out.push(e.tagName + '#' + e.id + ' ' + String(e.className).slice(0, 25) + ' w=' + Math.round(b.width) + ' flex=' + cs.display + '/' + cs.flexWrap + ' ' + (e.getAttribute('style') || '').slice(0, 70));
    }
    return { innerWidth, panelW: panel.getBoundingClientRect().width, out: out.slice(0, 15) };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
