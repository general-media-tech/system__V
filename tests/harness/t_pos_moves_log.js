// (TASK-B0375 · المالك seq B657) «بنقاط البيع ما في سجل استلام ودخول وخروج مع الفواتير — فواتير التسوية وفواتير النقل»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const iso = d => new Date(Date.now() - d * 3600e3).toISOString();
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [{ name: 'هود ET-86', barcode: 'MV1', price: 25, daraa: 5 }, { name: 'كفر سيليكون EOS R50', barcode: 'MV2', price: 15, daraa: 2 }]);
  const T = await H.call('/rest/v1/branch_stock_transfers', [
    { transfer_number: 'TRF-1', from_branch: 'haleb', from_branch_name: 'حلب', to_branch: 'daraa', to_branch_name: 'درعا', status: 'received', created_at: iso(30), received_at: iso(29), received_by: 'سامر', created_by: 'أحمد' },
    { transfer_number: 'TRF-2', from_branch: 'daraa', from_branch_name: 'درعا', to_branch: 'homs', to_branch_name: 'حمص', status: 'pending', created_at: iso(20), created_by: 'سامر' },
    { transfer_number: 'TRF-3', from_branch: 'rebuild', from_branch_name: 'إعادة إنشاء', to_branch: 'daraa', to_branch_name: 'درعا', status: 'pending', created_at: iso(10), title: 'فاتورة تسوية — جرد درعا' },
    { transfer_number: 'TRF-4', from_branch: 'haleb', to_branch: 'homs', status: 'received', created_at: iso(9) },
    { transfer_number: 'TRF-5', from_branch: 'haleb', to_branch: 'daraa', status: 'cancelled', created_at: iso(8) }]);
  await H.call('/rest/v1/stock_transfer_items', [
    { transfer_id: T[0].id, product_id: A.id, product_name: 'هود ET-86', qty: 4 }, { transfer_id: T[0].id, product_id: B.id, product_name: 'كفر سيليكون EOS R50', qty: 3 },
    { transfer_id: T[1].id, product_id: A.id, product_name: 'هود ET-86', qty: 1 }, { transfer_id: T[2].id, product_id: B.id, product_name: 'كفر سيليكون EOS R50', qty: 8 },
    { transfer_id: T[3].id, product_id: A.id, product_name: 'هود ET-86', qty: 9 }, { transfer_id: T[4].id, product_id: A.id, product_name: 'هود ET-86', qty: 7 }]);
  await H.call('/rest/v1/stock_receipts', [{ import_id: 'IMP-9', product_id: B.id, branch_key: 'daraa', qty: 6, kind: 'import', created_at: iso(40) }]);
  const I = await H.call('/rest/v1/invoices', [{ inv_number: 'D-11', branch_key: 'daraa', total: 25, sale_type: 'نقدي', customer_name: 'زبون', cashier_name: 'سامر', created_at: iso(5) },
    { inv_number: 'D-12', branch_key: 'daraa', total: -25, sale_type: 'مرتجع', is_refund: true, customer_name: 'زبون', created_at: iso(4) }]);
  await H.call('/rest/v1/invoice_items', [{ invoice_id: I[0].id, product_id: A.id, product_name: 'هود ET-86', qty: 1, unit_price: 25 }, { invoice_id: I[1].id, product_id: A.id, product_name: 'هود ET-86', qty: -1, unit_price: 25 }]);
  const o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 }); const pg = o.pg;
  ok(await pg.evaluate(() => !!document.getElementById('moves-btn')), 'زرّ «📒 سجل الحركة» في رأس نقطة البيع');
  await pg.click('#moves-btn'); await sleep(2500);
  const st = () => pg.evaluate(() => ({ docs: [...document.querySelectorAll('#mv-body .mv-doc summary b')].map(b => b.textContent.trim()), sum: document.getElementById('mv-sum').innerText.replace(/\s+/g, ' ') }));
  let s = await st();
  ok(s.docs.length === 6, 'ستّة مستندات لدرعا (نقل وارد · نقل صادر · تسوية · استلام مشتريات · مبيع · مرتجع) — لا نقل الفروع الأخرى ولا الملغى: ' + s.docs.join(' | '));
  ok(/^مرتجع · D-12/.test(s.docs[0]) && s.docs.some(d => /^تسوية \(إضافة\) · TRF-3.*بانتظار الاستلام/.test(d)) && s.docs.some(d => /^نقل صادر · TRF-2/.test(d)) && s.docs.some(d => /^نقل وارد · TRF-1/.test(d)) && s.docs.some(d => /^استلام مشتريات · IMP-9/.test(d)) && s.docs.some(d => /^مبيع · D-11/.test(d)), 'الأحدث أوّلاً · فاتورة التسوية ظاهرة «بانتظار الاستلام»');
  ok(/داخل \+14/.test(s.sum) && /خارج −2/.test(s.sum), 'المجموع: داخل +14 (7 نقل + 6 مشتريات + 1 مرتجع · التسوية المعلّقة لا تُحسب) · خارج −2: ' + s.sum);
  await pg.click('#mv-ov .mv-chips button[data-f="adj"]'); s = await st();
  ok(s.docs.length === 1 && /تسوية/.test(s.docs[0]), 'فلتر «تسوية» ⇒ فاتورة التسوية وحدها');
  await pg.click('#mv-ov .mv-chips button[data-f="all"]'); await pg.fill('#mv-q', 'R50'); await sleep(300);
  const r = await pg.evaluate(() => [...document.querySelectorAll('#mv-body .mv-t tr')].map(t => t.innerText.replace(/\s+/g, ' ')));
  ok(r.length === 3 && r.every(x => /R50/.test(x)), 'البحث «R50» ⇒ حركاته وحدها (نقل +3 · تسوية +8 · مشتريات +6): ' + r.join(' | '));
  await pg.fill('#mv-q', 'MV1'); await sleep(300);
  const nb = await pg.evaluate(() => [...document.querySelectorAll('#mv-body .mv-doc summary b')].map(b => b.textContent.trim()));
  ok(nb.length === 4, 'البحث بالباركود يعمل أيضاً: ' + nb.join(' | '));
  const real = o.errs.filter(x => !/status of (400|401|404|406|409|503)|Failed to load resource/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
