// (المالك seq 277) الأدمن داخل المتجر: قلمٌ على كل منتج دائماً (بلا ?preview=1) ⇒ «تعديل كامل هنا» (seq 336: صفحة التعديل الكاملة بصلاحية الأدمن) أو «فتح في أدمن المتجر»؛ الزبون لا يرى القلم
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { prods } = await H.seed(); const P = prods[0];
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-31T10:00:00Z', categories: [{ id: 'c1', name: 'قسم', order: 1 }],
    products: [{ id: 'sA', name: 'منتج أ', price: 0, images: [], category_id: 'c1', inv_id: String(P.id) }] }]);
  const { browser, pg, errs } = await H.open('store.html', { w: 390, h: 844, wait: 7000 });
  const n = await pg.evaluate(() => document.querySelectorAll('[data-admin-pen]').length);
  ok(n === 1, 'الأدمن يرى القلم على المنتج بلا ?preview=1: ' + n);
  await pg.evaluate(() => document.querySelector('[data-admin-pen]').click()); await sleep(300);
  const menu = await pg.evaluate(() => (document.querySelector('[data-pen-menu]') || {}).innerText || '');
  ok(/تعديل كامل هنا/.test(menu) && /فتح في أدمن المتجر/.test(menu) && !/تعديل سريع/.test(menu), '(seq 336) القائمة: «تعديل كامل هنا» / فتح الأدمن — لا «تعديل سريع» الذي يغيّر الاسم فقط');
  /* الصلاحية المعتادة: تُسأل أوّلاً، والرفض لا يفتح شيئاً */
  const asked = await pg.evaluate(async () => { let q = 0; const o = GMTRole.requireAdmin; GMTRole.requireAdmin = async w => { q++; window.__why = w; return false; };
    [...document.querySelectorAll('[data-pen-menu] button')][0].click(); await new Promise(r => setTimeout(r, 900)); GMTRole.requireAdmin = o; return { q, why: window.__why, open: !!document.getElementById('gmt-pe') }; });
  ok(asked.q === 1 && !asked.open, 'تُطلب صلاحية الأدمن («' + asked.why + '») والرفض لا يفتح التعديل');
  await pg.evaluate(async () => { GMTRole.requireAdmin = async () => true; document.querySelector('[data-admin-pen]').click(); await new Promise(r => setTimeout(r, 200)); [...document.querySelectorAll('[data-pen-menu] button')][0].click(); });
  await sleep(2500);
  const pe = await pg.evaluate(() => { const g = document.getElementById('gmt-pe'); if (!g) return null; const v = k => (g.querySelector('[data-f="' + k + '"]') || {}).value;
    return { name: v('name'), price: v('price'), wp: v('wholesale_price'), bc: v('barcode'), store: !!g.querySelector('[data-pe-store]'), sname: (g.querySelector('[data-s="name"]') || {}).value }; });
  ok(pe && pe.name === P.name && pe.bc === P.barcode, 'تُفتح صفحة التعديل الكاملة لمنتج الجرد المربوط فوق المتجر: ' + JSON.stringify(pe));
  ok(pe && pe.store && pe.sname === 'منتج أ', 'وفيها قسم المتجر (اسم القائمة في المتجر)');
  await pg.evaluate(() => { const g = document.getElementById('gmt-pe'); const set = (sel, v) => { const i = g.querySelector(sel); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); };
    set('[data-f="name"]', 'اسم الجرد الجديد'); set('[data-f="price"]', '310'); set('[data-f="wholesale_price"]', '290'); set('[data-s="name"]', 'منتج أ المعدَّل'); const sm = g.querySelector('[data-s-same]'); if (sm.checked) { sm.checked = false; sm.dispatchEvent(new Event('change', { bubbles: true })); } set('[data-s="price"]', '35');
    g.querySelector('[data-pe-save]').click(); });
  await sleep(3500);
  const row = (await H.call('/rest/v1/products?id=eq.' + P.id + '&select=name,price,wholesale_price', undefined, 'GET'))[0];
  ok(row && row.name === 'اسم الجرد الجديد' && Number(row.price) === 310 && Number(row.wholesale_price) === 290, 'حُفظ في الجرد: الاسم والسعر والجملة — ' + JSON.stringify(row));
  const d = await H.call('/__dump', undefined, 'GET'); const sp = d.gmt_store[0].products.find(x => x.id === 'sA');
  ok(sp && sp.name === 'منتج أ المعدَّل' && Number(sp.price) === 35, 'وحُفظ في المتجر: ' + JSON.stringify(sp && { n: sp.name, pr: sp.price }));
  await sleep(800);
  const t = await pg.evaluate(() => document.body.innerText);
  ok(/منتج أ المعدَّل/.test(t), 'والبطاقة في المتجر تحدّثت بلا إعادة تحميل');
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  const c = await H.open('store.html', { w: 390, h: 844, wait: 6000, init: "try{sessionStorage.removeItem('gmt_admin_mode');localStorage.removeItem('gmt_session');localStorage.setItem('gmt_intro_seen_build','x');}catch(e){}" });
  const n2 = await c.pg.evaluate(() => document.querySelectorAll('[data-admin-pen]').length);
  ok(n2 === 0, 'الزبون لا يرى القلم: ' + n2);
  await c.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
