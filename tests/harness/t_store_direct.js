// (TASK-0255 · المالك seq 174) «من داخل التطبيق سواء من نقطه او جرد ما في داعي تاخذني على متجر وتفتح لي … دخلني مباشره الى المنتج»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-28T10:00:00Z', categories: [{ id: 'c1', name: 'عدسات', order: 1 }],
    products: [{ id: 's_a', name: 'عدسة كانون 50', price: 50, images: [], category_id: 'c1' }, { id: 's_b', name: 'منتج آخر', price: 40, images: [], category_id: 'c1' }] }]);
  const probe = async (path) => {
    const { browser, pg, errs } = await H.open(path, { w: 390, h: 844, mobile: true, wait: 0 });
    const t0 = Date.now();
    await pg.waitForFunction(() => { const m = document.getElementById('product-modal'); return m && !m.classList.contains('hidden') && /\S/.test((document.getElementById('product-modal-name') || {}).textContent || '') && getComputedStyle(m).display !== 'none' && getComputedStyle(m).visibility !== 'hidden' && getComputedStyle(m).opacity !== '0'; }, null, { timeout: 15000 }).catch(() => {});
    const ms = Date.now() - t0;
    const r = await pg.evaluate(() => { const i = document.getElementById('intro-screen'); return { name: (document.getElementById('product-modal-name') || {}).textContent, intro: !!i && getComputedStyle(i).display !== 'none' && !i.classList.contains('hide') }; });
    const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
    await browser.close(); return Object.assign(r, { ms, real });
  };
  const d = await probe('store.html?direct=1#product=s_a');
  ok(d.name === 'عدسة كانون 50' && !d.intro, 'من التطبيق (?direct=1): المنتج مفتوح مباشرةً بلا انترو: ' + JSON.stringify(d));
  ok(d.ms < 3000, 'يظهر المنتج خلال ' + d.ms + ' مللي (الانترو وحده ٣٫٢ ث)');
  const c = await probe('store.html#product=s_a');
  ok(c.name === 'عدسة كانون 50' && c.ms > d.ms, 'رابط الزبون (بلا direct) كما كان — بالانترو: ' + c.ms + ' مللي');
  ok(!d.real.length && !c.real.length, 'لا أخطاء JS ' + d.real.concat(c.real).slice(0, 2).join(' / '));
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
