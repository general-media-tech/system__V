// (TASK-0240 → TASK-0260 · المالك seq 186–187) المرتجع «مثل اوردر العادي وصول وتاكيد استلامنا له»: بالطريق ⇐ وصل لمكتب الشحن ⇐ استلمناه
// · «من قام بالدفع والمبلغ سواء في الليره السوريه او بالدولار» · «تلقائي … مصروف على الشركه ممكن نحدده من نقطه البيع المستلمه بكل مره نسال»
// · الفاتورة والمخزون والصناديق والمجموع الكلي «عندما يتم … تاكيد استلامه حصرا»
// (TASK-0261 · seq 189–190) الإنشاء من الأوردرات فقط ولا يغيّر حالة الأوردر · «تأكيد الاستلام» ⇒ «مرتجع» + مرتجع الفاتورة تلقائياً
// (المخزون · خصم المبلغ من الدين/الصندوق) + الأجور · «المشتري دفع الرسوم» ⇒ لا خسارة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dump = () => H.call('/__dump', undefined, 'GET');
const RI = o => typeof o.return_info === 'string' ? JSON.parse(o.return_info) : o.return_info;
(async () => {
  const { prods } = await H.seed();
  const P0 = prods[0];
  // فاتورة «آجل (شحن)» للأوردر 3: قطعتان × 50 · غير مقبوضة (الدين 100)
  const inv = (await H.call('/rest/v1/invoices', [{ inv_number: 'INV-77', branch_key: 'haleb', branch_name: 'حلب', total: 100, paid_amount: 0, remaining_amount: 100, payment_status: 'unpaid', sale_type: 'آجل (شحن)', customer_name: 'زبون فاتورة', items_count: 2 }]))[0];
  await H.call('/rest/v1/invoice_items', [{ invoice_id: inv.id, product_id: P0.id, product_name: P0.name, branch_key: 'haleb', qty: 2, unit_price: 50, wholesale_price: 40, total: 100 }]);
  const base = { qty: 1, branch: 'حلب', product: 'كاميرا', price: 100, shipping_company: 'المفتي', shipped_at: '2026-10-25T10:00:00Z', return_info: null, returned_at: null };   // (القاعدة الوهمية تأخذ الأعمدة من أوّل صفّ)
  const rows = await H.call('/rest/v1/gmt_orders', [
    Object.assign({ name: 'زبون رفض', phone: '0933800001', status: 'shipped', tracking_number: '300001', serial_code: 'ORD-1' }, base),
    Object.assign({ name: 'زبون فرع', phone: '0933800002', status: 'delivered', tracking_number: '300002', serial_code: 'ORD-2' }, base),
    Object.assign({ name: 'زبون فاتورة', phone: '0933800003', status: 'shipped', tracking_number: '300003', serial_code: 'ORD-3', invoice_number: 'INV-77', invoice_id: inv.id, is_locked: true }, base),
    Object.assign({}, base, { name: 'زبون قديم', phone: '0933800004', status: 'returned', tracking_number: '300004', serial_code: 'ORD-4', returned_at: '2026-10-28T09:00:00Z',
      return_info: { reason: 'رفض الزبون الاستلام', total: 2, ship_out: 1, ship_back: 1, payer_kind: 'company', payer_name: 'الشركة', at: '2026-10-28T09:00:00Z', prev_status: 'shipped' } }),
    Object.assign({ name: 'زبون دفع', phone: '0933800005', status: 'shipped', tracking_number: '300005', serial_code: 'ORD-5' }, base)]);
  const idOf = n => rows.find(r => r.name === n).id;
  const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, mobile: true, wait: 5000, init: H.ADMIN_INIT });
  const ans = (form, choose, confirm) => pg.evaluate(([form, choose, confirm]) => {
    window.__asked = []; window.__opened = []; window.open = u => { window.__opened.push(u); return null; };
    GMTAsk.form = async (m, o) => { window.__asked.push({ form: o.title, f: (o.fields || []).map(x => x.k + '=' + (x.value == null ? '' : x.value)) }); const r = await o.submit(Object.assign({}, form)); return r.result || r; };
    GMTAsk.choose = async (m, o) => { window.__asked.push({ m: String(m).slice(0, 220), c: (o.choices || []).map(x => x.k) }); return choose.shift(); };
    GMTAsk.confirm = async () => confirm !== false; GMTAsk.alert = async m => { window.__asked.push('alert:' + String(m).slice(0, 600)); };
  }, [form, choose, confirm]);
  const grand = () => pg.evaluate(() => ({ g: document.getElementById('grandTotal').textContent, r: document.getElementById('sumReturning').textContent }));
  const g0 = await grand();
  // ① ⋮
  const mi = await pg.evaluate(id => cardMoreItems(orders.find(o => o.id == id)).map(x => x.t), idOf('زبون رفض'));
  ok(mi.some(t => /أنشئ مرتجعاً/.test(t)), '⋮ للمشحون: «↩️ أنشئ مرتجعاً»');
  // ② الإنشاء ⇒ بالطريق · لا مصروف · لا فاتورة · يبقى في المجموع الكلي
  await ans({ reason: 'رفض الزبون الاستلام', ret_company: 'المفتي', ret_tracking: 'R-1', invoice_no: '', note: '' }, []);
  await pg.evaluate(id => orderMarkReturned(id), idOf('زبون رفض')); await sleep(800);
  let d = await dump(), o1 = d.gmt_orders.find(o => o.id === idOf('زبون رفض')), r1 = RI(o1);
  let q = await pg.evaluate(() => window.__asked);
  ok(o1.status === 'shipped' && !o1.returned_at && r1.stage === 'transit' && r1.ret_tracking === 'R-1' && r1.reason === 'رفض الزبون الاستلام' && !(d.gmt_expenses || []).some(e => /ORD-1/.test(e.title || '')) && q.length === 1,
    'إنشاء المرتجع ⇒ الأوردر يبقى «في الطريق» · المرتجع «↩️ بالطريق إلينا» بسببه ورقم تتبّعه · بلا مصروف ولا مرتجع فاتورة: ' + JSON.stringify({ st: r1.stage, n: q.length }));
  let g1 = await grand();
  ok(g1.g === g0.g && g1.r === '$200', 'قبل تأكيد الاستلام يبقى في «المجموع الكلي» (لم يتغيّر ' + g0.g + ') · «مرتجع لم يُستلم» ' + g1.r + ' (مع القديم)');
  const both = await pg.evaluate(id => { switchTab('all'); return { sh: !!document.querySelector('#section-shipped #card-' + id), rt: !!document.querySelector('#list-ret-transit #card-' + id),
    collect: !!document.querySelector('#section-shipped #card-' + id + ' [data-ret-arrived]'), tag: /الأوردر بحالته/.test((document.querySelector('#section-shipped #card-' + id) || {}).innerText || '') }; }, idOf('زبون رفض'));
  ok(both.sh && both.rt && both.collect && both.tag, 'الأوردر في «في الطريق» بعلامة المرتجع وزرّ مرحلته · وفي «المرتجعات» معاً: ' + JSON.stringify(both));
  let card = await pg.evaluate(id => { switchTab('returned'); const c = document.querySelector('#section-returned #card-' + id); return { inT: !!c.closest('#list-ret-transit'), btn: !!c.querySelector('[data-ret-arrived]'), t: c.innerText }; }, idOf('زبون رفض'));
  ok(card.inT && card.btn && /بالطريق إلينا/.test(card.t) && /R-1/.test(card.t), 'تبويب «↩️ المرتجعات» ⇐ قسم «بالطريق إلينا» · زرّ «📍 وصل لمكتب الشحن»: ' + JSON.stringify(card).slice(0, 300));
  // ③ وصل للمكتب + تبليغ
  await ans({}, ['wa']);
  await pg.evaluate(id => returnArrived(id), idOf('زبون رفض')); await sleep(800);
  d = await dump(); r1 = RI(d.gmt_orders.find(o => o.id === idOf('زبون رفض')));
  const op = await pg.evaluate(() => window.__opened);
  ok(r1.stage === 'arrived' && r1.arrived_at && r1.notified_at && /^https:\/\/wa\.me\/\?text=/.test(op[0] || '') && /R-1/.test(decodeURIComponent(op[0] || '')), '«📍 وصل لمكتب الشحن» ⇒ مرحلته · و«📲 تبليغ» واتساب برقم التتبّع');
  card = await pg.evaluate(id => { const c = document.querySelector('#section-returned #card-' + id); return { inA: !!c.closest('#list-ret-arrived'), btn: !!c.querySelector('[data-ret-receive]') }; }, idOf('زبون رفض'));
  ok(card.inA && card.btn, 'قسم «وصل لمكتب الشحن — بانتظار استلامنا» · زرّ «✅ تأكيد استلامنا»');
  // ④ تأكيد الاستلام: ليرة سورية · على الشركة (تلقائي)
  await ans({ by: 'سامر', condition: 'تالفة', condition_note: 'كسر بالعلبة', cost: '25,000', currency: 'syp', rate: '125' }, ['haleb', '__co']);
  await pg.evaluate(id => returnReceive(id), idOf('زبون رفض')); await sleep(900);
  q = await pg.evaluate(() => window.__asked);
  d = await dump(); r1 = RI(d.gmt_orders.find(o => o.id === idOf('زبون رفض')));
  const e1 = (d.gmt_expenses || []).find(e => /ORD-1/.test(e.title || ''));
  ok(q[0].f.some(x => x === 'currency=syp') && q[1].c.includes('haleb') && q[1].c.includes('daraa') && q[2].c.join() === '__co,haleb,__buyer',
    'الاستلام يسأل: مين استلم · الحالة · الأجور وعملتها · نقطة البيع المستلمة · ومين دفع (الشركة تلقائياً · نقطة البيع المستلمة · المشتري): ' + JSON.stringify(q[2] && q[2].c));
  ok(d.gmt_orders.find(o => o.id === idOf('زبون رفض')).status === 'returned' && r1.stage === 'received' && r1.received_by === 'سامر' && r1.received_branch === 'haleb' && r1.condition === 'تالفة' && r1.cost === 25000 && r1.currency === 'syp' && r1.cost_usd === 200 && r1.payer_kind === 'company',
    '«✅ تأكيد استلامنا» ⇒ الأوردر «مرتجع» · سامر · حلب · تالفة · 25,000 ل.س (≈ $200) على الشركة');
  ok(e1 && Number(e1.amount) === 25000 && e1.currency === 'syp' && Number(e1.exchange_rate) === 125 && e1.is_general === true && e1.approved === true && String(r1.expense_id) === String(e1.id),
    'المصروف بالليرة وسعر صرفه · عامّ معتمد · مربوط بالمرتجع: ' + JSON.stringify(e1 && { a: e1.amount, c: e1.currency }));
  const g2 = await grand();
  ok(g2.r === '$100' && g2.g === '$' + (parseFloat(g1.g.slice(1).replace(/,/g, '')) - 100).toLocaleString(), 'بعد تأكيد الاستلام فقط يخرج من «المجموع الكلي»: ' + JSON.stringify(g2));
  card = await pg.evaluate(id => { const c = document.querySelector('#section-returned #card-' + id); return { inR: !!c.closest('#list-ret-received'), reship: !!c.querySelector('[data-reship]'), t: c.innerText }; }, idOf('زبون رفض'));
  ok(card.inR && card.reship && /استلمه سامر \(حلب\)/.test(card.t) && /25,000 ل\.س \(الشركة\)/.test(card.t), 'قسم «✅ استلمناه»: مين ووين وحالة البضاعة والأجور · «🔁 إعادة الشحن»');
  // ⑤ بالدولار على نقطة البيع المستلمة ⇒ بانتظار الموافقة
  await ans({ reason: 'عنوان خاطئ', ret_company: '', ret_tracking: '', invoice_no: '', note: '' }, []); await pg.evaluate(id => orderMarkReturned(id), idOf('زبون فرع')); await sleep(500);
  await ans({}, ['no']); await pg.evaluate(id => returnArrived(id), idOf('زبون فرع')); await sleep(500);
  await ans({ by: 'رنا', condition: 'سليمة', condition_note: '', cost: '4', currency: 'usd', rate: '' }, ['daraa', 'daraa']); await pg.evaluate(id => returnReceive(id), idOf('زبون فرع')); await sleep(800);
  d = await dump();
  const e2 = (d.gmt_expenses || []).find(e => /ORD-2/.test(e.title || ''));
  ok(e2 && Number(e2.amount) === 4 && e2.currency === 'usd' && e2.branch_key === 'daraa' && e2.is_general === false && e2.approved === false, 'بالدولار على نقطة البيع المستلمة (درعا) ⇒ بانتظار موافقتك: ' + JSON.stringify(e2 && { b: e2.branch_key, ap: e2.approved }));
  // ⑥ مرتبطٌ بفاتورة: الإنشاء لا يمسّ الفاتورة · تأكيد الاستلام ⇒ مرتجعها تلقائياً (المخزون · الدين) بلا فتح نقطة البيع
  await ans({ reason: 'تالف', ret_company: 'المفتي', ret_tracking: '', invoice_no: 'INV-77', note: '' }, []);
  await pg.evaluate(id => orderMarkReturned(id), idOf('زبون فاتورة')); await sleep(600);
  q = await pg.evaluate(() => window.__asked); d = await dump();
  ok(q.length === 1 && q[0].f.includes('invoice_no=INV-77') && !(d.invoices || []).some(x => /^R-INV-77/.test(x.inv_number || '')) && d.gmt_orders.find(o => o.id === idOf('زبون فاتورة')).status === 'shipped',
    'الإنشاء: الفاتورة المرتبطة معبّأة (INV-77) · لا مرتجع فاتورة · الأوردر بحالته');
  const st0 = Number(d.products.find(p => p.id === P0.id).haleb), sd0 = Number(d.products.find(p => p.id === P0.id).daraa);
  await ans({ by: 'سامر', condition: 'سليمة', condition_note: '', cost: '0', currency: 'syp', rate: '125' }, ['daraa']);   // استلمته درعا · الفاتورة من حلب
  await pg.evaluate(id => returnReceive(id), idOf('زبون فاتورة')); await sleep(1500);
  q = await pg.evaluate(() => window.__asked); d = await dump();
  const R = (d.invoices || []).filter(x => /^R-INV-77/.test(x.inv_number || '')), RI3 = R[0] && (d.invoice_items || []).filter(x => x.invoice_id === R[0].id);
  const orig = d.invoices.find(x => x.id === inv.id), o3 = d.gmt_orders.find(o => o.id === idOf('زبون فاتورة')), r3 = RI(o3);
  ok(R.length === 1 && Number(R[0].total) === -100 && Number(R[0].paid_amount) === 0 && String(R[0].original_invoice_id) === String(inv.id) && RI3.length === 1 && Number(RI3[0].qty) === 2,
    'تأكيد الاستلام ⇒ فاتورة مرتجع كاملة تلقائياً (R-INV-77 · -$100 · قطعتان) بلا فتح نقطة البيع: ' + JSON.stringify(R[0] && { t: R[0].total, p: R[0].paid_amount }));
  ok(Number(d.products.find(p => p.id === P0.id).haleb) === st0 + 2 && Number(d.products.find(p => p.id === P0.id).daraa) === sd0 && Number(orig.remaining_amount) === 0 && orig.payment_status === 'paid' && RI3[0].branch_key === 'haleb',
    '(seq 195) البضاعة عادت لفرع الفاتورة نفسها حصراً (+2 حلب · درعا المستلمة لم تتغيّر) · والمبلغ خُصم من دين الفاتورة (غير مقبوضة ⇒ لا شيء من الصندوق): ' + JSON.stringify({ st: [st0, d.products.find(p => p.id === P0.id).haleb], rem: orig.remaining_amount }));
  ok(o3.status === 'returned' && r3.refund_done && Number(r3.refund_total) === 100 && Number(r3.refund_debt) === 100 && !(d.gmt_expenses || []).some(e => /ORD-3/.test(e.title || '')) &&
     q.some(x => typeof x === 'string' && /نُفّذ تلقائياً/.test(x) && /عادت لمخزون فرع الفاتورة \(حلب\)/.test(x)), 'الأوردر «مرتجع» ومسجَّلٌ عليه مرتجع الفاتورة · بلا أجور ⇒ بلا مصروف');
  const again = await pg.evaluate(id => GMTRefund.full({ url: SUPA_URL, headers: () => SB_HEADERS, invoiceId: id, orderLinked: true }).then(x => ({ a: x.already })), inv.id);
  d = await dump();
  ok(again.a === true && (d.invoices || []).filter(x => /^R-INV-77/.test(x.inv_number || '')).length === 1 && Number(d.products.find(p => p.id === P0.id).haleb) === st0 + 2, 'إعادة المرتجع لا تُرجع شيئاً مرّتين');
  // ⑥ب «المشتري دفع الرسوم» ⇒ لا خسارة · وإلغاء مرتجعٍ أُنشئ بالخطأ
  await ans({ reason: 'غلط', ret_company: '', ret_tracking: '', invoice_no: '', note: '' }, []); await pg.evaluate(id => orderMarkReturned(id), idOf('زبون دفع')); await sleep(500);
  await ans({}, []); await pg.evaluate(id => returnCancel(id), idOf('زبون دفع')); await sleep(500);
  d = await dump(); let o5 = d.gmt_orders.find(o => o.id === idOf('زبون دفع')), r5 = RI(o5);
  ok(o5.status === 'shipped' && !r5.stage && r5.history.length === 1 && r5.history[0].cancelled_at, '«✕ إلغاء المرتجع» ⇒ الأوردر كما هو والمرتجع الملغى في السجلّ');
  await ans({ reason: 'رفض', ret_company: '', ret_tracking: '', invoice_no: '', note: '' }, []); await pg.evaluate(id => orderMarkReturned(id), idOf('زبون دفع')); await sleep(500);
  await ans({ by: 'رنا', condition: 'سليمة', condition_note: '', cost: '30000', currency: 'syp', rate: '125' }, ['daraa', '__buyer']); await pg.evaluate(id => returnReceive(id), idOf('زبون دفع')); await sleep(800);
  d = await dump(); o5 = d.gmt_orders.find(o => o.id === idOf('زبون دفع')); r5 = RI(o5);
  const c5 = await pg.evaluate(id => (document.querySelector('#section-returned #card-' + id) || {}).innerText || '', idOf('زبون دفع'));
  ok(o5.status === 'returned' && r5.payer_kind === 'buyer' && !(d.gmt_expenses || []).some(e => /ORD-5/.test(e.title || '')) && /دفعها المشتري — لا خسارة/.test(c5), '«🧍 المشتري دفع الرسوم» ⇒ لا مصروف ولا خسارة · تظهر على البطاقة');
  // ⑦ القديم (قبل المراحل): يظهر «بالطريق» بأجوره المسجّلة
  card = await pg.evaluate(id => { render(); const c = document.querySelector('#section-returned #card-' + id); return { inT: !!c.closest('#list-ret-transit'), t: c.innerText }; }, idOf('زبون قديم'));
  ok(card.inT && /أجور المرتجع: \$2\.00 \(الشركة\)/.test(card.t), 'مرتجعٌ قديم (قبل المراحل) ⇐ «بالطريق إلينا» بأجوره المسجّلة: ' + JSON.stringify(card).slice(0, 300));
  // ⑧ التقرير
  await ans({}, []); await pg.evaluate(() => returnsReport()); await sleep(200);
  const rep = await pg.evaluate(() => (window.__asked.find(x => typeof x === 'string' && /^alert:/.test(x)) || ''));
  ok(/المرتجعات: 5/.test(rep) && /حسب المرحلة/.test(rep) && /✅ استلمناه: 4/.test(rep) && /\$206\.00/.test(rep) && /درعا: 1/.test(rep), '«📊 تقرير المرتجعات»: المراحل والأجور (بالدولار المكافئ) ومن دفع: ' + rep.slice(6, 120));
  // ⑨ إعادة الشحن
  await ans({}, []); await pg.evaluate(id => orderReship(id), idOf('زبون رفض')); await sleep(600);
  d = await dump(); o1 = d.gmt_orders.find(o => o.id === idOf('زبون رفض')); r1 = RI(o1);
  ok(o1.status === 'pending' && !o1.tracking_number && r1.history.length === 1 && r1.history[0].cost === 25000 && r1.history[0].reshipped_at, '«🔁 إعادة الشحن» ⇒ قيد التجهيز ويبقى سجلّ المرتجع');
  await pg.evaluate(() => switchTab('pending')); await sleep(300);
  ok(/أُعيد شحنه/.test(await pg.evaluate(id => (document.querySelector('#section-pending #card-' + id) || {}).innerText || '', idOf('زبون رفض'))), 'بطاقته في «قيد التجهيز» تذكر المرتجع السابق');
  let real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
