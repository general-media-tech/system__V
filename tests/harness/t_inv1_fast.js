// t_inv1_fast.js — «الجرد أوّل ما بفتحه كثير عم بيطول … يبدو في الأول فارغاً» (وثيقة الطلبات §7)
// يقيس زمن ظهور أوّل صفّ منتج بـ٢٠٠٠ منتج وشبكةٍ بطيئة مصطنعة (تأخير لكل طلب + تأخير بحجم الردّ):
//   الزيارة ١ (جهاز جديد بلا كاش) · الزيارة ٢ (نفس الجهاز — كاش IndexedDB) — على 390 و1366.
// ويتحقّق: مؤشّر «يتحدّث…» ظاهر أثناء التحديث ويختفي بعده · البيانات الحيّة تحلّ محلّ المحفوظة · لا طفح أفقي ·
// والكتابة على المنتجات ممنوعة برسالة واضحة ما دامت البيانات من الجهاز (لا تُكتب قيمةٌ قديمة فوق أحدث).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./h.js');
const OUT = process.env.OUT_DIR || '/tmp';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; return !!c; };
const N = Number(process.env.N_PRODUCTS || 2000);
const BASE_DELAY = Number(process.env.NET_DELAY || 350);      // ms لكل طلب (شبكة سورية بطيئة)
const PER_KB = Number(process.env.NET_PER_KB || 2);           // ms لكل KB من الردّ (باقة ضعيفة)

async function seed() {
  await H.call('/__reset', {});
  await H.call('/__opts', { reject_cols: [], unique_order_invoice: true, old_rpc_false: false, rls_block: [], no_pos_fn: false, sov: '2003', pos_protected: true, pos_locked: false });
  await H.call('/rest/v1/inv_columns', [['haleb', 'حلب'], ['daraa', 'درعا'], ['homs', 'حمص']].map(([k, n], i) => ({ key_name: k, display_name: n, col_type: 'number', include_in_total: true, is_branch: true, show_form: true, show_table: true, sort_order: i })));
  const rows = Array.from({ length: N }, (_, i) => ({ name: `منتج سرعة ${i}`, barcode: `SP${String(i).padStart(5, '0')}`, price: 100 + (i % 50), wholesale_price: 80, cost_price: 60, haleb: 5, daraa: i % 3, homs: 1, group_name: i % 2 ? 'كاميرات' : 'إضاءة', category: 'تصوير', short: 'وصف قصير للمنتج رقم ' + i + ' — عدسة وإضاءة وحامل' }));
  for (let k = 0; k < rows.length; k += 500) await H.call('/rest/v1/products', rows.slice(k, k + 500));
}

