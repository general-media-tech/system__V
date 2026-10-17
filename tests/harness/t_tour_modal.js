const H = require('./h.js');
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('inventory.html', { init: H.ADMIN_INIT, w: 1200, h: 850, wait: 6000, mobile: false });
  const before = await pg.evaluate(() => GMTHints.count());
  await pg.evaluate(() => gmtBuyList()); await pg.waitForTimeout(500);
  const inside = await pg.evaluate(() => { const L = GMTHints._collect(); return { n: L.length, allIn: L.every(e => e.closest('#gmt-buy')), labels: L.map(e => (e.innerText || e.id || '').trim().slice(0, 14)) }; });
  console.log('   قبل النافذة:', before, '| بعدها:', JSON.stringify(inside));
  ok(inside.n > 0 && inside.n < before && inside.allIn, 'نافذةٌ مفتوحة ⇒ الجولة تقتصر على ما داخلها (لا أزرار مغطّاة خلفها)');
  await pg.evaluate(() => GMTHints.tour()); await pg.waitForTimeout(600);
  const st = await pg.evaluate(() => { const s = GMTHints._state(); return { on: s.on, inModal: !!(s.el && s.el.closest('#gmt-buy')) }; });
  ok(st.on && st.inModal, 'أوّل خطوة داخل النافذة');
  await pg.evaluate(() => GMTHints.end());
  await browser.close();
})();
