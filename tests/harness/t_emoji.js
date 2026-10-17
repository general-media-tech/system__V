const H = require('./h.js');
const OUT = '/tmp/gmt-out/';
const PAGES = ['admin_pos.html', 'inventory.html', 'bridge.html', 'backup.html', 'deal.html', 'orders.html', 'pos.html', 'purchase.html', 'sales_log.html', 'admin_store.html', 'admin_sovereign.html', 'home.html', 'store.html', 'check.html'];
(async () => {
  await H.seed();
  for (const p of PAGES) {
    const { browser, pg, errs } = await H.open(p, { init: H.ADMIN_INIT, w: 1366, h: 820, wait: 4500, mobile: false });
    const r = await pg.evaluate(() => {
      const EMO = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{2604}\u{2607}-\u{262F}\u{2638}-\u{27BF}\u{2B50}\u{2B55}\u{2B06}\u{2B07}\u{23F0}\u{23F3}]/gu;
      let n = 0; const s = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let x;
      while ((x = w.nextNode())) { const p = x.parentElement; if (!p || /SCRIPT|STYLE|TEXTAREA|OPTION|PRE|CODE/.test(p.tagName)) continue; const r = p.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue; const m = x.nodeValue.match(EMO); if (m) { n += m.length; if (s.length < 4) s.push(x.nodeValue.trim().slice(0, 22)); } }
      return { enabled: GMTIcon.iconifyEnabled && GMTIcon.iconifyEnabled(), left: n, sample: s, icons: document.querySelectorAll('.gmt-ei').length, dots: document.querySelectorAll('.gmt-dot').length };
    });
    console.log(p.padEnd(24), JSON.stringify(r), errs.filter(e => !/404|400|Failed to load/.test(e)).slice(0, 2));
    if (p === 'admin_pos.html') await pg.screenshot({ path: OUT + 'apos_after.png' });
    await browser.close();
  }
})();
