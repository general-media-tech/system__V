// t_inv1_recount_speed.js — «كثير عم بيطول» (وثيقة الطلبات §1): زمن إكمال فاتورة نقل ناقصة بـ ٢٤ بنداً على شبكةٍ بطيئة (١٥٠ms لكل طلب)
//   الطريقة القديمة: «أعِد المحاولة لكل الأصناف الناقصة» (stFillAll: بندٌ بندٌ، ~١٠ طلبات لكل بند)
//   الجديدة: «إعادة العدّ» ← «انقل المتاح/ارفع وأكمل» (قراءة متوازية + تنفيذ على ٤ مسارات + رأس الفاتورة مرّة)
// ويتحقّق أن النتيجة واحدة بالأرقام (نفس المخزون ونفس البنود) — السرعة لا تأتي على حساب الصحّة.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./h.js');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; return !!c; };
const N = Number(process.env.N_ITEMS || 24), DELAY = Number(process.env.NET_DELAY || 150);
const dump = async () => await H.call('/__dump', undefined, 'GET');

async function seed() {
  await H.call('/__reset', {});
  await H.call('/__opts', { reject_cols: [], unique_order_invoice: true, old_rpc_false: false, rls_block: [], no_pos_fn: false, sov: '2003', pos_protected: true, pos_locked: false });
  await H.call('/rest/v1/inv_columns', [['haleb', 'حلب'], ['daraa', 'درعا']].map(([k, n], i) => ({ key_name: k, display_name: n, col_type: 'number', include_in_total: true, is_branch: true, show_form: true, show_table: true, sort_order: i })));
  const P = await H.call('/rest/v1/products', Array.from({ length: N }, (_, i) => ({ name: 'سريع ' + i, barcode: 'SQ' + i, price: 10, haleb: 5, daraa: 0, in_transit: {} })));
  const T = await H.call('/rest/v1/branch_stock_transfers', [{ transfer_number: 'SPD-1', from_branch: 'haleb', from_branch_name: 'حلب', to_branch: 'daraa', to_branch_name: 'درعا', status: 'needs_settlement', note: 'x', settled: false, created_at: '2026-10-01T00:00:00Z' }]);
  await H.call('/rest/v1/stock_transfer_items', P.map(p => ({ transfer_id: T[0].id, product_id: p.id, product_name: p.name, qty: 0, requested_qty: 2, waived_qty: 0, deduction_failed: true })));
  return { P, T };
}
async function run(label, fn) {
  const { P, T } = await seed();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' });
  let reqs = 0;
  await ctx.route('**/*.supabase.co/**', async route => {
    const u = route.request().url(); const i = u.indexOf('/rest/v1/');
    if (/\/functions\/v1\/gmt-tg\//.test(u)) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' });
    if (i < 0) return route.fulfill({ status: 200, body: '{}' });
    try { reqs++; await new Promise(r => setTimeout(r, window_delay())); const r = await route.fetch({ url: H.M + u.slice(i) }); await route.fulfill({ response: r }); } catch (e) { try { await route.abort(); } catch (_) {} }
  });
  function window_delay() { return DELAY; }
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '', headers: { 'Content-Type': 'text/css' } }));
  await ctx.route(/^https:\/\/(?!127)/, r => { const u = r.request().url(); if (/supabase|fonts\./.test(u)) return r.fallback(); r.fulfill({ status: 404, body: '' }); });
  await ctx.addInitScript(H.ADMIN_INIT);
  const pg = await ctx.newPage();
  await pg.goto(H.BASE + 'inventory.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(6000);
  await pg.evaluate(() => { switchAppMode('transfer'); window.GMTAsk.alert = async () => true; window.GMTAsk.prompt = async (m, o) => (o && o.value) || 'x'; });
  reqs = 0;
  const t0 = Date.now();
  await pg.evaluate(fn, String(T[0].id));
  const ms = Date.now() - t0, n = reqs;
  const d = await dump();
  const res = { ms, reqs: n, haleb: d.products.map(p => p.haleb).join(), qty: d.stock_transfer_items.map(i => i.qty).join(), status: d.branch_stock_transfers[0].status };
  await browser.close();
  console.log(label.padEnd(8), JSON.stringify(res));
  return res;
}
(async () => {
  console.log(`N=${N} بنداً · ${DELAY}ms لكل طلب`);
  const old = await run('القديمة', async (tid) => { await stFillAll(tid); });
  const neu = await run('الجديدة', async () => { const r = await stRecountApply('avail'); if (!r.ok) throw new Error('failed ' + JSON.stringify(r)); });
  ok(old.haleb === neu.haleb && old.qty === neu.qty && old.status === neu.status, 'النتيجة واحدة بالأرقام: مخزون حلب ' + neu.haleb.split(',')[0] + '… وكل بند qty=2 والفاتورة ' + neu.status);
  ok(neu.haleb === Array(N).fill(3).join() && neu.qty === Array(N).fill(2).join() && neu.status === 'pending', 'كل مخزونٍ 5→3 بالضبط وكل بند 2 والفاتورة «في الطريق»');
  ok(neu.ms < old.ms / 2, `الجديدة أسرع بأكثر من الضعف: ${neu.ms}ms مقابل ${old.ms}ms (طلبات ${neu.reqs} مقابل ${old.reqs})`);
  console.log(`SPEED old=${old.ms}ms new=${neu.ms}ms ratio=${(old.ms / neu.ms).toFixed(1)}x`);
})();
