// (TASK-A0535 · المالك seq 913) «ما عم بيحملوا المنتجات فعم تروح الفاتورة للطباعة وفي بنود ناقصة»
// الطباعة التلقائية كانت بعد 500ms ثابتة ⇒ الآن تنتظر كلّ الصور (تحميلاً أو فشلاً) والخطوط بسقف 12ث.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext();
  const pg = await ctx.newPage();
  await pg.route('http://127.0.0.1:8765/__blank', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await pg.goto('http://127.0.0.1:8765/__blank');
  await pg.addScriptTag({ content: fs.readFileSync(__dirname + '/../../gmt-transfer-print.js', 'utf8') });
  const N = 42;
  const html = await pg.evaluate(async (N) => { let buf = ''; window.open = () => ({ document: { write: s => buf += s, open: () => buf = '', close() {} }, closed: false, close() {} });
    const items = Array.from({ length: N }, (_, i) => ({ product_id: 'p' + i, product_name: 'منتج ' + (i + 1), barcode: '12345678' + String(i).padStart(4, '0'), image_url: 'http://127.0.0.1:8765/__slow/' + i + '.png', qty: 1, unit_cost: 1, sale_price: 2 }));
    await GMTTransferPrint.print({ id: 't', transfer_number: 'TRF-T', created_at: '2026-11-21T10:00:00Z', status: 'pending', from_branch_name: 'أ', to_branch_name: 'ب' }, { fetchItems: async () => items }); return buf; }, N);
  ok(/__gmtPrintReady/.test(html) && !/setTimeout\(function\(\)\{ window\.print\(\); \}, 500\)/.test(html), 'نافذة فاتورة النقل تطبع عبر __gmtPrintReady لا بعد 500ms ثابتة');
  // صور بطيئة (3ث): الطباعة لا تبدأ قبل اكتمالها
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  const p2 = await ctx.newPage();
  await p2.route('http://127.0.0.1:8765/__slow/**', async r => { await new Promise(x => setTimeout(x, 3000)); r.fulfill({ contentType: 'image/png', body: png }); });
  await p2.route('http://127.0.0.1:8765/__inv', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html.replace('<head>', '<head><base href="http://127.0.0.1:8765/">') }));
  await p2.addInitScript(() => { window.__t0 = Date.now(); window.print = () => { window.__printed = { at: Date.now() - window.__t0, done: [].filter.call(document.images, i => i.complete).length, all: document.images.length, rows: document.querySelectorAll('#inv-items-tbl tbody tr').length }; }; });
  await p2.goto('http://127.0.0.1:8765/__inv', { waitUntil: 'domcontentloaded' });
  await p2.waitForFunction(() => window.__printed, null, { timeout: 20000 });
  const pr = await p2.evaluate(() => window.__printed);
  ok(pr.at >= 2900 && pr.done === pr.all, 'الطباعة انتظرت الصور البطيئة (بعد ' + pr.at + 'ms · ' + pr.done + '/' + pr.all + ' صورة مكتملة)');
  ok(pr.rows === N, 'كلّ البنود موجودة لحظة الطباعة: ' + pr.rows + '/' + N);
  // صورة لا تصل أبداً ⇒ لا تعلق: السقف 12ث
  const p3 = await ctx.newPage();
  await p3.route('http://127.0.0.1:8765/__slow/**', () => {});   // لا ردّ
  await p3.route('http://127.0.0.1:8765/__inv', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html.replace('<head>', '<head><base href="http://127.0.0.1:8765/">') }));
  await p3.addInitScript(() => { window.__t0 = Date.now(); window.print = () => { window.__printed = Date.now() - window.__t0; }; });
  await p3.goto('http://127.0.0.1:8765/__inv', { waitUntil: 'domcontentloaded' });
  await p3.waitForFunction(() => window.__printed, null, { timeout: 20000 });
  const t3 = await p3.evaluate(() => window.__printed);
  ok(t3 >= 11500 && t3 < 14000, 'صورةٌ لا تصل ⇒ الطباعة لا تعلق (تبدأ بعد ' + t3 + 'ms ≈ السقف 12ث)');
  // القالب الموحّد لفواتير البيع وصفحات أخرى: لا 500ms ثابتة
  const src = ['gmt-invoice-tpl.js', 'admin_pos.html', 'store.html', 'inventory.html'].map(f => fs.readFileSync(__dirname + '/../../' + f, 'utf8')).join('\n');
  ok(!/setTimeout\(function\(\)\{window\.print\(\)\},500\)/.test(src) && !/setTimeout\(function\(\)\{window\.print\(\);\},600\)/.test(src), 'فواتير البيع · تقرير الشهر · فاتورة المتجر · ملصقات الجرد: لا طباعة بمهلة ثابتة');
  await b.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
