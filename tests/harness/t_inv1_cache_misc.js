// t_inv1_cache_misc.js — حالاتٌ حدّيّة للفتح الفوري من نسخة الجهاز (وثيقة الطلبات §7)، بـ٣٠٠ منتج:
//  ١) موظّف (بلا أدمن): النسخة المرسومة فوراً تُظهر نفس الأعمدة/الأزرار المعتمة التي تُظهرها البيانات الحيّة (لا تسرّب سعر الشراء)
//  ٢) منتجٌ حُذف من الخادم بين الزيارتين: يختفي بعد وصول الحيّ (النسخة لا تبقى للأبد)
//  ٣) لا نسخة للأعمدة (جهازٌ قديم): السلوك القديم — ستارة التحميل ثم البيانات الحيّة، بلا رسمٍ ناقص
//  ٤) وضع التعديل يعمل على الجدول المرسوم (الطرائق غير الظاهرة لا تُرسم مسبقاً لكنّ وضع التعديل يرسم جدوله بنفسه)
//  ٥) الخادم يردّ فوراً (شبكة سريعة): لا وميض ولا تعارض بين رسم النسخة والبيانات الحيّة — عدد صفوف صحيح
// يعمل على 390 و1366.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./h.js');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; return !!c; };
const N = 300;
const dump = async () => await H.call('/__dump', undefined, 'GET');

