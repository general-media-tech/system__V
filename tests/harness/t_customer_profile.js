// (TASK-0242 · المالك seq 164) «ملف العميل لازم يطلع عندي اوردرات وكل اوردر اكبس عليه يعطيني الفاتوره تبعيت الاوردر او الملصق تبع الاوردر ·
// اذا مرتبط بفاتوره فيعطيني الفاتوره · ممكن يعطينا ايضا ايصال شحن · ايضا شو اشترى من عندنا ومين ادخله انا مستخدم او اي نقطه تبيع»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [inv] = await H.call('/rest/v1/invoices', [{ inv_number: 'INV-501', branch_key: 'haleb', branch_name: 'حلب', total: 150, items_count: 2, customer_name: 'نور', customer_phone: '0933900001', created_at: '2026-10-20T10:00:00Z', sale_type: 'نقدي', cashier_name: 'سامر', paid_amount: 150, remaining_amount: 0 }]);
  await H.call('/rest/v1/invoice_items', [{ invoice_id: inv.id, product_name: 'عدسة كانون 50', qty: 1, unit_price: 120, total: 120 }, { invoice_id: inv.id, product_name: 'فلتر UV', qty: 1, unit_price: 30, total: 30 }]);
  const [o1, o2] = await H.call('/rest/v1/gmt_orders', [
    { name: 'نور', phone: '0933900001', product: 'حامل ثلاثي', qty: 1, price: 40, status: 'completed', serial_code: 'ORD-71', shipping_company: 'المفتي', tracking_number: '400001', entered_by: 'ريم', created_at: '2026-10-22T10:00:00Z', receipt_img: 'https://img.example/r.jpg', branch: 'حلب' },
    { name: 'نور', phone: '0933900001', product: 'عدسة كانون 50', qty: 1, price: 150, status: 'shipped', serial_code: 'ORD-72', shipping_company: 'القدموس', entered_by: 'سامر', invoice_id: inv.id, invoice_number: 'INV-501', created_at: '2026-10-21T10:00:00Z', branch: 'حلب' }]);
  await H.call('/rest/v1/gmt_customers', [{ name: 'نور', phone: '0933900001', branch_key: 'haleb' }]);
  const { browser, ctx, pg, errs } = await H.open('admin_pos.html?tab=customers', { init: H.ADMIN_INIT, w: 390, h: 900, mobile: true, wait: 6000 });
  await pg.evaluate(async () => { try { await loadInvoices(); } catch (_) {} window.__opened = []; window.open = u => { window.__opened.push(u); return null; }; });
  await pg.evaluate(() => openCustomerProfile('0933900001', 'نور'));
  await pg.waitForFunction(() => document.querySelector('#cust-profile [data-cp-ord]'), null, { timeout: 15000 }).catch(() => {});
  const t = await pg.evaluate(() => document.getElementById('cust-profile').innerText);
  ok(/أدخلها: سامر · نقطة البيع: حلب/.test(t) && /أدخله: ريم/.test(t) && /أدخله: سامر/.test(t), 'من أدخل: الفاتورة (الكاشير ونقطة البيع) وكل أوردر (المستخدم)');
  const bought = await pg.evaluate(() => [...document.querySelectorAll('#cust-profile [data-cp-bought]')].map(x => x.innerText.replace(/\s+/g, ' ')));
  ok(bought.length === 3 && bought.some(b => /عدسة كانون 50/.test(b) && /INV-501/.test(b) && /سامر · حلب/.test(b)) && bought.some(b => /حامل ثلاثي/.test(b) && /ORD-71/.test(b) && /ريم · أوردر شحن/.test(b)),
    '«🧾 كل ما اشتراه»: بنود الفاتورة + الأوردر غير المفوتر (المفوتر لا يتكرّر) بتاريخه ومن أدخله: ' + JSON.stringify(bought).slice(0, 200));
  // الضغط على أوردرٍ مرتبط بفاتورة
  const ask = choose => pg.evaluate(k => { window.__ch = null; GMTAsk.choose = async (m, o) => { window.__ch = (o.choices || []).map(x => x.k); return k; }; }, choose);
  await ask('inv'); await pg.evaluate(id => document.querySelector('#cust-profile [data-cp-ord="' + id + '"]').click(), o2.id); await sleep(300);
  let r = await pg.evaluate(() => ({ ch: window.__ch, op: window.__opened.slice(-1)[0] }));
  ok(JSON.stringify(r.ch) === '["inv","print","open"]' && /^pos\.html\?view=/.test(r.op) && /inv=INV-501/.test(r.op), 'أوردرٌ مرتبط ⇒ «🧾 فاتورته» تفتحها في نقطة البيع (+ الملصق · فتح الأوردر): ' + JSON.stringify(r));
  await ask('receipt'); await pg.evaluate(id => document.querySelector('#cust-profile [data-cp-ord="' + id + '"]').click(), o1.id); await sleep(300);
  r = await pg.evaluate(() => ({ ch: window.__ch, op: window.__opened.slice(-1)[0] }));
  ok(JSON.stringify(r.ch) === '["print","receipt","open"]' && r.op === 'orders.html?order=' + o1.id + '&do=receipt', 'أوردرٌ بإيصال ⇒ «📦 إيصال الشحن» (والملصق): ' + JSON.stringify(r));
  await ask(null); await pg.evaluate(() => document.querySelector('#cust-profile [data-cp-inv]').click()); await sleep(200);
  ok(/^pos\.html\?view=.*inv=INV-501/.test(await pg.evaluate(() => window.__opened.slice(-1)[0])), 'الضغط على فاتورة ⇒ تُفتح في نقطة البيع');
  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource/.test(e));
  ok(!real.length, 'ملف العميل: لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  // الأوردرات: ?order=<id>&do=print ⇒ الأوردر في تبويبه مُبرَزاً وورقته للطباعة
  const O = await H.open('orders.html?order=' + o1.id + '&do=print', { w: 390, h: 844, mobile: true, wait: 0, init: H.ADMIN_INIT + ';window.__printed=0;' });
  await O.pg.waitForFunction(() => typeof currentTab !== 'undefined' && currentTab === 'completed' && document.getElementById('__print_iframe__'), null, { timeout: 15000 }).catch(() => {});
  const v = await O.pg.evaluate(id => ({ tab: currentTab, card: !!document.getElementById('card-' + id), iframe: !!document.getElementById('__print_iframe__'), url: location.search }), o1.id);
  ok(v.tab === 'completed' && v.card && v.iframe && v.url === '', 'الأوردرات ?order=…&do=print ⇒ تبويبه (تم التحصيل) والبطاقة مُبرَزة وورقة الأوردر للطباعة: ' + JSON.stringify(v));
  await O.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
