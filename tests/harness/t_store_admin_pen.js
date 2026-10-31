// (المالك seq 277) الأدمن داخل المتجر: قلمٌ على كل منتج دائماً (بلا ?preview=1) ⇒ «تعديل سريع هنا» أو «فتح في أدمن المتجر»؛ الزبون لا يرى القلم
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-31T10:00:00Z', categories: [{ id: 'c1', name: 'قسم', order: 1 }],
    products: [{ id: 'sA', name: 'منتج أ', price: 0, images: [], category_id: 'c1' }] }]);
  const { browser, pg, errs } = await H.open('store.html', { w: 390, h: 844, wait: 7000 });
  const n = await pg.evaluate(() => document.querySelectorAll('[data-admin-pen]').length);
  ok(n === 1, 'الأدمن يرى القلم على المنتج بلا ?preview=1: ' + n);
  await pg.evaluate(() => document.querySelector('[data-admin-pen]').click()); await sleep(300);
  const menu = await pg.evaluate(() => (document.querySelector('[data-pen-menu]') || {}).innerText || '');
  ok(/تعديل سريع هنا/.test(menu) && /فتح في أدمن المتجر/.test(menu), 'القائمة داخل البطاقة: تعديل سريع / فتح الأدمن');
  await pg.evaluate(() => [...document.querySelectorAll('[data-pen-menu] button')][0].click()); await sleep(500);
  const fill = async v => { await pg.evaluate(v => { const i = document.querySelector('.gmtask-in'); i.value = v; i.dispatchEvent(new Event('input')); }, v);
    await pg.evaluate(() => { const bs = [...document.querySelectorAll('.gmtask-ov button')]; (bs.find(b => /موافق|حفظ|تأكيد|نعم/.test(b.textContent)) || bs[bs.length - 1]).click(); }); await sleep(500); };
  await fill('منتج أ المعدَّل'); await fill('35');
  await sleep(800);
  const d = await H.call('/__dump', undefined, 'GET'); const p = d.gmt_store[0].products.find(x => x.id === 'sA');
  ok(p && p.name === 'منتج أ المعدَّل' && Number(p.price) === 35, 'التعديل السريع حُفظ في المتجر: ' + JSON.stringify(p && { n: p.name, pr: p.price }));
  const t = await pg.evaluate(() => document.body.innerText);
  ok(/منتج أ المعدَّل/.test(t) && /35\.00/.test(t), 'والبطاقة تحدّثت فوراً بلا إعادة تحميل');
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  const c = await H.open('store.html', { w: 390, h: 844, wait: 6000, init: "try{sessionStorage.removeItem('gmt_admin_mode');localStorage.removeItem('gmt_session');localStorage.setItem('gmt_intro_seen_build','x');}catch(e){}" });
  const n2 = await c.pg.evaluate(() => document.querySelectorAll('[data-admin-pen]').length);
  ok(n2 === 0, 'الزبون لا يرى القلم: ' + n2);
  await c.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
