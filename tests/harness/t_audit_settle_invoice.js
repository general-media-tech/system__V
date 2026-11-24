// (seq B1052) زرّ «🧾 إنشاء فاتورة تسوية» بلوحة التدقيق: كان يكتب عموداً غير موجود (`notes`) بنوعٍ غير معروف («شراء فوري») ⇒ يفشل 400 بالقاعدة
//   (المحاكي لا يعرف أعمدة import_log فلم يُكشف). الآن: كلّ مفتاحٍ يُرسَل موجودٌ فعلاً بالجدول · النوع instant · لا يُضيف مخزوناً (transferred)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const COLS = 'id,inv_number,inv_type,supplier,supplier_inv,inv_date,eta_date,shipping_company,tracking_number,shipping_notes,invoice_file_url,source_branch,dest_branch,status,arrived_at,total_amount,items_count,total_qty,items_snapshot,created_at,supplier_phone,supplier_address,supplier_contact,currency,sector,cost_transport,cost_shipping,cost_customs,cost_local,cash_payment,updated_at,costs_paid,transferred,transferred_at,transferred_by,transfer_moved,unseal_reason,unsealed_at,cost_transfer'.split(',');   // أعمدة import_log الحيّة (٢٠٢٦-١١-٢٤)
(async () => {
  await H.seed();
  await H.call('/rest/v1/products', [{ name: 'يتيم للتسوية', barcode: 'ST01', haleb: 4, cost_price: 3, price: 9 }]);
  const { browser, pg } = await H.open('inventory.html?audit=1', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 8000 });
  let body = null; pg.on('request', r => { if (r.method() === 'POST' && /\/rest\/v1\/import_log/.test(r.url())) { try { body = JSON.parse(r.postData()); } catch (_) {} } });
  pg.on('dialog', d => d.accept());
  await pg.waitForSelector('#intg-body details[data-intg-prod]', { timeout: 15000 }).catch(() => {});
  await pg.evaluate(async () => { window.GMTAsk = null; window.confirm = () => true; await GMTIntegrity.fixOrphanProducts(); }).catch(e => console.log('err', e.message));
  await pg.waitForTimeout(1200); await browser.close();
  const keys = body ? Object.keys(body) : [];
  ok(!!body, 'أُرسل إنشاء الفاتورة');
  ok(keys.length && keys.every(k => COLS.includes(k)), 'كلّ الحقول أعمدةٌ موجودة بالجدول: ' + keys.filter(k => !COLS.includes(k)).join(',') );
  ok(body && body.inv_type === 'instant' && body.transferred === true && body.items_snapshot && (body.items_snapshot.find(i => i.name === 'يتيم للتسوية') || {}).qty === 4, 'نوع instant · مرحّلة مسبقاً (لا تُضيف مخزوناً) · الكمية الفعلية 4');
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
