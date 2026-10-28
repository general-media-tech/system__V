// (TASK-0240 · المالك seq 164 «المرتجعات والمرتجعات في الاوردرات · مصاريف الاوردرات المرتجعه» ⇐ seq 183: «كلهن سوا … الاوردر وتكاليفه
// … الفاتوره … الادخاله على المخزون» · «مصروف عام للشركه لكن ممكن يدفعوا احد نقاط للبيع نحن عم نحدد»)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dump = () => H.call('/__dump', undefined, 'GET');
(async () => {
  await H.seed();
  const base = { qty: 1, branch: 'حلب', product: 'كاميرا', price: 100, shipping_company: 'المفتي', shipped_at: '2026-10-25T10:00:00Z' };
  const rows = await H.call('/rest/v1/gmt_orders', [
    Object.assign({ name: 'زبون رفض', phone: '0933800001', status: 'shipped', tracking_number: '300001', serial_code: 'ORD-1' }, base),
    Object.assign({ name: 'زبون فرع', phone: '0933800002', status: 'delivered', tracking_number: '300002', serial_code: 'ORD-2' }, base),
    Object.assign({ name: 'زبون فاتورة', phone: '0933800003', status: 'shipped', tracking_number: '300003', serial_code: 'ORD-3', invoice_number: 'INV-77', invoice_id: '11111111-1111-1111-1111-111111111111', is_locked: true }, base)]);
  const idOf = n => rows.find(r => r.name === n).id;
  const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, mobile: true, wait: 5000, init: H.ADMIN_INIT });
  // ① ⋮ فيه «سجّله مرتجعاً» للمشحون
  const mi = await pg.evaluate(id => cardMoreItems(orders.find(o => o.id == id)).map(x => x.t), idOf('زبون رفض'));
  ok(mi.some(t => /سجّله مرتجعاً/.test(t)), '⋮ للمشحون: «↩️ سجّله مرتجعاً»');
  // ② على الشركة
  const ans = (form, choose, extra) => pg.evaluate(([form, choose, extra]) => {
    window.__asked = [];
    GMTAsk.form = async (m, o) => { window.__asked.push('form'); const r = await o.submit(form); return r.result || r; };
    GMTAsk.choose = async (m, o) => { window.__asked.push({ m: String(m).slice(0, 160), c: (o.choices || []).map(x => x.k) }); return choose.shift(); };
    GMTAsk.confirm = async () => true; GMTAsk.alert = async m => { window.__asked.push('alert:' + String(m).slice(0, 400)); };
  }, [form, choose, extra]);
  await ans({ reason: 'رفض الزبون الاستلام', ship_out: '5', ship_back: '٧', note: '' }, ['__co']);
  await pg.evaluate(id => orderMarkReturned(id), idOf('زبون رفض')); await sleep(800);
  let d = await dump();
  let o1 = d.gmt_orders.find(o => o.id === idOf('زبون رفض')), e1 = (d.gmt_expenses || []).find(e => /ORD-1/.test(e.title || ''));
  const ri = typeof o1.return_info === 'string' ? JSON.parse(o1.return_info) : o1.return_info;
  ok(o1.status === 'returned' && o1.returned_at && ri && ri.total === 12 && ri.reason === 'رفض الزبون الاستلام' && ri.payer_kind === 'company' && ri.prev_status === 'shipped',
    'الأوردر ⇐ «مرتجع» بسببه وتكاليفه (ذهاب 5 + إرجاع ٧ = 12): ' + JSON.stringify({ s: o1.status, t: ri && ri.total }));
  ok(e1 && Number(e1.amount) === 12 && e1.is_general === true && e1.approved === true && !e1.branch_key && e1.kind === 'مصاريف الأوردرات المرتجعة' && String(ri.expense_id) === String(e1.id),
    'المصروف على الشركة: عامّ · معتمد · «مصاريف الأوردرات المرتجعة» · مربوطٌ بالأوردر: ' + JSON.stringify(e1 && { a: e1.amount, g: e1.is_general, ap: e1.approved }));
  // ③ على نقطة بيع ⇒ بانتظار الموافقة
  await ans({ reason: 'عنوان خاطئ', ship_out: '0', ship_back: '4', note: 'ملاحظة' }, ['daraa']);
  await pg.evaluate(id => orderMarkReturned(id), idOf('زبون فرع')); await sleep(800);
  const q3 = await pg.evaluate(() => window.__asked);
  d = await dump();
  const e2 = (d.gmt_expenses || []).find(e => /ORD-2/.test(e.title || ''));
  ok(q3[1] && q3[1].c[0] === '__co' && q3[1].c.includes('haleb') && q3[1].c.includes('daraa'), 'من يدفع: الشركة أو نقطة بيع تختارها: ' + JSON.stringify(q3[1] && q3[1].c));
  ok(e2 && Number(e2.amount) === 4 && e2.branch_key === 'daraa' && e2.is_general === false && e2.approved === false, 'على نقطة بيع (درعا) ⇒ مصروفها بانتظار موافقتك (منها تختار الصندوق): ' + JSON.stringify(e2 && { b: e2.branch_key, ap: e2.approved }));
  // ④ مرتبطٌ بفاتورة ⇒ مرتجع الفاتورة في نقطة البيع
  await ans({ reason: 'تالف', ship_out: '0', ship_back: '0', note: '' }, ['later']);
  await pg.evaluate(id => orderMarkReturned(id), idOf('زبون فاتورة')); await sleep(800);
  const q4 = await pg.evaluate(() => window.__asked);
  d = await dump();
  ok(q4.length === 2 && /مرتجعها في نقطة البيع يُعيد البضاعة للمخزون/.test(q4[1].m) && q4[1].c.join() === 'pos,later' && d.gmt_orders.find(o => o.id === idOf('زبون فاتورة')).status === 'returned' && !(d.gmt_expenses || []).some(e => /ORD-3/.test(e.title || '')),
    'مرتبطٌ بفاتورة ⇒ «افتح مرتجع الفاتورة الآن» (المخزون والعمولة) · بلا تكاليف ⇒ بلا مصروف');
  // ⑤ التبويب
  await pg.evaluate(() => switchTab('returned')); await sleep(400);
  const tab = await pg.evaluate(() => ({ badge: document.getElementById('badge-returned').textContent, cards: [...document.querySelectorAll('#list-returned .order-card')].map(c => ({ t: c.innerText, reship: !!c.querySelector('[data-reship]') })),
    shipped: document.querySelectorAll('#list-shipped .order-card').length }));
  ok(tab.badge === '3' && tab.cards.length === 3 && tab.cards.every(c => c.reship && /↩️ مرتجع/.test(c.t)) && tab.cards.some(c => /التكاليف \$12\.00 \(الشركة\)/.test(c.t)) && tab.cards.some(c => /\$4\.00 \(درعا\)/.test(c.t)),
    'تبويب «↩️ المرتجعة» (3) · كل بطاقة: السبب والتكاليف ومن دفع + «🔁 إعادة الشحن»');
  // ⑥ التقرير
  await ans({}, []); await pg.evaluate(() => returnsReport()); await sleep(200);
  const rep = await pg.evaluate(() => window.__asked.find(x => typeof x === 'string' && /^alert:/.test(x)) || '');
  ok(/المرتجعات: 3/.test(rep) && /\$16\.00/.test(rep) && /رفض الزبون الاستلام: 1/.test(rep) && /درعا: 1/.test(rep), '«📊 تقرير المرتجعات»: العدد والتكاليف حسب السبب والشركة ومن دفع: ' + rep.slice(6, 90));
  // ⑦ إعادة الشحن
  await ans({}, []); await pg.evaluate(id => orderReship(id), idOf('زبون رفض')); await sleep(600);
  d = await dump(); o1 = d.gmt_orders.find(o => o.id === idOf('زبون رفض'));
  const ri2 = typeof o1.return_info === 'string' ? JSON.parse(o1.return_info) : o1.return_info;
  ok(o1.status === 'pending' && !o1.tracking_number && ri2.history.length === 1 && ri2.history[0].total === 12 && ri2.history[0].reshipped_at, '«🔁 إعادة الشحن» ⇒ قيد التجهيز (بلا رقم تتبّع قديم) ويبقى سجلّ المرتجع');
  await pg.evaluate(() => switchTab('pending')); await sleep(300);
  ok(/أُعيد شحنه/.test(await pg.evaluate(id => (document.getElementById('card-' + id) || {}).innerText || '', idOf('زبون رفض'))), 'بطاقته في «قيد التجهيز» تذكر المرتجع السابق');
  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