async function newCtx(browser, w) {
  const mobile = w < 700;
  const ctx = await browser.newContext({ viewport: { width: w, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
  const errs = [];
  await ctx.route('**/*.supabase.co/**', async route => {
    const u = route.request().url(); const i = u.indexOf('/rest/v1/');
    if (/\/functions\/v1\/gmt-tg\//.test(u)) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"relay":"not_configured"}' });
    if (i < 0) return route.fulfill({ status: 200, body: '{}' });
    try {
      await new Promise(r => setTimeout(r, BASE_DELAY));
      const r = await route.fetch({ url: H.M + u.slice(i) });
      const body = await r.body();
      await new Promise(r2 => setTimeout(r2, Math.round(body.length / 1024 * PER_KB)));
      await route.fulfill({ response: r, body });
    } catch (e) { try { await route.abort(); } catch (_) {} }
  });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '', headers: { 'Content-Type': 'text/css' } }));
  await ctx.route(/^https:\/\/(?!127)/, r => { const u = r.request().url(); if (/supabase|fonts\./.test(u)) return r.fallback(); r.fulfill({ status: 404, body: '' }); });
  await ctx.addInitScript(H.ADMIN_INIT);
  /* يسجّل لحظة ظهور أوّل صفّ منتج (جدول/بطاقات/قائمة) ولحظة ظهور الصفوف الحيّة (أسماء بعد تعديل الخادم) */
  await ctx.addInitScript(() => {
    const t0 = performance.now();
    const mark = () => {
      if (window.__firstRowAt == null && document.querySelector('#table-body tr[data-id], #cards-grid [data-id], #list-grid [data-id]')) window.__firstRowAt = performance.now() - t0;
      if (window.__liveRowAt == null && document.body && /منتج سرعة 0 \(حيّ\)/.test(document.body.innerText || '')) window.__liveRowAt = performance.now() - t0;
      if (window.__indOnAt == null && (() => { const e = document.getElementById('inv-refresh-ind'); return e && e.offsetParent !== null; })()) window.__indOnAt = performance.now() - t0;
    };
    const iv = setInterval(mark, 25); setTimeout(() => clearInterval(iv), 60000);
  });
  return { ctx, errs };
}

async function visit(ctx, errs, label, w) {
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await pg.goto(H.BASE + 'inventory.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.__firstRowAt != null, null, { timeout: 60000 }).catch(() => {});
  const first = await pg.evaluate(() => window.__firstRowAt);
  return { pg, first };
}

(async () => {
  console.log(`N=${N} منتج · تأخير ${BASE_DELAY}ms/طلب + ${PER_KB}ms/KB`);
  for (const w of [390, 1366]) {
    await seed();
    const browser = await chromium.launch();
    const { ctx, errs } = await newCtx(browser, w);
    // ── الزيارة ١: جهاز بلا كاش ──
    const v1 = await visit(ctx, errs, 'cold', w);
    await v1.pg.waitForTimeout(1500);
    const n1 = await v1.pg.evaluate(() => (window.allProducts || []).length);
    console.log(`${w} زيارة١ (بلا كاش): أوّل صفّ بعد ${Math.round(v1.first)}ms · منتجات ${n1}`);
    ok(n1 === N, `${w}: الزيارة الأولى حمّلت ${N} منتج`);
    await v1.pg.close();
    // تغيير على الخادم بين الزيارتين: البيانات الحيّة يجب أن تحلّ محلّ المحفوظة
    const all = await H.call('/__dump', undefined, 'GET');
    const p0 = all.products.find(p => p.name === 'منتج سرعة 0');
    await H.call('/rest/v1/products?id=eq.' + p0.id, { name: 'منتج سرعة 0 (حيّ)', haleb: 9 }, 'PATCH');
    // ── الزيارة ٢: نفس الجهاز ──
    const v2 = await visit(ctx, errs, 'warm', w);
    const pg = v2.pg;
    const early = await pg.evaluate(() => ({
      n: (window.allProducts || []).length,
      ind: (() => { const e = document.getElementById('inv-refresh-ind'); return e ? { vis: e.offsetParent !== null, txt: e.innerText.trim() } : null; })(),
      overlay: getComputedStyle(document.getElementById('loading-overlay')).display,
      stale: !!window.__invFromCache
    }));
    console.log(`${w} زيارة٢ (كاش الجهاز): أوّل صفّ بعد ${Math.round(v2.first)}ms · فوراً: ${JSON.stringify(early)}`);
    ok(v2.first < v1.first / 2, `${w}: الزيارة الثانية تعرض البيانات أسرع بكثير (${Math.round(v2.first)}ms مقابل ${Math.round(v1.first)}ms)`);
    ok(early.n >= N - 1 && early.ind && early.ind.vis && /يتحدّث/.test(early.ind.txt), `${w}: البيانات المحفوظة ظاهرة فوراً ومعها مؤشّر «يتحدّث…»`);
    ok(early.overlay === 'none', `${w}: لا ستارة تحميل تغطّي الشاشة حين توجد بيانات محفوظة`);
    // الكتابة أثناء العرض من الجهاز: ممنوعة برسالة (لا تُكتب قيمة قديمة فوق أحدث)
    if (early.stale) {
      const blocked = await pg.evaluate(() => { const r = (typeof invStaleBlock === 'function') ? invStaleBlock('تجربة') : false; const t = [...document.querySelectorAll('#toast-container .toast')].map(x => x.innerText).join(' | '); return { r, t }; });
      ok(blocked.r === true && /يتحدّث/.test(blocked.t), `${w}: محاولة تعديل أثناء «يتحدّث…» تُمنع برسالة واضحة`);
    }
    await pg.screenshot({ path: `${OUT}/inv1_fast_${w}_cached.png` });
    // انتظار التحديث من الخادم
    await pg.waitForFunction(() => !window.__invFromCache && window.__liveRowAt != null, null, { timeout: 60000 }).catch(() => {});
    await pg.waitForTimeout(300);
    const after = await pg.evaluate(() => ({
      live: window.__liveRowAt, stale: !!window.__invFromCache,
      ind: (() => { const e = document.getElementById('inv-refresh-ind'); return e ? e.offsetParent !== null : false; })(),
      haleb0: ((window.allProducts || []).find(p => p.name === 'منتج سرعة 0 (حيّ)') || {}).haleb,
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      blocked: (typeof invStaleBlock === 'function') ? invStaleBlock('تجربة') : null
    }));
    console.log(`${w} بعد التحديث: ${JSON.stringify(after)}`);
    ok(!after.stale && !after.ind && after.haleb0 === 9, `${w}: بعد وصول الخادم: البيانات الحيّة (الاسم والكمية الجديدة 9) والمؤشّر اختفى`);
    ok(after.blocked === false, `${w}: بعد التحديث تعود الكتابة مسموحة`);
    ok(after.sw <= after.cw + 1, `${w}: لا طفح أفقي`);
    await pg.screenshot({ path: `${OUT}/inv1_fast_${w}_live.png` });
    console.log(`${w} الأخطاء:`, errs.filter(e => !/404|400|Failed|favicon|ERR_/.test(e)).slice(0, 5));
    await browser.close();
  }
})();
