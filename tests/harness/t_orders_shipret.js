// (TASK-0240 → TASK-0260 · المالك seq 186–187) المرتجع «مثل اوردر العادي وصول وتاكيد استلامنا له»: بالطريق ⇐ وصل لمكتب الشحن ⇐ استلمناه
// · «من قام بالدفع والمبلغ سواء في الليره السوريه او بالدولار» · «تلقائي … مصروف على الشركه ممكن نحدده من نقطه البيع المستلمه بكل مره نسال»
// · الفاتورة والمخزون والصناديق والمجموع الكلي «عندما يتم … تاكيد استلامه حصرا»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dump = () => H.call('/__dump', undefined, 'GET');
const RI = o => typeof o.return_info === 'string' ? JSON.parse(o.return_info) : o.return_info;
(async () => {
  await H.seed();
  const base = { qty: 1, branch: 'حلب', product: 'كاميرا', price: 100, shipping_company: 'المفتي', shipped_at: '2026-10-25T10:00:00Z', return_info: null, returned_at: null };   // (القاعدة الوهمية تأخذ الأعمدة من أوّل صفّ)
  const rows = await H.call('/rest/v1/gmt_orders', [
    Object.assign({ name: 'زبون رفض', phone: '0933800001', status: 'shipped', tracking_number: '300001', serial_code: 'ORD-1' }, base),
    Object.assign({ name: 'زبون فرع', phone: '0933800002', status: 'delivered', tracking_number: '300002', serial_code: 'ORD-2' }, base),
    Object.assign({ name: 'زبون فاتورة', phone: '0933800003', status: 'shipped', tracking_number: '300003', serial_code: 'ORD-3', invoice_number: 'INV-77', invoice_id: '11111111-1111-1111-1111-111111111111', is_locked: true }, base),
    Object.assign({}, base, { name: 'زبون قديم', phone: '0933800004', status: 'returned', tracking_number: '300004', serial_code: 'ORD-4', returned_at: '2026-10-28T09:00:00Z',
      return_info: { reason: 'رفض الزبون الاستلام', total: 2, ship_out: 1, ship_back: 1, payer_kind: 'company', payer_name: 'الشركة', at: '2026-10-28T09:00:00Z', prev_status: 'shipped' } }),
    Object.assign({ name: 'زبون رابط', phone: '0933800005', status: 'shipped', tracking_number: '300005', serial_code: 'ORD-5', invoice_number: 'INV-5', invoice_id: '55555555-5555-5555-5555-555555555555', is_locked: true }, base)]);
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
  ok(o1.status === 'returned' && r1.stage === 'transit' && r1.ret_tracking === 'R-1' && r1.reason === 'رفض الزبون الاستلام' && !(d.gmt_expenses || []).some(e => /ORD-1/.test(e.title || '')) && q.length === 1,
    'إنشاء المرتجع ⇒ «↩️ بالطريق إلينا» بالسبب ورقم تتبّع المرتجع · بلا مصروف ولا سؤال فاتورة بعد: ' + JSON.stringify({ st: r1.stage, n: q.length }));
  let g1 = await grand();
  ok(g1.g === g0.g && g1.r === '$200', 'قبل تأكيد الاستلام يبقى في «المجموع الكلي» (لم يتغيّر ' + g0.g + ') · «مرتجع لم يُستلم» ' + g1.r + ' (مع القديم والمرتبط)');
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
  ok(q[0].f.some(x => x === 'currency=syp') && q[1].c.includes('haleb') && q[1].c.includes('daraa') && q[2].c.join() === '__co,haleb',
    'الاستلام يسأل: مين استلم · الحالة · الأجور وعملتها · نقطة البيع المستلمة · ومين دفع (الشركة تلقائياً أو نقطة البيع المستلمة): ' + JSON.stringify(q[2] && q[2].c));
  ok(r1.stage === 'received' && r1.received_by === 'سامر' && r1.received_branch === 'haleb' && r1.condition === 'تالفة' && r1.cost === 25000 && r1.currency === 'syp' && r1.cost_usd === 200 && r1.payer_kind === 'company',
    '«✅ استلمناه»: سامر · حلب · تالفة · 25,000 ل.س (≈ $200) على الشركة');
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
  // ⑥ مرتبطٌ بفاتورة: لا سؤال عن الفاتورة عند الإنشاء · عند تأكيد الاستلام فقط «افتح مرتجع الفاتورة»
  await ans({ reason: 'تالف', ret_company: 'المفتي', ret_tracking: '', invoice_no: 'INV-77', note: '' }, []);
  await pg.evaluate(id => orderMarkReturned(id), idOf('زبون فاتورة')); await sleep(600);
  q = await pg.evaluate(() => window.__asked);
  ok(q.length === 1 && q[0].f.includes('invoice_no=INV-77'), 'الإنشاء: الفاتورة المرتبطة معبّأة (INV-77) ولا مرتجع فاتورة بعد');
  await ans({ by: 'سامر', condition: 'سليمة', condition_note: '', cost: '0', currency: 'syp', rate: '125' }, ['haleb', 'later']);
  await pg.evaluate(id => returnReceive(id), idOf('زبون فاتورة')); await sleep(800);
  q = await pg.evaluate(() => window.__asked);
  d = await dump();
  ok(q.length === 3 && /الفاتورة #INV-77/.test(q[2].m) && /يُعيد البضاعة للمخزون ويُرجع المبلغ من الصندوق/.test(q[2].m) && q[2].c.join() === 'pos,later' && !(d.gmt_expenses || []).some(e => /ORD-3/.test(e.title || '')),
    'تأكيد الاستلام ⇒ «افتح مرتجع الفاتورة الآن» (المخزون والصندوق) · بلا أجور ⇒ بلا مصروف');
  // ⑦ القديم (قبل المراحل): يظهر «بالطريق» بأجوره المسجّلة
  card = await pg.evaluate(id => { render(); const c = document.querySelector('#section-returned #card-' + id); return { inT: !!c.closest('#list-ret-transit'), t: c.innerText }; }, idOf('زبون قديم'));
  ok(card.inT && /أجور المرتجع: \$2\.00 \(الشركة\)/.test(card.t), 'مرتجعٌ قديم (قبل المراحل) ⇐ «بالطريق إلينا» بأجوره المسجّلة: ' + JSON.stringify(card).slice(0, 300));
  // ⑧ التقرير
  await ans({}, []); await pg.evaluate(() => returnsReport()); await sleep(200);
  const rep = await pg.evaluate(() => (window.__asked.find(x => typeof x === 'string' && /^alert:/.test(x)) || ''));
  ok(/المرتجعات: 4/.test(rep) && /حسب المرحلة/.test(rep) && /✅ استلمناه: 3/.test(rep) && /\$206\.00/.test(rep) && /درعا: 1/.test(rep), '«📊 تقرير المرتجعات»: المراحل والأجور (بالدولار المكافئ) ومن دفع: ' + rep.slice(6, 120));
  // ⑨ إعادة الشحن
  await ans({}, []); await pg.evaluate(id => orderReship(id), idOf('زبون رفض')); await sleep(600);
  d = await dump(); o1 = d.gmt_orders.find(o => o.id === idOf('زبون رفض')); r1 = RI(o1);
  ok(o1.status === 'pending' && !o1.tracking_number && r1.history.length === 1 && r1.history[0].cost === 25000 && r1.history[0].reshipped_at, '«🔁 إعادة الشحن» ⇒ قيد التجهيز ويبقى سجلّ المرتجع');
  await pg.evaluate(() => switchTab('pending')); await sleep(300);
  ok(/أُعيد شحنه/.test(await pg.evaluate(id => (document.querySelector('#section-pending #card-' + id) || {}).innerText || '', idOf('زبون رفض'))), 'بطاقته في «قيد التجهيز» تذكر المرتجع السابق');
  let real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  // ⑩ من الفاتورة (نقطة البيع ⇐ orders.html?return=…&inv=…): نافذة «مرتجع جديد» والفاتورة معبّأة
  const b2 = await H.open('orders.html?return=' + idOf('زبون رابط') + '&inv=INV-5&inv_id=55555555-5555-5555-5555-555555555555', { w: 390, h: 844, mobile: true, wait: 5000, init: H.ADMIN_INIT });
  await b2.pg.waitForFunction(() => [...document.querySelectorAll('input')].some(i => i.value === 'INV-5'), null, { timeout: 15000 }).catch(() => {});
  const dl = await b2.pg.evaluate(() => ({ t: document.body.innerText.includes('مرتجع جديد'), inv: [...document.querySelectorAll('input')].some(i => i.value === 'INV-5') }));
  ok(dl.t && dl.inv, 'من الفاتورة: تُفتح «↩️ مرتجع جديد» للأوردر المرتبط والفاتورة INV-5 معبّأة');
  await b2.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
