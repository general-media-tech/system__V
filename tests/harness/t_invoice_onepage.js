// (TASK-B0413 · المالك seq 727) «ما لازم تنقسم الفاتورة أبداً إلى صفحتين» + «البكج لما يظهر بالفاتورة يظهر كمجموعة منتجات — حتى للزبون داخل المتجر»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const pages = buf => (buf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
const st = { categories: [{ id: 'c0', name: 'قسم', order: 0 }], banners: [], offers: [], branches: [], products: [{ id: 'x1', name: 'منتج', price: 10, category_id: 'c0' }] };
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  const o = await H.open('logo.jpg', { init: `try{localStorage.clear();localStorage.setItem('gmt_intro_seen_build','x')}catch(e){}`, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(4500);
  const mk = n => ({ ref: 'ORD-1', name: 'زبون', phone: '0931', address: 'دمشق', notes: '', payment: 'cod', delivery: 1, subtotal: n * 10, total: n * 10 + 1, items: Array.from({ length: n }, (_, i) => ({ name: 'منتج رقم ' + (i + 1) + ' باسمٍ طويل نسبياً لاختبار الالتفاف', qty: 1 + (i % 3), price: 10 })) });
  for (const n of [3, 11, 22]) {
    const html = await o.pg.evaluate(a => GMTInvoiceTpl.storeHTML(a), mk(n));
    const pg = await o.ctx.newPage(); await pg.setContent(html, { waitUntil: 'load' }); await pg.waitForTimeout(600);
    const buf = await pg.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    const z = await pg.evaluate(() => ({ zoom: document.querySelector('.invoice').style.zoom || '1', rows: document.querySelectorAll('.items tbody tr').length }));
    ok(pages(buf) === 1, `① فاتورة بـ${n} بنداً ⇒ صفحة PDF واحدة (zoom ${z.zoom}) · صفحات=${pages(buf)}`);
    await pg.close();
  }
  // ② فاتورة الزبون داخل المتجر: الباقة مجموعة منتجات
  await o.pg.evaluate(() => { window.__t = null; });
  const r = await o.pg.evaluate(() => { showInvoice({ orderId: 'T1', name: 'زبون', phone: '09', address: 'ع', notes: '', payment: 'cod',
      items: [{ name: 'كفر', qty: 1, price: 25 }, { name: '📦 بكج الاختبار', qty: 1, price: 200, package_items: [{ id: 'a', name: 'قطعة أ', qty: 1, price: 125 }, { id: 'b', name: 'قطعة ب', qty: 1, price: 80 }] }], subtotal: 225, total: 226 });
    const h = window.__storeInvoiceHTML || ''; const rows = (h.match(/<tr><td[^>]*>\d+<\/td><td>[^<]*<\/td>/g) || []).map(x => x.replace(/<[^>]+>/g, ' ').trim());
    return { rows, hasGroup: /ضمن/.test(h), onePackageLine: /بكج الاختبار<\/td>/.test(h) }; });
  ok(r.rows.length === 3 && r.hasGroup && !r.onePackageLine, '② فاتورة الزبون: الباقة تظهر كقطعها (٣ أسطر = كفر + قطعتا الباقة) لا كسطرٍ واحد ' + JSON.stringify(r.rows));
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
