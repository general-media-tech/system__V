const H = require('./h.js');
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('home.html', { init: H.ADMIN_INIT, w: 390, h: 800, wait: 3500 });
  await pg.evaluate(() => window.GMTBrain.open());
  await pg.waitForSelector('#gmt-brain-panel');
  const chips = await pg.$$eval('#gb-chips button', bs => bs.map(b => b.textContent.trim()));
  console.log('chips:', JSON.stringify(chips));
  for (const key of ['علي بابا', 'المعرفة', 'سجل']) {
    const idx = chips.findIndex(t => t.includes(key));
    if (idx < 0) { console.log('لا زر:', key); continue; }
    await pg.evaluate(() => window.GMTBrain.open());
    await pg.waitForSelector('#gmt-brain-panel');
    const btns = await pg.$$('#gb-chips button'); await btns[idx].click(); await pg.waitForTimeout(500);
    const r = await pg.evaluate(() => {
      const w = [...document.querySelectorAll('body > div')].filter(e => e.id !== 'gmt-brain-panel' && getComputedStyle(e).position === 'fixed' && getComputedStyle(e).zIndex !== 'auto').sort((a, b) => +getComputedStyle(b).zIndex - +getComputedStyle(a).zIndex)[0];
      if (!w) return { found: false };
      const b = w.getBoundingClientRect(); const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { found: true, z: getComputedStyle(w).zIndex, onTop: el && !el.closest('#gmt-brain-panel') ? 'الحوار فوق' : 'نافذة العقل فوق (خطأ)' };
    });
    console.log(key, JSON.stringify(r));
    await pg.evaluate(() => { [...document.querySelectorAll('body > div')].forEach(e => { if (e.style.zIndex && +e.style.zIndex > 9000) e.remove(); }); });
  }
  console.log('errors:', errs.slice(0, 3));
  await browser.close();
})();
