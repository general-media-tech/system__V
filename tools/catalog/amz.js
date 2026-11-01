// أداة الكتالوج: node amz.js search "<query>"  |  node amz.js dp <ASIN> [outJson]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
(async () => {
  const [cmd, arg, out] = process.argv.slice(2);
  const br = await chromium.launch();
  const ctx = await br.newContext({ locale: 'en-US', userAgent: UA, viewport: { width: 1366, height: 900 } });
  const pg = await ctx.newPage();
  try {
    if (cmd === 'search') {
      for (let t = 0; t < 3; t++) {
        await pg.goto('https://www.amazon.com/s?k=' + encodeURIComponent(arg), { timeout: 60000, waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(2000 + t * 3000);
        if (await pg.locator('div[data-component-type="s-search-result"]').count()) break;
      }
      const r = await pg.evaluate(() => [...document.querySelectorAll('div[data-asin][data-component-type="s-search-result"]')].slice(0, 10).map(e => ({
        asin: e.dataset.asin, t: ([...e.querySelectorAll('h2')].map(h => h.getAttribute('aria-label') || h.innerText).sort((a, b) => b.length - a.length)[0] || '').slice(0, 160), img: (e.querySelector('img.s-image') || {}).src || '',
        price: ((e.querySelector('.a-price .a-offscreen') || {}).innerText || '') })));
      console.log(JSON.stringify(r, null, 1));
    } else if (cmd === 'dp') {
      await pg.goto('https://www.amazon.com/dp/' + arg, { timeout: 60000, waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(2500);
      const r = await pg.evaluate(() => {
        const html = document.documentElement.innerHTML;
        const hi = [...new Set([...html.matchAll(/"hiRes":"(https:[^"]+)"/g)].map(m => m[1]))];
        const large = [...new Set([...html.matchAll(/"large":"(https:[^"]+)"/g)].map(m => m[1]))];
        const rows = {};
        document.querySelectorAll('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr, #prodDetails tr, .prodDetTable tr, #productOverview_feature_div tr, #poExpander tr').forEach(tr => {
          const k = (tr.querySelector('th,td.a-span3') || {}).innerText, v = (tr.querySelector('td:last-child') || {}).innerText;
          if (k && v && k.trim() !== v.trim()) rows[k.trim().replace(/\s+/g, ' ')] = v.trim().replace(/[‎‏]/g, '').replace(/\s+/g, ' ');
        });
        document.querySelectorAll('#detailBullets_feature_div li').forEach(li => { const t = li.innerText.replace(/[‎‏]/g, '').split(':'); if (t.length > 1) rows[t[0].trim()] = t.slice(1).join(':').trim(); });
        const aplus = [...new Set([...document.querySelectorAll('#aplus img, #aplus_feature_div img, .aplus-v2 img')].map(i => i.getAttribute('data-src') || i.src).filter(u => u && /^https/.test(u) && !/grey-pixel|transparent/.test(u)))];
        return { title: (document.querySelector('#productTitle') || {}).innerText || document.title,
          brand: ((document.querySelector('#bylineInfo') || {}).innerText || '').trim(),
          bullets: [...document.querySelectorAll('#feature-bullets li span.a-list-item')].map(s => s.innerText.trim()).filter(Boolean),
          desc: ((document.querySelector('#productDescription') || {}).innerText || '').trim().slice(0, 2000),
          images: hi.length ? hi : large, aplus, rows };
      });
      if (out) fs.writeFileSync(out, JSON.stringify(r, null, 1));
      console.log(JSON.stringify({ title: r.title, brand: r.brand, nimg: r.images.length, naplus: r.aplus.length, bullets: r.bullets.slice(0, 8), rows: r.rows }, null, 1).slice(0, 5000));
    }
  } catch (e) { console.log('ERR', e.message); }
  await br.close();
})();
