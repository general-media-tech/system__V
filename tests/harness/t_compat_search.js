// (25 ت1 · TASK-0185) المالك seq 118: «الهودات والأغطية تنبحث مع التوافقيات — أكتب هود عدسة 50 STM 1.8 فهو لحاله يعطيني اسم الغطاء أو الهود
// … مسجّل عندنا في دليل التوافقيات · نفس الشيء البطاريات · وكل شيء لدينا — ابحث في كل المنتجات».
// كلمةٌ من المنتج نفسه (هود · غطا · بطارية) والباقي في «متوافق مع» ⇒ يجده · «50mm» وحدها لا تجلب كل غطاءٍ يذكرها · نقطة البيع تقرأ compat.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  // ١) المحرّك نفسه (صفحة الجرد)
  await H.seed();
  const inv = await H.open('inventory.html', { w: 1366, h: 900, mobile: false, wait: 4500 });
  const r = await inv.pg.evaluate(() => {
    const es68 = { name: 'ES-68 lens hood هود', group_name: 'هودات', compat: 'Canon EF 50mm f/1.8 STM' };
    const es62 = { name: 'ES-62 hood هود', group_name: 'هودات', compat: 'Canon EF 50mm f/1.8 II' };
    const cap = { name: '77mm lens cap for CANON غطا', compat: 'قطر الفلتر 77مم · Canon EF 24-105mm f/4L IS USM (77مم)' };
    const bat = { name: 'بطارية LP-E6NH', compat: ['Canon EOS 5D Mark IV', 'Canon EOS R5'] };
    const lens = { name: 'عدسة كانون 50mm f/1.8 STM', group_name: 'عدسات' };
    const T = (q, p) => GMTSuggest.hitsProduct(q, p);
    return { a: [T('هود عدسة 50 STM 1.8', es68), T('هود عدسة 50 STM 1.8', es62), T('هود عدسة 50 STM 1.8', cap), T('هود عدسة 50 STM 1.8', lens)],
             b: [T('غطاء عدسة 24-105', cap), T('غطا 24-105', es68)], c: [T('بطارية 5D Mark IV', bat), T('بطارية R5', bat), T('بطارية 90D', bat)],
             d: [T('50mm', es68), T('50mm', lens), T('ES-68', es68)] };
  });
  ok(JSON.stringify(r.a) === '[true,false,false,false]', '«هود عدسة 50 STM 1.8» ⇒ ES-68 وحده (لا ES-62 ولا الغطاء ولا العدسة نفسها): ' + JSON.stringify(r.a));
  ok(JSON.stringify(r.b) === '[true,false]', '«غطاء عدسة 24-105» ⇒ غطاء 77مم («غطاء» = «غطا») لا الهود: ' + JSON.stringify(r.b));
  ok(JSON.stringify(r.c) === '[true,true,false]', 'البطاريات: «بطارية 5D Mark IV» و«بطارية R5» تجد LP-E6NH · «بطارية 90D» لا (ليست في توافقها): ' + JSON.stringify(r.c));
  ok(JSON.stringify(r.d) === '[false,true,true]', '«50mm» وحدها للعدسة لا للهود · واسم الهود نفسه يجده كما كان: ' + JSON.stringify(r.d));
  await inv.browser.close();

  // ٢) نقطة البيع: تقرأ «متوافق مع» وبحث البيع يجد الهود بعدسته
  const { prods } = await H.seed();
  await H.call('/rest/v1/products?id=eq.' + prods[1].id, { name: 'ES-68 lens hood هود', compat: 'Canon EF 50mm f/1.8 STM' }, 'PATCH');
  const o = await H.open('pos.html', { w: 390, h: 844, mobile: true, wait: 5000, init: H.ADMIN_INIT + ` try{ localStorage.removeItem('gmt_pos_xcols2'); }catch(e){}` });
  const sel = []; o.pg.on('request', q => { const u = decodeURIComponent(q.url()); if (/\/rest\/v1\/products\?select=/.test(u)) sel.push(u); });
  await o.pg.evaluate(() => { try { localStorage.removeItem('gmt_pos_xcols3'); } catch (_) {} if (!branch) branch = { key: 'haleb', name: 'حلب' }; return typeof loadProducts === 'function' ? loadProducts() : null; });
  await o.pg.waitForTimeout(1500);
  ok(sel.some(u => /select=[^&]*compat/.test(u)), 'نقطة البيع تطلب عمود «متوافق مع» مع المنتجات');
  const pr = await o.pg.evaluate(() => { const p = allProducts.find(x => /ES-68/.test(x.name || '')); return p ? p.compat : null; });
  ok(pr === 'Canon EF 50mm f/1.8 STM', 'وصل التوافق للمنتج في نقطة البيع: ' + pr);
  const grid = await o.pg.evaluate(() => { const i = document.getElementById('searchInput'); i.value = 'هود عدسة 50 STM 1.8'; renderProds(); return (document.getElementById('prodsGrid') || {}).innerText || ''; });
  ok(/ES-68/.test(grid), 'بحث البيع «هود عدسة 50 STM 1.8» يُظهر ES-68: ' + grid.replace(/\s+/g, ' ').slice(0, 80));
  const real = o.errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
