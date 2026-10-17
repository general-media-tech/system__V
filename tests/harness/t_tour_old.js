const H = require('./h.js');
(async () => {
  await H.seed();
  for (const page of ['inventory.html', 'pos.html', 'orders.html']) {
    const { browser, pg } = await H.open(page, { init: H.ADMIN_INIT, w: 390, h: 850, wait: 6000 });
    await pg.evaluate(() => GMTHints.tour()); await pg.waitForTimeout(600);
    const r = await pg.evaluate(async () => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms)); let bad = 0, n = 0;
      for (let g = 0; g < 60; g++) {
        await sleep(700);
        const spot = [...document.querySelectorAll('div')].find(x => /box-shadow:\s*0px 0px 0px 9999px/.test(x.style.cssText) || /9999px/.test(x.style.cssText));
        const nx = [...document.querySelectorAll('button[data-h="next"]')][0]; if (!spot || !nx) break; n++;
        const sr = spot.getBoundingClientRect(); const vis = sr.right > 0 && sr.left < innerWidth && sr.bottom > 0 && sr.top < innerHeight && sr.width > 14;
        const cx = Math.min(Math.max(sr.left + sr.width / 2, 0), innerWidth - 1), cy = Math.min(Math.max(sr.top + sr.height / 2, 0), innerHeight - 1);
        const top = document.elementsFromPoint(cx, cy).filter(t => t !== spot && !(t.style && /position:\s*fixed/.test(t.style.cssText) && /2147483/.test(t.style.cssText)))[0];
        if (!vis || sr.top < -50 || sr.left < -50) bad++;
        nx.click();
      }
      return { n, bad };
    });
    console.log('القديم', page.padEnd(16), JSON.stringify(r));
    await browser.close();
  }
})();
