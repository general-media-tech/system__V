// (المالك seq 618/620/624/625 · التدقيق العدائي · إدارة نقاط البيع) تحصيل ديون فواتير الآجل والعمولة اليدوية:
// مبلغ أكبر من المتبقّي · صفر/سالب · تحصيلان معاً · تحصيل فاتورة محصَّلة · عمولة صفر/سالبة/ثانية فوق مسجَّلة · عمولة أكبر من الفاتورة.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.011;
const invById = async id => ((await dump()).invoices || []).find(i => String(i.id) === String(id));
(async () => {
  await H.seed();
  const now = new Date().toISOString();
  const inv = await H.call('/rest/v1/invoices', [
    { inv_number: 'D-1', branch_key: 'daraa', branch_name: 'درعا', total: 300, paid_amount: 100, remaining_amount: 200, payment_status: 'partial', sale_type: 'آجل (شحن)', customer_name: 'مدين 1', customer_phone: '0944111000', cashier_name: 'سامر', created_at: now },
    { inv_number: 'D-2', branch_key: 'daraa', branch_name: 'درعا', total: 150, paid_amount: 0, remaining_amount: 150, payment_status: 'unpaid', sale_type: 'آجل (شحن)', customer_name: 'مدين 2', customer_phone: '0944111001', cashier_name: 'سامر', created_at: now },
    { inv_number: 'C-1', branch_key: 'daraa', branch_name: 'درعا', total: 100, paid_amount: 100, remaining_amount: 0, payment_status: 'paid', sale_type: 'نقدي', customer_name: 'نقدي', cashier_name: 'سامر', created_at: now }]);
  const { browser, pg, errs } = await H.open('admin_pos.html', { init: H.ADMIN_INIT, w: 1200, h: 900, wait: 7000, mobile: false });
  await pg.evaluate(() => { window.GMTAsk = Object.assign(window.GMTAsk || {}, { confirm: async () => true }); });
  const collect = (id, amt) => pg.evaluate(([id, amt]) => applyInvoiceCollection(id, amt).then(r => ({ ok: true, r })).catch(e => ({ ok: false, e: String(e && e.message || e) })), [id, amt]);

  // ① حدود المبلغ
  for (const v of [0, -50, NaN, 200.5, 1e9]) {
    const r = await collect(inv[0].id, v); const f = await invById(inv[0].id);
    ok(!r.ok && near(f.paid_amount, 100) && near(f.remaining_amount, 200), 'تحصيل ' + v + ' على متبقٍّ 200 ⇒ مرفوض بلا أيّ تغيير (' + (r.e || 'قُبل!').slice(0, 60) + ')');
  }
  // ② جزئي سليم ثمّ الباقي
  let r = await collect(inv[0].id, 50.25); let f = await invById(inv[0].id);
  ok(r.ok && near(f.paid_amount, 150.25) && near(f.remaining_amount, 149.75) && f.payment_status === 'partial', 'تحصيل جزئي 50.25 ⇒ مقبوض 150.25 · متبقٍّ 149.75 · جزئي');
  r = await collect(inv[0].id, 149.75); f = await invById(inv[0].id);
  ok(r.ok && r.r.complete && near(f.paid_amount, 300) && near(f.remaining_amount, 0) && f.payment_status === 'paid', 'تحصيل الباقي 149.75 ⇒ مدفوعة · المقبوض = الإجمالي 300');
  r = await collect(inv[0].id, 1); f = await invById(inv[0].id);
  ok(!r.ok && near(f.paid_amount, 300), 'تحصيل فاتورة محصَّلة بالكامل ⇒ مرفوض (' + (r.e || '').slice(0, 50) + ')');
  // ③ تحصيلان كاملان في اللحظة نفسها
  const two = await pg.evaluate(id => Promise.all([applyInvoiceCollection(id, 150).then(() => 'ok').catch(e => 'x:' + e.message), applyInvoiceCollection(id, 150).then(() => 'ok').catch(e => 'x:' + e.message)]), inv[1].id);
  f = await invById(inv[1].id);
  ok(two.filter(x => x === 'ok').length === 1 && near(f.paid_amount, 150) && near(f.remaining_amount, 0), 'تحصيلان كاملان معاً (150 + 150 على دين 150) ⇒ واحدٌ ينجح والمقبوض 150 لا 300: ' + JSON.stringify(two.map(x => x.slice(0, 40))) + ' · ' + f.paid_amount);
  // ④ فاتورة نقدية مدفوعة
  r = await collect(inv[2].id, 10); f = await invById(inv[2].id);
  ok(!r.ok && near(f.paid_amount, 100), 'تحصيل على فاتورة نقدية مدفوعة ⇒ مرفوض');
  // ⑤ فاتورة غير موجودة
  r = await collect('999999', 10);
  ok(!r.ok, 'تحصيل فاتورة غير موجودة ⇒ مرفوض (' + (r.e || '').slice(0, 40) + ')');

  // ⑥ العمولة اليدوية
  const commOf = async id => ((await dump()).invoice_commissions || []).filter(c => String(c.invoice_id) === String(id));
  const setComm = (id, v) => pg.evaluate(([id, v]) => { let a = document.getElementById('comm-amount-' + id); if (!a) { a = document.createElement('input'); a.id = 'comm-amount-' + id; document.body.appendChild(a); const n = document.createElement('input'); n.id = 'comm-note-' + id; document.body.appendChild(n); } a.value = String(v); return saveCommission(id, 'daraa'); }, [id, v]);
  for (const v of [0, -10, 'abc']) { await setComm(inv[2].id, v); await pg.waitForTimeout(400); ok((await commOf(inv[2].id)).length === 0, 'عمولة يدوية «' + v + '» ⇒ مرفوضة'); }
  await pg.evaluate(() => { window.__asked = 0; GMTAsk.confirm = async m => { window.__asked++; window.__askMsg = String(m); return false; }; });   // الأدمن يقول «لا»
  await setComm(inv[2].id, 5000); await pg.waitForTimeout(900);
  ok(await pg.evaluate(() => window.__asked === 1 && /أكبر من إجمالي الفاتورة/.test(window.__askMsg)), 'عمولة 5000$ على فاتورة 100$ ⇒ يسأل «أكبر من إجمالي الفاتورة — هل الرقم صحيح؟»');
  let cs = await commOf(inv[2].id);
  ok(cs.length === 0, 'عمولة 5000$ على فاتورة 100$ ⇒ لا تُحفظ بلا تأكيد (' + (cs[0] ? 'حُفظت ' + cs[0].amount : 'لم تُحفظ') + ')');
  if (cs.length) await H.call('/rest/v1/invoice_commissions?id=eq.' + cs[0].id, undefined, 'DELETE').catch(() => {});
  await pg.evaluate(() => { try { allComm = allComm.filter(c => Number(c.amount) !== 5000); } catch (_) {} });
  await pg.evaluate(() => { GMTAsk.confirm = async () => true; });
  await setComm(inv[2].id, 8); await pg.waitForTimeout(900);
  await pg.evaluate(id => Promise.all([0, 1].map(() => { const a = document.getElementById('comm-amount-' + id); a.value = '8'; return saveCommission(id, 'daraa'); })), inv[2].id); await pg.waitForTimeout(900);
  cs = await commOf(inv[2].id);
  ok(cs.length === 1 && near(cs[0].amount, 8), 'عمولة 8$ ثمّ حفظان آخران معاً ⇒ صفٌّ واحد فقط (لا عمولة ثانية فوق المسجَّلة): ' + cs.length);

  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
