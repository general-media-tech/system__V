// (TASK-B0420 · المهمّة ٢) منطق الإشعارات النقيّ: التحقّق من العنوان · التنقية · التجميع · النصوص · التوقيت الهادئ
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  const L = await import('../../tools/push/push_logic.mjs');
  ok(L.validEndpoint('https://fcm.googleapis.com/fcm/send/x') && L.validEndpoint('https://web.push.apple.com/abc') && L.validEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x') && L.validEndpoint('https://par02p.notify.windows.com/w/x'), 'validEndpoint يقبل خوادم الدفع المعروفة');
  ok(!L.validEndpoint('http://fcm.googleapis.com/x') && !L.validEndpoint('https://evil.example/x') && !L.validEndpoint('https://fcm.googleapis.com.evil.example/x') && !L.validEndpoint('x'.repeat(1100)) && !L.validEndpoint(null), 'ويرفض http · مضيفاً غريباً · مضيفاً مموَّهاً · الطويل · الفارغ');
  const s = L.scrub('order', { num: 'ORD-1', qty: 2, phone: '0933', name_customer: 'س', wholesale_price: 5, address: 'ح' });
  ok(JSON.stringify(s) === '{"num":"ORD-1","qty":2}', 'scrub يحذف الهاتف والاسم والجملة والعنوان: ' + JSON.stringify(s));
  const g = L.groupEvents([{ kind: 'price', branch_key: 'homs' }, { kind: 'price', branch_key: null }, { kind: 'transfer', branch_key: 'daraa', topic: 'pos' }, { kind: 'transfer', branch_key: 'homs', topic: 'pos' }, { kind: 'transfer', branch_key: 'daraa', topic: 'pos' }]);
  ok(g.length === 3 && g.find((x) => x.kind === 'price').rows.length === 2 && g.find((x) => x.kind === 'transfer' && x.branch_key === 'daraa').rows.length === 2, 'التجميع: السعر لكلّ الفروع معاً · النقل لكلّ فرع');
  const m1 = L.buildMessage('transfer', [{ data: { num: 'TRF-00015', from: 'حلب' } }]), m2 = L.buildMessage('transfer', [{ data: {} }, { data: {} }, { data: {} }]);
  ok(m1.t === '📦 فاتورة نقل واردة' && m1.b === 'TRF-00015 من حلب — بانتظار استلامك' && m1.u === 'pos.html?go=incoming' && m1.urgency === 'high', 'نقل مفرد: ' + m1.b);
  ok(m2.b === '3 فواتير نقل بانتظار استلامك', 'نقل مجمّع: ' + m2.b);
  const o1 = L.buildMessage('order', [{ data: { num: 'ORD-9', qty: 3 } }], { ref_id: 55 }), o2 = L.buildMessage('order', [{ data: {} }, { data: {} }]);
  ok(o1.b === 'طلب رقم ORD-9 · 3 قطعة — اضغط لفتحه' && o1.u === 'orders.html?order=55' && o2.b === '2 أوردرات جديدة بانتظار التجهيز', 'الأوردر مفرداً ومجمّعاً');
  const of1 = L.buildMessage('offer', [{ data: { name: 'باقة RP', price: 1050, bundle: true } }]), p1 = L.buildMessage('price', [{ data: { name: 'منتج', old: 20, new: 15.5, barcode: '123' } }]), p2 = L.buildMessage('price', [{ data: { name: 'منتج', new: 9, until: '2026-12-05T00:00:00Z' } }]);
  ok(of1.t === '📦 باقة جديدة' && of1.b === '«باقة RP» بـ 1050$', 'باقة جديدة: ' + of1.b);
  ok(p1.b === '20$ ← 15.5$' && p1.u === 'pos.html?go=prices&q=123' && p2.b === 'تخفيض مؤقّت حتى 05/12: 9$', 'السعر: عادي ومؤقّت');
  ok(L.buildMessage('version', [{}]).urgency === 'low' && L.topicOf('transfer', 'daraa') === 'transfer-daraa' && L.topicOf('x'.repeat(50), 'y').length <= 32, 'تحديث منخفض الأولوية · topic ≤ 32');
  // دمشق UTC+3 (شتاءً بعد 2026)؛ نختار تواريخ بعيدة عن التحوّل
  const at = (h, mi) => new Date(Date.UTC(2026, 0, 15, h - 3, mi));
  ok(L.isQuiet(at(23, 30)) && L.isQuiet(at(7, 59)) && !L.isQuiet(at(8, 0)) && !L.isQuiet(at(12, 0)) && L.isQuiet(at(0, 10)), 'التوقيت الهادئ 23:00–08:00 بتوقيت دمشق');
  const nm = L.nextMorning(at(23, 30)); ok(nm.toISOString() === at(8, 30).toISOString().replace('T08:30', 'T08:30') || nm.getTime() - at(23, 30).getTime() === 9 * 3600000, 'nextMorning ⇒ 08:30 التالية (بعد 9 ساعات من 23:30)');
  ok(L.wants({ prefs: { price: false } }, 'price') === false && L.wants({ prefs: {} }, 'price') && L.wants({}, 'order'), 'wants: الغائب مفعّل');
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
