const H = require('./h.js');
(async () => {
  await H.seed();
  for (const [label, init, w] of [['admin-mobile', H.ADMIN_INIT, 390], ['admin-desktop', H.ADMIN_INIT, 1366], ['staff-mobile', H.STAFF_INIT, 390]]) {
    const { browser, pg, errs } = await H.open('home.html', { init, w, h: w > 700 ? 820 : 800 });
    const data = await pg.evaluate(() => {
      const links = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => h && !h.startsWith('#') && !h.startsWith('http') && !h.startsWith('tel') && !h.startsWith('javascript'));
      const uniq = [...new Set(links.map(h => h.split('?')[0]))];
      const emojiHeads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,button,.t,.title')].map(e => e.textContent.trim()).filter(t => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t)).slice(0, 8);
      return { title: document.title, nLinks: uniq.length, links: uniq, emojiHeads, hscroll: document.documentElement.scrollWidth > innerWidth + 2 };
    });
    console.log('==', label, 'title:', data.title, '| tools:', data.nLinks, '| hscroll:', data.hscroll);
    console.log('   emoji in headings/buttons:', JSON.stringify(data.emojiHeads));
    console.log('   links:', data.links.join(' '));
    console.log('   errors:', errs.slice(0, 5));
    await pg.screenshot({ path: `/tmp/gmt-out/home_${label}.png` });
    await browser.close();
  }
})();
