const H = require('./h.js');
const OUT = '/tmp/gmt-out/';
(async () => {
  await H.seed();
  for (const [page, tag] of [['admin_sovereign.html', 'sov'], ['admin_pos.html', 'apos']]) {
    for (const [w, h, lab] of [[1366, 820, 'desk'], [390, 800, 'mob']]) {
      const { browser, pg, errs } = await H.open(page, { init: H.ADMIN_INIT, w, h, wait: 4500 });
      const d = await pg.evaluate(() => {
        const tabs = [...document.querySelectorAll('[role=tab], .tab, .tabs button, nav button, .nav-item, .sb-item, .side a, .side button, [data-tab]')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(t => t && t.length < 40);
        const emoji = (document.body.innerText.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
        return { title: document.title, tabs: [...new Set(tabs)].slice(0, 40), emoji, hscroll: document.documentElement.scrollWidth > innerWidth + 2, bg: getComputedStyle(document.body).backgroundColor };
      });
      console.log(`== ${tag}-${lab}:`, JSON.stringify(d).slice(0, 900), '| errs:', errs.slice(0, 2));
      await pg.screenshot({ path: `${OUT}${tag}_${lab}.png` });
      await browser.close();
    }
  }
})();
