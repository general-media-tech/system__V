// (TASK-A0539/A0540 · المالك seq 916 · 923–924) «أرفع الإيصالات ⇒ واحداً تلو الآخر يعطيني إنّ هذا الإيصال لهذا الشخص — نفس شاشة
// المراجعة لما بعطيه إرسال للشحن ⇒ ثمّ إرسال الشحن والتبليغ». القراءة (GMTReceipt) والماسح (shipScanFile) مُحاكاة.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dump = () => H.call('/__dump', undefined, 'GET');
const fs = require('fs'), path = require('path');
(async () => {
  await H.seed();
  const base = { qty: 1, branch: 'حلب', product: 'كاميرا', price: 100, shipping_company: null, tracking_number: null };
  const rows = await H.call('/rest/v1/gmt_orders', [
    Object.assign({}, base, { name: 'محمد خالد العلي', phone: '0933111222', status: 'pending', serial_code: 'ORD-1' }),
    Object.assign({}, base, { name: 'سارة يوسف', phone: '0944222333', status: 'prepared', serial_code: 'ORD-2' }),
    Object.assign({}, base, { name: 'أحمد حسن', phone: '0955333444', status: 'pending', serial_code: 'ORD-3' }),
    Object.assign({}, base, { name: 'أحمد حسين', phone: '0966444555', status: 'pending', serial_code: 'ORD-4' }),
    Object.assign({}, base, { name: 'قديم مشحون', phone: '0977555666', status: 'shipped', serial_code: 'ORD-5', tracking_number: '700005', shipping_company: 'المفتي' })]);
  const idOf = n => rows.find(r => r.name === n).id;
  const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, mobile: true, wait: 5000 });
  await pg.evaluate(() => {
    const R = { 'a.png': ['700001', 'المرسل اليه محمد العلي الموبايل 0933111222', 'محمد العلي'], 'b.png': ['700002', 'المرسل اليه سارة يوسف', 'ساره يوسف'],
                'c.png': ['700003', 'احمد حسن', 'احمد حسن'], 'd.png': ['700005', 'x', 'قديم'], 'e.png': ['', '', ''], 'f.png': ['700006', 'احمد حسين', 'احمد حسين'] };
    window.GMTReceipt = Object.assign(window.GMTReceipt || {}, { warm() {}, _receiverOf: () => '',
      readMufti: async f => { const x = R[f.name]; await new Promise(z => setTimeout(z, /^[cde]/.test(f.name) ? 1200 : 60)); return { tracking: x[0] ? { status: 'match', number: x[0] } : { status: 'none' }, text: x[1], allDigits: [], type: { kind: 'mufti' }, company: 'المفتي', branch: { key: null, confident: false } }; },
      readReceiver: async f => R[f.name][2] });
    window.__scan = []; window.__wa = 0;
    /* الماسح: يسجّل الملف ويملأ الرقم كما تفعل القراءة الحقيقية في الشاشة */
    window.shipScanFile = async (file) => { window.__scan.push(file.name); _shipScan = { scanned: file, mode: 'auto' }; document.getElementById('ship-tracking').value = R[file.name][0]; };
    window.openShipNotice = () => { window.__wa++; };
    const sel = document.getElementById('ship-from'); if (sel && ![...sel.options].some(o => o.value === 'haleb_main')) { const op = document.createElement('option'); op.value = 'haleb_main'; op.textContent = 'حلب الرئيسي'; sel.appendChild(op); }
    window.__pickFrom = () => { const s = document.getElementById('ship-from'); if (![...s.options].some(o => o.value === 'haleb_main')) { const op = document.createElement('option'); op.value = 'haleb_main'; op.textContent = 'حلب الرئيسي'; s.appendChild(op); } s.value = 'haleb_main'; };
  });
  await pg.evaluate(() => rcptBatchOpen()); await sleep(200);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  const dir = path.join(__dirname, '_rb'); fs.mkdirSync(dir, { recursive: true });
  const files = ['a.png', 'b.png', 'c.png', 'd.png', 'e.png'].map(n => { const p = path.join(dir, n); fs.writeFileSync(p, png); return p; });
  await pg.setInputFiles('[data-rb-files]', files);
  const shipOpen = () => pg.evaluate(() => !document.getElementById('shipModal').classList.contains('hidden'));
  const T = () => pg.evaluate(() => ({ title: document.getElementById('ship-title').textContent, banner: document.getElementById('rb-banner').innerText, dis: document.getElementById('ship-confirm-btn').disabled }));
  const confirm = async () => { await pg.evaluate(() => { __pickFrom(); return confirmShipping(); }); await sleep(500); };
  // ① (TASK-A0545 · seq 931) فوراً: الشاشة تُفتح قبل انتهاء القراءة
  await pg.waitForFunction(() => !document.getElementById('shipModal').classList.contains('hidden'), null, { timeout: 3000 });
  let t = await T();
  ok(/أتعرّف على صاحبه/.test(t.title) && /أتعرّف على صاحب الإيصال/.test(t.banner) && t.dis && (await pg.evaluate(() => __scan[0])) === 'a.png', 'رفعتُ الإيصالات ⇒ شاشة المراجعة تُفتح **فوراً** (الماسح والقراءة فيها) و«🔎 أتعرّف على صاحبه…» · الاعتماد مقفل: ' + JSON.stringify(t));
  await pg.waitForFunction(() => /الاقتراح/.test(document.getElementById('rb-banner').innerText), null, { timeout: 8000 });
  t = await T();
  ok(/محمد خالد العلي/.test(t.title) && /هاتفه مكتوب/.test(t.banner) && !t.dis, 'خلال ثوانٍ في الشاشة نفسها: «📌 الاقتراح» (بالهاتف) والعنوان باسمه والاعتماد مفعَّل');
  ok(await pg.evaluate(id => orders.find(o => o.id == id).status, idOf('محمد خالد العلي')) === 'pending', 'لا شحن قبل اعتمادك');
  await pg.evaluate(() => document.querySelector('#rb-banner [data-rb-yes]').click());
  ok(/صحيح/.test((await T()).banner), '«✔ صح» يُثبَّت');
  await confirm();
  let d = await dump(), o1 = d.gmt_orders.find(o => o.id === idOf('محمد خالد العلي'));
  ok(o1.status === 'shipped' && o1.tracking_number === '700001' && o1.receipt_img && (await pg.evaluate(() => __wa)) === 1, '«اعتماد الشحن» ⇒ شُحن برقمه وإيصاله + التبليغ');
  // ② التالي فوراً
  await pg.waitForFunction(() => !document.getElementById('shipModal').classList.contains('hidden') && /إيصال 2/.test(document.getElementById('ship-title').textContent), null, { timeout: 3000 });
  ok(true, 'بعد الاعتماد ⇒ شاشة الإيصال التالي تُفتح فوراً');
  await pg.waitForFunction(() => /سارة يوسف/.test(document.getElementById('ship-title').textContent), null, { timeout: 8000 });
  // ③ إغلاقها بلا شحن ⇒ يبقى بانتظارك
  await pg.evaluate(() => closeModal('shipModal')); await sleep(300);
  const s3 = await pg.evaluate(() => ({ ov: document.getElementById('rb-ov').style.display, b: _rb.items[1].st, held: _rb.items[1].held }));
  ok(s3.ov === 'flex' && s3.b === 'ready' && s3.held, 'إغلاق الشاشة بلا شحن ⇒ النافذة تعود · سارة «جاهز» بانتظارك: ' + JSON.stringify(s3));
  await pg.waitForFunction(() => !_rb.busy, null, { timeout: 20000 }); await sleep(200);
  // ④ الملتبس من النافذة ⇒ شاشته ⇒ اعتماد ⇒ التالي (المكرَّر ثمّ بلا رقم) داخل الشاشة
  await pg.evaluate(id => rbPick(_rb.items.find(x => x.file.name === 'c.png').k, id), idOf('أحمد حسن')); await sleep(300);
  t = await T(); ok(await shipOpen() && /أحمد حسن/.test(t.title) && !t.dis, 'اختيار المرشّح ⇒ شاشة شحن أوردره');
  await confirm();
  d = await dump(); ok(d.gmt_orders.find(o => o.id === idOf('أحمد حسن')).tracking_number === '700003' && d.gmt_orders.find(o => o.id === idOf('أحمد حسين')).status === 'pending', 'شُحن المختار وحده');
  ok(await pg.evaluate(() => _rb.items.find(x => x.file.name === 'd.png').st) === 'dup', 'رقمٌ مسجَّل على أوردرٍ آخر ⇒ «⛔ مكرَّر» في القائمة ولا تُفتح له شاشة شحن');
  await pg.waitForFunction(() => /لمن هذا الإيصال/.test(document.getElementById('rb-banner').innerText), null, { timeout: 5000 });
  t = await T(); ok(t.dis && !!(await pg.evaluate(() => document.querySelector('#rb-banner [data-rb-search]'))), 'بلا رقم ولا اسم ⇒ «👆 لمن هذا الإيصال؟» + بحث داخل الشاشة · الاعتماد مقفل');
  await pg.evaluate(() => [...document.querySelectorAll('#rb-banner button')].pop().click()); await sleep(400);   // تخطَّ
  // ⑤ المؤجَّل (سارة) ⇒ «افتح شاشة الشحن» ⇒ اعتماد ⇒ «انتهت»
  await pg.waitForFunction(() => document.getElementById('rb-ov').style.display === 'flex' && document.querySelector('[data-rb-open]'), null, { timeout: 5000 });
  await pg.evaluate(() => document.querySelector('[data-rb-open]').click()); await sleep(300);
  ok(await shipOpen() && /سارة يوسف/.test((await T()).title), '«🧾 افتح شاشة الشحن» للمؤجَّل');
  await confirm(); await sleep(300);
  d = await dump();
  const end = await pg.evaluate(() => ({ wa: __wa, done: /انتهت/.test((document.querySelector('[data-rb-focus]') || {}).innerText || ''), ov: document.getElementById('rb-ov').style.display }));
  ok(d.gmt_orders.find(o => o.id === idOf('سارة يوسف')).tracking_number === '700002' && end.wa === 3 && end.done && end.ov === 'flex', 'الكلّ شُحن وبُلّغ · «✅ انتهت الإيصالات»: ' + JSON.stringify(end));
  // ⑥ «✖ لا» داخل الشاشة نفسها ⇒ «لمن؟» بلا الخاطئ + بحث · بلا إغلاق ولا شحن
  const pf = path.join(dir, 'f.png'); fs.writeFileSync(pf, png);
  await pg.setInputFiles('[data-rb-files]', [pf]);
  await pg.waitForFunction(() => /أحمد حسين/.test(document.getElementById('ship-title').textContent) && document.querySelector('#rb-banner [data-rb-no]'), null, { timeout: 10000 });
  await pg.evaluate(() => document.querySelector('#rb-banner [data-rb-no]').click()); await sleep(200);
  const wr = await pg.evaluate(id => ({ open: !document.getElementById('shipModal').classList.contains('hidden'), b: document.getElementById('rb-banner').innerText, excl: [...document.querySelectorAll('#rb-banner [data-rb-pick]')].some(x => /أحمد حسين/.test(x.textContent)), search: !!document.querySelector('#rb-banner [data-rb-search]'), dis: document.getElementById('ship-confirm-btn').disabled, st: orders.find(o => o.id == id).status }), idOf('أحمد حسين'));
  ok(wr.open && /لمن هذا الإيصال/.test(wr.b) && !wr.excl && wr.search && wr.dis && wr.st === 'pending', '«✖ لا» ⇒ في الشاشة نفسها «لمن؟» بلا المقترح الخاطئ + بحث · الاعتماد مقفل · لا شحن');
  await pg.evaluate(() => { const i = document.querySelector('#rb-banner [data-rb-search]'); i.value = '0944'; i.dispatchEvent(new Event('input')); }); await sleep(150);
  ok(await pg.evaluate(() => document.querySelector('#rb-banner [data-rb-found]').innerText.trim().length > 0), 'البحث بالهاتف داخل الشاشة يعمل');
  ok(await pg.evaluate(() => { const c = document.querySelector('[data-rcpt-cam]'), f = document.querySelector('[data-rcpt-files]'); return !!(c && f); }), 'زرّا «📷 صوّر إيصال» و«🖼️ ارفع إيصالات» في صفحة الأوردرات');
  // الشاشة العادية (من بطاقة أوردر) لا تبقى مقفلة
  await pg.evaluate(() => { closeModal('shipModal'); }); await sleep(200);
  ok(await pg.evaluate(id => { openShipModal(id); const r = { dis: document.getElementById('ship-confirm-btn').disabled, ban: document.getElementById('rb-banner').classList.contains('hidden') }; closeModal('shipModal'); return !r.dis && r.ban; }, idOf('أحمد حسين')), 'شاشة الشحن العادية: بلا شريط الاقتراح والاعتماد مفعَّل');
  const real = errs.filter(e => !/Failed to load resource|status of (400|401|404)/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close(); fs.rmSync(dir, { recursive: true, force: true });
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
