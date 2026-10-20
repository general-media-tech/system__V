// (20 ت1 · TASK-0114) لقطتا المالك: «انفال / درعا الحمامة / Rp» — الحمامة جزء العنوان لا منتج · صور المنتجات في المرشّحين ·
// «ما يُعرف أنّه منتج يُضاف، وما لا يُعرف (منتج؟ ملاحظة؟ عنوان؟) يُترك لي»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const REAL_COLS = ['id', 'name', 'barcode', 'price', 'image_url', 'store_url', 'group_name', 'short', 'search_terms', 'compat', 'haleb', 'daraa'];   // من القاعدة الحقيقية 20 ت1
async function run(init, msg) {
  const { browser, pg, errs } = await H.open('orders.html', { init: H.ADMIN_INIT + init, wait: 4500 });
  const sel = []; pg.on('request', r => { const u = decodeURIComponent(r.url()); const m = u.match(/\/rest\/v1\/products\?select=([^&]+)/); if (m) sel.push(m[1]); });
  const r = await pg.evaluate(async (msg) => {
    try { openAddModal && openAddModal(); } catch (_) {}
    await new Promise(z => setTimeout(z, 400));
    ['in-name', 'in-phone', 'in-addr', 'in-company', 'in-notes'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    document.getElementById('sp-text').value = msg; await smartFillFromPaste(); await new Promise(z => setTimeout(z, 300));
    const cat = await loadProductCatalog();
    return { addr: document.getElementById('in-addr').value, name: document.getElementById('in-name').value,
      items: [...document.querySelectorAll('#add-items-container [data-field="name"]')].map(i => i.value).filter(Boolean),
      unk: (document.getElementById('sp-unk-text') || {}).value || '', img: cat.filter(c => /^(RP|قاعدة Rp)$/.test(c.name) && c.image_url).length, n: cat.filter(c => /^(RP|قاعدة Rp)$/.test(c.name)).length };
  }, msg);
  return { r, sel, pg, browser, errs };
}
(async () => {
  await H.seed();
  await H.call('/rest/v1/products', [{ name: 'RP', barcode: 'RP1', price: 5, haleb: 1, image_url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' },
    { name: 'قاعدة Rp', barcode: 'RP2', price: 5, haleb: 1, image_url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }]);
  const MSG = 'انفال\nدرعا الحمامة\nRp';
  // ١) التعرّف يعمل
  let A = await run(`try{localStorage.removeItem('gmt_orders_recog');localStorage.removeItem('gmt_sp_products');localStorage.removeItem('gmt_prod_catalog_v3');}catch(e){}`, MSG);
  ok(/^درعا — خلف دوار الحمامة/.test(A.r.addr) && A.r.name === 'انفال', 'الاسم «انفال» والعنوان «درعا — خلف دوار الحمامة…»');
  ok(!A.r.items.some(x => /الحمامة/.test(x)) && !/الحمامة/.test(A.r.unk), '«الحمامة» جزءٌ من العنوان: ليست منتجاً ولا في «ما تعرّفنا عليهم» — ' + JSON.stringify([A.r.items, A.r.unk]));
  ok(A.r.items.length === 1 && A.r.items[0] === 'RP', '«Rp» عُرف منتجاً: ' + A.r.items.join(','));
  const bad = A.sel.flatMap(s => s.split(',')).filter(c => REAL_COLS.indexOf(c) < 0);
  ok(A.sel.length && !bad.length, 'الكتالوج يطلب أعمدةً موجودةً في القاعدة الحقيقية فقط' + (bad.length ? ' — غير موجود: ' + bad.join(',') : ''));
  ok(A.r.img === A.r.n && A.r.n >= 2, 'الكتالوج يحمل صور المنتجات التي لها صور ('  + A.r.img + '/' + A.r.n + ')');
  // الصورة في قائمة الاقتراحات
  const d = await A.pg.evaluate(async () => { const inp = document.querySelector('#add-items-container [data-field="name"]'); inp.value = 'RP'; await prodSuggest(inp); await new Promise(z => setTimeout(z, 200));
    const box = inp.parentElement.querySelector('[data-field="sug"]'); return { imgs: box.querySelectorAll('img').length, none: (box.innerText.match(/بلا صورة/g) || []).length }; });
  ok(d.imgs >= 1 && d.none === 0, 'قائمة الاقتراحات تُظهر الصور (' + d.imgs + ' صورة · ' + d.none + ' «بلا صورة»)');
  const realA = A.errs.filter(e => !/Failed to load resource/.test(e)); ok(!realA.length, 'لا أخطاء JS ' + realA.slice(0, 2).join(' / '));
  await A.browser.close();
  // ٢) الوضع الحرفي: ما يشبه منتجاً يُكتب كما هو · وما لا يشبه شيئاً يُترك لك
  let B = await run(`try{localStorage.setItem('gmt_orders_recog','off');localStorage.removeItem('gmt_sp_products');}catch(e){}`, 'انفال\nدرعا الحمامة\nRp\nبعد الظهر من فضلكم');
  ok(B.r.items.length === 1 && B.r.items[0] === 'Rp', 'الوضع الحرفي: «Rp» يُكتب بنصّ الزبون كما هو: ' + B.r.items.join(','));
  ok(/بعد الظهر/.test(B.r.unk) && !B.r.items.some(x => /الظهر|الحمامة/.test(x)), 'الوضع الحرفي: سطرٌ لا يشبه منتجاً يُترك لك لا يُضاف منتجاً: ' + JSON.stringify(B.r.unk));
  await B.browser.close();
  // ٣) «#» = منتج قطعاً ولو لم يُعرف في الجرد
  let C = await run(`try{localStorage.removeItem('gmt_orders_recog');localStorage.removeItem('gmt_sp_products');}catch(e){}`, 'انفال\nدرعا الحمامة\n# شيء جديد غير موجود\nRp');
  ok(C.r.items.includes('شيء جديد غير موجود') && C.r.items.includes('RP'), '«#» يُضاف منتجاً كما هو حتى لو لم يُعرف: ' + C.r.items.join(','));
  await C.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
