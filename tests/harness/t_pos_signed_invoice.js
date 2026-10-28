// (TASK-0237 · المالك seq 164) «من هنا … كادمن داخل على نقطه البيع يمكن ايضا اضافه منتجات مي موجوده … بتتصدر عندك فاتوره كفاتوره تسويه
// او فاتوره نقل وبتتعامل نفس المعامله · يعني اي فاتوره نقل او تسويه او جرد فيها تاكيد من المستخدم وتوقيع»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = async () => H.call('/__dump', undefined, 'GET');
(async () => {
  await H.seed();
  const [P1] = await H.call('/rest/v1/products', [{ name: 'Canon 50mm', barcode: 'SG1', price: 120, wholesale_price: 90, haleb: 10, daraa: 5 }]);
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 6000 });
  // ① نافذة التوقيع الحقيقية: لا تأكيد قبل الاسم + التوقيع + «أؤكّد»
  await pg.evaluate(() => { window.__sig = GMTSignPad.ask({ title: 'فاتورة تسوية «درعا»', summary: 'منتج واحد', name: '' }); });
  await pg.waitForSelector('#gmt-sign canvas', { timeout: 5000 });
  const st0 = await pg.evaluate(() => document.querySelector('#gmt-sign [data-sg-go]').disabled);
  await pg.fill('#gmt-sign [data-sg-name]', 'سامر الأحمد');
  const box = await pg.$eval('#gmt-sign canvas', c => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const st1 = await pg.evaluate(() => document.querySelector('#gmt-sign [data-sg-go]').disabled);
  await pg.mouse.move(box.x + 30, box.y + 40); await pg.mouse.down();
  for (let i = 1; i <= 12; i++) await pg.mouse.move(box.x + 30 + i * 18, box.y + 40 + (i % 2 ? 30 : -10));
  await pg.mouse.up();
  const st2 = await pg.evaluate(() => document.querySelector('#gmt-sign [data-sg-go]').disabled);
  await pg.click('#gmt-sign [data-sg-ok]');
  const st3 = await pg.evaluate(() => document.querySelector('#gmt-sign [data-sg-go]').disabled);
  await pg.click('#gmt-sign [data-sg-go]');
  const sig = await pg.evaluate(async () => { const s = await window.__sig; return s && { name: s.name, size: s.blob && s.blob.size, png: /^data:image\/png/.test(s.dataUrl) }; });
  ok(st0 && st1 && st2 && !st3, 'الزرّ معطّل حتى: الاسم ✓ + التوقيع ✓ + «أؤكّد» ✓: ' + JSON.stringify([st0, st1, st2, st3]));
  ok(sig && sig.name === 'سامر الأحمد' && sig.size > 200 && sig.png, 'يعيد الاسم وصورة التوقيع (PNG): ' + JSON.stringify(sig));
  // ② منتجٌ غير معرَّف ⇒ فاتورة تسوية فوراً · موقَّعة · بالكلمة السيادية
  await pg.evaluate(() => { GMTRole.grant('المالك'); openStockCount(); });
  const r2 = await pg.evaluate(async () => {
    const choices = [];
    GMTAsk.form = async (m, o) => (await o.submit({ name: 'حامل جديد', barcode: 'NEW-SG', price: '25', qty: '3' })).result;
    GMTAsk.choose = async (m, o) => { choices.push((o.choices || []).map(x => x.t)); return 'local'; };
    GMTSignPad.ask = async (o) => { window.__signSum = o.summary; window.__signTitle = o.title; return { name: 'سامر الأحمد', blob: new Blob(['x']), at: new Date().toISOString() }; };
    GMTSignPad.upload = async () => 'https://sig.example/np.png';
    GMTAuth.ask = async k => { window.__pw = k; return true; };
    GMTAsk.alert = async m => { window.__alert = String(m); };
    await scNewProduct();
    return { choices, title: window.__signTitle, sum: window.__signSum, pw: window.__pw, alert: window.__alert };
  });
  await pg.waitForTimeout(500);
  let d = await dump();
  const np = d.products.find(p => p.name === 'حامل جديد');
  const tr = d.branch_stock_transfers.find(t => (d.stock_transfer_items.find(i => i.transfer_id === t.id && i.product_id === (np || {}).id)));
  ok(r2.choices[0] && /فاتورة تسوية/.test(r2.choices[0][0]) && /فاتورة نقل/.test(r2.choices[0][1]) && /لاحقاً/.test(r2.choices[0][2] || ''), 'إضافة منتج ⇒ سؤال: فاتورة تسوية · فاتورة نقل · لاحقاً: ' + JSON.stringify(r2.choices[0]));
  ok(np && np.daraa === 3 && tr && tr.status === 'received' && tr.signature_url === 'https://sig.example/np.png' && tr.received_by === 'سامر الأحمد' && /فاتورة تسوية/.test(tr.note || '') && r2.pw === 'sovereign',
    'صدرت فوراً فاتورة تسوية موقَّعة (الكلمة السيادية) والكمّية طُبّقت: ' + JSON.stringify(tr && { n: tr.transfer_number, s: tr.status, sig: tr.signature_url, by: tr.received_by, q: np && np.daraa }));
  ok(/فاتورة تسوية «/.test(r2.title || '') && /حامل جديد: 0 ⇐ 3/.test(r2.sum || '') && /صدرت|تسوية/.test(r2.alert || ''), 'التوقيع على ملخّص الفاتورة نفسها: ' + JSON.stringify(r2.sum));
  // ③ تقرير الجرد: موقَّع (الاسم والتوقيع في التقرير)
  const r3 = await pg.evaluate(async id => {
    scSetCount(id, '4');
    GMTSignPad.ask = async (o) => { window.__repT = o.title; return { name: 'سامر الأحمد', blob: new Blob(['x']), at: '2026-10-28T10:00:00Z' }; };
    GMTSignPad.upload = async () => 'https://sig.example/rep.png';
    window.__tg = ''; const _st = window.sendTelegram; window.sendTelegram = async t => { window.__tg = t; };
    await scFinishAndReport();
    return { t: window.__repT, tg: window.__tg };
  }, P1.id);
  await pg.waitForTimeout(500);
  d = await dump();
  const sc = (d.stock_counts || []).slice(-1)[0];
  const det = sc && (typeof sc.details === 'string' ? JSON.parse(sc.details) : sc.details);
  ok(/تقرير جرد/.test(r3.t || '') && det && det.signed_by === 'سامر الأحمد' && det.signature_url === 'https://sig.example/rep.png' && Array.isArray(det.items) && det.items.some(i => i.diff === -1) && /وقّعه/.test(r3.tg || ''),
    'تقرير الجرد ⇒ تأكيد وتوقيع: التوقيع في السجلّ وفي التبليغ: ' + JSON.stringify(det && { by: det.signed_by, n: det.items.length }));
  // ④ رجوع من التوقيع ⇒ لا شيء يُصدَر
  const before = (await dump()).branch_stock_transfers.length;
  await pg.evaluate(async () => { openStockCount(); GMTAsk.form = async (m, o) => (await o.submit({ name: 'منتج ثانٍ', barcode: '', price: '', qty: '2' })).result; GMTAsk.choose = async () => 'local'; GMTSignPad.ask = async () => null; await scNewProduct(); });
  ok((await dump()).branch_stock_transfers.length === before, '«رجوع» من التوقيع ⇒ لا فاتورة');
  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