async function seed() {
  await H.call('/__reset', {});
  await H.call('/__opts', { reject_cols: [], unique_order_invoice: true, old_rpc_false: false, rls_block: [], no_pos_fn: false, sov: '2003', pos_protected: true, pos_locked: false });
  await H.call('/rest/v1/inv_columns', [['haleb', 'حلب'], ['daraa', 'درعا']].map(([k, n], i) => ({ key_name: k, display_name: n, col_type: 'number', include_in_total: true, is_branch: true, show_form: true, show_table: true, sort_order: i })));
  const rows = Array.from({ length: N }, (_, i) => ({ name: `صنف ${i}`, barcode: `MC${String(i).padStart(4, '0')}`, price: 100 + i, wholesale_price: 80, cost_price: 60, haleb: 5, daraa: i % 3, group_name: i % 2 ? 'كاميرات' : 'إضاءة', category: 'تصوير' }));
  await H.call('/rest/v1/products', rows);
}
async function newCtx(browser, w, init, delay) {
  const mobile = w < 700;
  const ctx = await browser.newContext({ viewport: { width: w, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
  await ctx.route('**/*.supabase.co/**', async route => {
    const u = route.request().url(); const i = u.indexOf('/rest/v1/');
    if (/\/functions\/v1\/gmt-tg\//.test(u)) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"relay":"not_configured"}' });
    if (i < 0) return route.fulfill({ status: 200, body: '{}' });
    try { if (globalThis.__DELAY) await new Promise(r => setTimeout(r, globalThis.__DELAY)); const r = await route.fetch({ url: H.M + u.slice(i) }); await route.fulfill({ response: r }); } catch (e) { try { await route.abort(); } catch (_) {} }
  });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '', headers: { 'Content-Type': 'text/css' } }));
  await ctx.route(/^https:\/\/(?!127)/, r => { const u = r.request().url(); if (/supabase|fonts\./.test(u)) return r.fallback(); r.fulfill({ status: 404, body: '' }); });
  await ctx.addInitScript(init);
  return ctx;
}
async function visit(ctx, errs, settleMs) {
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await pg.goto(H.BASE + 'inventory.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(settleMs);
  return pg;
}
const snapshot = () => ({
  n: (window.allProducts || []).length,
  rows: document.querySelectorAll('#table-body tr[data-id], #list-grid .sl-row').length,
  head: [...document.querySelectorAll('#table-head th')].map(t => t.textContent.trim()).join('|'),
  adminFaded: [...document.querySelectorAll('[data-admin]')].filter(e => getComputedStyle(e).opacity < 1 || getComputedStyle(e).pointerEvents === 'none').length,
  costTxt: /سعر الشراء|الكلفة|التكلفة/.test([...document.querySelectorAll('#table-head th, #stats-bar')].map(e => e.textContent).join(' ')),
  ind: (() => { const e = document.getElementById('inv-refresh-ind'); return e ? { vis: e.offsetParent !== null, txt: e.innerText.trim() } : null; })(),
  overlay: getComputedStyle(document.getElementById('loading-overlay')).display,
  stale: !!window.__invFromCache,
  sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth
});

(async () => {
  for (const w of [390, 1366]) {
    // ═══ ١ + ٢ + ٥: موظّف ═══
    await seed();
    let browser = await chromium.launch();
    let errs = [];
    globalThis.__DELAY = 0;
    let ctx = await newCtx(browser, w, H.STAFF_INIT);
    let pg = await visit(ctx, errs, 2500);            // زيارة أولى: تملأ نسخة الجهاز
    const live1 = await pg.evaluate(snapshot);
    ok(live1.n === N && live1.rows >= 1, `${w} موظّف: الزيارة الأولى تعرض ${live1.rows} صفّاً (${live1.n} منتجاً)`);
    await pg.close();
    // منتجٌ يُحذف من الخادم + شبكةٌ بطيئة كي نلتقط حالة «يتحدّث…»
    const d0 = await dump();
    const gone = d0.products.find(p => p.name === 'صنف 7');
    await H.call('/rest/v1/products?id=eq.' + gone.id, undefined, 'DELETE');
    globalThis.__DELAY = 1500;
    pg = await visit(ctx, errs, 900);
    const early = await pg.evaluate(snapshot);
    console.log(`${w} موظّف مبكراً:`, JSON.stringify({ n: early.n, rows: early.rows, stale: early.stale, ind: early.ind, overlay: early.overlay, adminFaded: early.adminFaded, cost: early.costTxt }));
    ok(early.stale && early.n === N && early.rows >= 1 && early.ind && early.ind.vis && /يتحدّث/.test(early.ind.txt) && early.overlay === 'none', `${w} موظّف: النسخة ظاهرة فوراً (${early.n} منتجاً) مع «يتحدّث…» وبلا ستارة`);
    ok(early.costTxt === false, `${w} موظّف: النسخة المرسومة لا تُظهر سعر الشراء/الكلفة`);
    await pg.waitForFunction(() => !window.__invFromCache, null, { timeout: 30000 }).catch(() => {});
    await pg.waitForTimeout(600);
    const late = await pg.evaluate(snapshot);
    console.log(`${w} موظّف بعد الحيّ:`, JSON.stringify({ n: late.n, rows: late.rows, stale: late.stale, ind: late.ind, adminFaded: late.adminFaded }));
    ok(late.n === N - 1 && !late.stale && late.ind && !late.ind.vis, `${w} موظّف: بعد وصول الخادم اختفى المنتج المحذوف (${late.n} من ${N}) واختفى المؤشّر`);
    ok(late.head === early.head && late.adminFaded === early.adminFaded && late.costTxt === false, `${w} موظّف: الأعمدة وأزرار الأدمن المعتمة هي نفسها في النسخة وفي الحيّ`);
    ok(late.sw <= late.cw + 1 && early.sw <= early.cw + 1, `${w} موظّف: لا طفح أفقي`);
    await pg.close(); await browser.close();

    // ═══ ٣: لا نسخة للأعمدة ⇒ السلوك القديم ═══
    await seed();
    browser = await chromium.launch(); errs = [];
    globalThis.__DELAY = 0;
    ctx = await newCtx(browser, w, H.ADMIN_INIT);
    pg = await visit(ctx, errs, 2500);
    await pg.evaluate(() => new Promise(res => { const rq = indexedDB.open('gmt_cache_db'); rq.onsuccess = () => { const db = rq.result; const tx = db.transaction('gmt_collections', 'readwrite'); tx.objectStore('gmt_collections').delete('col_inv_inv_columns'); tx.oncomplete = () => { db.close(); res(); }; }; }));
    await pg.close();
    globalThis.__DELAY = 1200;
    pg = await visit(ctx, errs, 700);
    const noCols = await pg.evaluate(snapshot);
    console.log(`${w} بلا نسخة أعمدة:`, JSON.stringify({ n: noCols.n, rows: noCols.rows, stale: noCols.stale, ind: noCols.ind, overlay: noCols.overlay }));
    ok(!noCols.stale && noCols.rows === 0 && noCols.overlay !== 'none', `${w}: نسخة أعمدة غائبة ⇒ لا رسمٌ ناقص: ستارة التحميل كما كانت (لا صفوف قبل البيانات الحيّة)`);
    await pg.waitForFunction(() => (window.allProducts || []).length >= 300 && document.querySelectorAll('#table-body tr[data-id], #list-grid .sl-row').length >= 300, null, { timeout: 30000 }).catch(() => {});
    const noCols2 = await pg.evaluate(snapshot);
    ok(noCols2.n === N && noCols2.rows === N && noCols2.overlay === 'none', `${w}: ثم تظهر الصفوف الحيّة كاملةً (${noCols2.rows})`);
    await pg.close(); await browser.close();

    // ═══ ٤ + ٥: وضع التعديل (كمبيوتر) + شبكة سريعة ═══
    await seed();
    browser = await chromium.launch(); errs = [];
    globalThis.__DELAY = 0;
    ctx = await newCtx(browser, w, H.ADMIN_INIT);
    pg = await visit(ctx, errs, 2200);
    await pg.close();
    pg = await visit(ctx, errs, 2800);                  // شبكة سريعة: النسخة والحيّ يتقاطعان
    const fast = await pg.evaluate(snapshot);
    ok(fast.n === N && fast.rows === N && !fast.stale && fast.ind && !fast.ind.vis, `${w}: شبكة سريعة: ${fast.rows} صفّاً بلا تكرارٍ ولا مؤشّر عالق`);
    if (w >= 700) {
      await pg.evaluate(() => toggleEditMode());
      await pg.waitForTimeout(500);
      const ed = await pg.evaluate(() => ({ on: editModeActive, rows: document.querySelectorAll('#table-body tr[data-id]').length, cls: document.getElementById('table-wrap').classList.contains('edit-mode-active'), vis: document.getElementById('table-wrap').getBoundingClientRect().height > 100, cells: (typeof editModeCells !== 'undefined') ? editModeCells.length : -1 }));
      ok(ed.on && ed.rows === N && ed.cls && ed.vis && ed.cells > 0, `${w}: وضع التعديل يعمل على الجدول (${ed.rows} صفّاً · ${ed.cells} خليّة قابلة للتعديل)`);
      await pg.evaluate(() => toggleEditMode());
      await pg.waitForTimeout(300);
      // التبديل بين الطرائق يرسم الجديدة بكاملها ثم يعود
      await pg.evaluate(() => setView('list', null)); await pg.waitForTimeout(400);
      const l = await pg.evaluate(() => ({ list: document.querySelectorAll('#list-grid .sl-row').length, tableHidden: getComputedStyle(document.getElementById('table-wrap')).display === 'none' }));
      ok(l.list === N && l.tableHidden, `${w}: عرض «القائمة» على الكمبيوتر يرسم ${l.list} صفّاً ويُخفي الجدول`);
      await pg.evaluate(() => setView('table', null)); await pg.waitForTimeout(400);
    }
    console.log(`${w} أخطاء:`, errs.filter(e => !/404|400|Failed|favicon|ERR_/.test(e)).slice(0, 4));
    ok(errs.filter(e => !/404|400|Failed|favicon|ERR_/.test(e)).length === 0, `${w}: لا أخطاء JS`);
    await pg.close(); await browser.close();
  }
})();
