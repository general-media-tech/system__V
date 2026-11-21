// (TASK-A0539 · المالك seq 916) «زرّ إدخال إيصالات … بدون ما أحدّد كلّ واحد لمين … لحالهم بيتوزّعوا وبينشحنوا»
// القراءة نفسها (GMTReceipt) مُحاكاة بنتائج معروفة — المفحوص هنا: المطابقة والشحن والتراجع والتبليغ.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dump = () => H.call('/__dump', undefined, 'GET');
const fs = require('fs'), path = require('path');
(async () => {
  await H.seed();
  const base = { qty: 1, branch: 'حلب', product: 'كاميرا', price: 100, shipping_company: null, tracking_number: null };
  const rows = await H.call('/rest/v1/gmt_orders', [
    Object.assign({ name: 'محمد خالد العلي', phone: '0933111222', status: 'pending', serial_code: 'ORD-1' }, base),
    Object.assign({ name: 'سارة يوسف', phone: '0944222333', status: 'prepared', serial_code: 'ORD-2' }, base),
    Object.assign({ name: 'أحمد حسن', phone: '0955333444', status: 'pending', serial_code: 'ORD-3' }, base),
    Object.assign({ name: 'أحمد حسين', phone: '0966444555', status: 'pending', serial_code: 'ORD-4' }, base),
    Object.assign({}, base, { name: 'قديم مشحون', phone: '0977555666', status: 'shipped', serial_code: 'ORD-5', tracking_number: '700005', shipping_company: 'المفتي' })]);
  const idOf = n => rows.find(r => r.name === n).id;
  const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, mobile: true, wait: 5000 });
  // محاكاة القارئ: اسم الملف يحدّد نتيجة القراءة
  await pg.evaluate(() => {
    const R = {
      'a.png': { number: '700001', text: 'المرسل اليه: محمد العلي الموبايل 0933111222', receiver: 'محمد العلي' },   // بالهاتف
      'b.png': { number: '700002', text: 'المرسل اليه سارة يوسف', receiver: 'ساره يوسف' },                         // بالاسم
      'c.png': { number: '700003', text: 'المرسل اليه احمد حسن', receiver: 'احمد حسن' },                           // ملتبس (حسن/حسين)
      'd.png': { number: '700005', text: 'x', receiver: 'قديم' },                                                   // رقمٌ على أوردرٍ آخر
      'e.png': { number: '', text: '', receiver: '' } };                                                            // بلا رقم
    window.GMTReceipt = Object.assign(window.GMTReceipt || {}, {
      warm() {}, _receiverOf: () => '',
      readMufti: async f => { const x = R[f.name]; return { tracking: x.number ? { status: 'match', number: x.number } : { status: 'none' }, text: x.text, allDigits: [], type: { kind: 'mufti' }, company: 'المفتي', branch: { key: null, confident: false }, _rec: x.receiver }; },
      readReceiver: async f => R[f.name].receiver });
    window.shipFromDefault = () => ({ key: 'haleb_main', why: '' });
    window.openWhatsAppChat = () => ({}); window.__wa = 0; const o = window.openShipNotice; window.openShipNotice = (x, a) => { window.__wa++; };
  });
  await pg.evaluate(() => rcptBatchOpen()); await sleep(300);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  const dir = path.join(__dirname, '_rb'); fs.mkdirSync(dir, { recursive: true });
  const files = ['a.png', 'b.png', 'c.png', 'd.png', 'e.png'].map(n => { const p = path.join(dir, n); fs.writeFileSync(p, png); return p; });
  await pg.setInputFiles('[data-rb-files]', files);
  await pg.waitForFunction(() => !_rb.busy && _rb.items.length === 5 && _rb.items.every(x => x.st !== 'wait' && x.st !== 'read'), null, { timeout: 30000 });
  const st = await pg.evaluate(() => _rb.items.map(x => x.file.name + ':' + x.st + (x.order ? '>' + x.order.serial_code : '')));
  ok(st[0] === 'a.png:shipped>ORD-1', 'إيصال هاتفه ظاهر ⇒ يُشحن وحده لأوردره: ' + st[0]);
  ok(st[1] === 'b.png:shipped>ORD-2', 'اسمٌ مطابق بوضوح (ساره ≈ سارة) ⇒ يُشحن وحده: ' + st[1]);
  ok(st[2] === 'c.png:pick', 'اسمان متقاربان (حسن/حسين) ⇒ لا شحن تلقائي — «اختر الأوردر»: ' + st[2]);
  ok(st[3] === 'd.png:dup' && st[4] === 'e.png:nonum', 'رقمٌ على أوردرٍ آخر ⇒ لا يُعتمد · بلا رقم ⇒ يُقال: ' + st.slice(3).join(' '));
  let d = await dump(); const o1 = d.gmt_orders.find(o => o.id === idOf('محمد خالد العلي')), o2 = d.gmt_orders.find(o => o.id === idOf('سارة يوسف'));
  ok(o1.status === 'shipped' && o1.tracking_number === '700001' && o1.shipping_company === 'المفتي' && o1.shipped_at && o1.receipt_img && o1.receipt_meta && o1.receipt_meta.via === 'batch' && o1.receipt_meta.match.how === 'phone' && o1.ship_from_office === 'haleb_main',
    'الشحن بالمسار نفسه: الحالة · الرقم · الشركة · الإيصال وبياناته (via batch · بالهاتف) · الفرع المُرسِل');
  ok(o2.status === 'shipped' && o2.tracking_number === '700002', 'الثاني شُحن برقمه');
  // الاختيار بضغطة للملتبس
  const cands = await pg.evaluate(() => _rb.items[2].match.cands.map(c => c.serial_code));
  ok(cands.indexOf('ORD-3') >= 0 && cands.indexOf('ORD-4') >= 0, 'المرشّحون يُعرضون: ' + cands.join(','));
  await pg.evaluate(id => rbPick(_rb.items[2].k, id), idOf('أحمد حسن')); await sleep(800);
  d = await dump(); ok(d.gmt_orders.find(o => o.id === idOf('أحمد حسن')).tracking_number === '700003', 'ضغطة على المرشّح ⇒ يُشحن');
  // التراجع
  await pg.evaluate(() => rbUndo(_rb.items[1].k)); await sleep(800);
  d = await dump(); const u = d.gmt_orders.find(o => o.id === idOf('سارة يوسف'));
  ok(u.status === 'prepared' && !u.tracking_number && !u.shipped_at, '«↩️ تراجع» يعيد الأوردر كما كان (محضّرة · بلا رقم)');
  // التبليغ: ضغطة لكلّ زبون
  const nb = await pg.evaluate(() => { const b = document.querySelector('[data-rb-notify]'); const t1 = b.textContent; rbNotifyNext(); rbNotifyNext(); rbNotifyNext(); return { t1, wa: window.__wa, vis: b.style.display }; });
  ok(/2 باقٍ/.test(nb.t1) && nb.wa === 2 && nb.vis === 'none', '«📲 بلّغ التالي»: زبونٌ لكلّ ضغطة حتى ينتهوا: ' + JSON.stringify(nb));
  const btn = await pg.evaluate(() => !!document.querySelector('[data-rcpt-batch]'));
  ok(btn, 'زرّ «📥 إدخال إيصالات» في صفحة الأوردرات');
  const real = errs.filter(e => !/Failed to load resource|status of (400|401|404)/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close(); fs.rmSync(dir, { recursive: true, force: true });
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
