const H = require('./h.js');
const PAGES = process.argv.slice(2).length ? process.argv.slice(2) : ['pos.html', 'orders.html', 'inventory.html', 'admin_pos.html', 'purchase.html'];
const W = +(process.env.W || 390);
(async () => {
  await H.seed();
  const sum = [];
  for (const page of PAGES) {
    const { browser, pg, errs } = await H.open(page, { init: H.ADMIN_INIT, w: W, h: 850, wait: 6000, mobile: W < 700 });
    const has = await pg.evaluate(() => !!window.GMTHints);
    if (!has) { console.log(page, 'بلا GMTHints'); await browser.close(); continue; }
    const cnt = await pg.evaluate(() => GMTHints.count());
    await pg.evaluate(() => GMTHints.tour());
    await pg.waitForTimeout(500);
    const res = await pg.evaluate(async () => {
      const bad = [], steps = []; let guard = 0;
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      while (guard++ < 120) {
        await sleep(700);
        const st = GMTHints._state(); if (!st.on) break;
        const el = st.el; if (!el) break;
        const r = el.getBoundingClientRect();
        const spot = [...document.querySelectorAll('[data-gmt-hints]')].find(x => x.style.border && /2px solid/.test(x.style.cssText));
        const sr = spot ? spot.getBoundingClientRect() : null;
        const aligned = sr && Math.abs((sr.left + sr.width / 2) - (r.left + r.width / 2)) < 14 && Math.abs((sr.top + sr.height / 2) - (r.top + r.height / 2)) < 14;
        const inView = r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
        const topEl = document.elementsFromPoint(Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1)).find(t => !(t.closest && t.closest('[data-gmt-hints]')));
        const covered = !(topEl && (topEl === el || el.contains(topEl) || topEl.contains(el)));
        const tx = (el.innerText || el.getAttribute('title') || el.id || el.tagName).trim().slice(0, 22);
        steps.push(tx);
        if (!aligned || !inView || covered) bad.push({ i: st.idx, tx, aligned: !!aligned, inView, covered, r: [r.left, r.top, r.width, r.height].map(Math.round), sr: sr && [sr.left, sr.top, sr.width, sr.height].map(Math.round), tag: el.tagName + '.' + String(el.className).slice(0, 30) });
        const nx = document.querySelector('[data-h="next"]'); if (!nx) break; nx.click();
      }
      GMTHints.end();
      return { steps: steps.length, bad, skipped: GMTHints.skipped() };
    });
    console.log(page.padEnd(18), 'W' + W, '| عدد الأزرار المرشَّحة', String(cnt).padStart(3), '| خطوات الجولة', String(res.steps).padStart(3), '| تخطّى', res.skipped, '| خطوات مشبوهة (غير محاذية/خارج الشاشة/مغطّاة):', res.bad.length, JSON.stringify(res.bad.slice(0, 2)));
    sum.push([page, cnt, res.steps, res.bad.length]);
    console.log('   أخطاء:', errs.filter(e => !/404|400|Failed|favicon/.test(e)).slice(0, 2));
    await browser.close();
  }
})();
