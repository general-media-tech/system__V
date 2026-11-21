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
  const confirm = async () => { await pg.evaluate(() => { __pickFrom(); return confirmShipping(); }); await sleep(700); };
  // ① أوّل إيصال ⇒ شاشة الشحن نفسها لأوردره · والباقي ما زال يُقرأ
  await pg.waitForFunction(() => !document.getElementById('shipModal').classList.contains('hidden'), null, { timeout: 15000 });
  const s1 = await pg.evaluate(() => ({ title: document.getElementById('ship-title').textContent, scan: __scan.slice(), busy: _rb.busy, ov: document.getElementById('rb-ov').style.display, trk: document.getElementById('ship-tracking').value }));
  ok(/محمد خالد العلي/.test(s1.title) && /1 من 5/.test(s1.title) && s1.scan[0] === 'a.png' && s1.trk === '700001' && s1.busy && s1.ov === 'none',
    'أوّل إيصال ⇒ «شاشة الشحن» نفسها لأوردره (المراجعة) بالإيصال مقروءاً — والقراءة مستمرّة: ' + JSON.stringify(s1));
  ok(await pg.evaluate(id => orders.find(o => o.id == id).status, idOf('محمد خالد العلي')) === 'pending', 'لا شحن قبل اعتمادك');
  // (TASK-A0541 · seq 925) «يقترح الأقرب ويقول لي صح ولا لا بشاشة»
  const bn = await pg.evaluate(() => { const b = document.getElementById('rb-banner'); return { vis: !b.classList.contains('hidden'), t: b.innerText, yes: !!b.querySelector('[data-rb-yes]'), no: !!b.querySelector('[data-rb-no]') }; });
  ok(bn.vis && /الاقتراح/.test(bn.t) && /محمد خالد العلي/.test(bn.t) && /هاتفه مكتوب/.test(bn.t) && bn.yes && bn.no, 'شاشة الشحن: «📌 الاقتراح: هذا الإيصال لـ …» وسببه + «✔ صح» و«✖ لا»');
  await pg.evaluate(() => document.querySelector('#rb-banner [data-rb-yes]').click());
  ok(/صحيح/.test(await pg.evaluate(() => document.getElementById('rb-banner').innerText)), '«✔ صح» يُثبَّت ثمّ الاعتماد');
  await confirm();
  let d = await dump(), o1 = d.gmt_orders.find(o => o.id === idOf('محمد خالد العلي'));
  ok(o1.status === 'shipped' && o1.tracking_number === '700001' && o1.receipt_img && (await pg.evaluate(() => __wa)) === 1, '«اعتماد الشحن» ⇒ شُحن برقمه وإيصاله + التبليغ (المسار القائم)');
  // ② التالي يُفتح وحده
  await pg.waitForFunction(() => /سارة يوسف/.test(document.getElementById('ship-title').textContent) && !document.getElementById('shipModal').classList.contains('hidden'), null, { timeout: 15000 });
  ok(true, 'بعد الاعتماد ⇒ شاشة الإيصال التالي (سارة) تُفتح وحدها');
  // ③ إغلاقها بلا شحن ⇒ تعود النافذة ويبقى بانتظارك
  await pg.evaluate(() => closeModal('shipModal')); await sleep(300);
  await pg.waitForFunction(() => !_rb.busy, null, { timeout: 20000 }); await sleep(200);
  const s3 = await pg.evaluate(() => ({ ov: document.getElementById('rb-ov').style.display, f: (document.querySelector('[data-rb-focus-item]') || {}).getAttribute && document.querySelector('[data-rb-focus-item]').getAttribute('data-rb-focus-item'), st: _rb.items.map(x => x.file.name + ':' + x.st) }));
  ok(s3.ov === 'flex' && s3.st.indexOf('b.png:ready') >= 0 && s3.st.indexOf('d.png:dup') >= 0 && s3.st.indexOf('e.png:pick') >= 0, 'إغلاق الشاشة بلا شحن ⇒ النافذة تعود · سارة «جاهز» · المكرَّر ممنوع · بلا رقم ولا اسم ⇒ «لمن؟»: ' + JSON.stringify(s3.st));
  ok(s3.f === 'pick', 'الملتبس (حسن/حسين) يسأل «لمن هذا الإيصال؟»');
  // ④ الاختيار ⇒ شاشته ⇒ اعتماد
  await pg.evaluate(id => rbPick(_rb.items.find(x => x.st === 'pick' && x.file.name === 'c.png').k, id), idOf('أحمد حسن')); await sleep(300);
  const s4 = await pg.evaluate(() => ({ open: !document.getElementById('shipModal').classList.contains('hidden'), t: document.getElementById('ship-title').textContent }));
  ok(s4.open && /أحمد حسن/.test(s4.t), 'اختيار المرشّح ⇒ شاشة شحن أوردره');
  await confirm();
  d = await dump(); ok(d.gmt_orders.find(o => o.id === idOf('أحمد حسن')).tracking_number === '700003' && d.gmt_orders.find(o => o.id === idOf('أحمد حسين')).status === 'pending', 'شُحن المختار وحده (لا الآخر)');
  // ⑤ المؤجَّل (سارة): «افتح شاشة الشحن» ⇒ اعتماد ⇒ «انتهت»
  await pg.waitForFunction(() => document.getElementById('rb-ov').style.display === 'flex', null, { timeout: 10000 });
  await pg.evaluate(() => rbSkip(_rb.items.find(x => x.file.name === 'e.png').k)); await sleep(200);   // إيصالٌ بلا رقم ولا اسم ⇒ «تخطَّ»
  await pg.waitForFunction(() => document.querySelector('[data-rb-open]'), null, { timeout: 5000 });
  await pg.evaluate(() => document.querySelector('[data-rb-open]').click()); await sleep(300);
  ok(await shipOpen() && /سارة يوسف/.test(await pg.evaluate(() => document.getElementById('ship-title').textContent)), '«🧾 افتح شاشة الشحن» للمؤجَّل');
  await confirm(); await sleep(600);
  d = await dump();
  const end = await pg.evaluate(() => ({ wa: __wa, done: /انتهت/.test((document.querySelector('[data-rb-focus]') || {}).innerText || ''), ov: document.getElementById('rb-ov').style.display }));
  ok(d.gmt_orders.find(o => o.id === idOf('سارة يوسف')).tracking_number === '700002' && end.wa === 3 && end.done && end.ov === 'flex', 'الكلّ شُحن وبُلّغ بضغطة الاعتماد · «✅ انتهت الإيصالات»: ' + JSON.stringify(end));
  // «✖ لا — اختر غيره»: إيصالٌ جديد يُقترح لـ«أحمد حسين» ⇒ لا ⇒ «لمن؟» بلاه + بحث · لا شحن
  const pf = path.join(dir, 'f.png'); fs.writeFileSync(pf, png);
  await pg.setInputFiles('[data-rb-files]', [pf]);
  await pg.waitForFunction(() => !document.getElementById('shipModal').classList.contains('hidden') && /أحمد حسين/.test(document.getElementById('ship-title').textContent), null, { timeout: 15000 });
  await pg.evaluate(() => document.querySelector('#rb-banner [data-rb-no]').click()); await sleep(300);
  const wr = await pg.evaluate(id => ({ modal: !document.getElementById('shipModal').classList.contains('hidden'), ov: document.getElementById('rb-ov').style.display,
    f: (document.querySelector('[data-rb-focus-item]') || { getAttribute: () => '' }).getAttribute('data-rb-focus-item'), excl: [...document.querySelectorAll('[data-rb-focus] [data-rb-pick]')].some(b => /أحمد حسين/.test(b.textContent)),
    search: !!document.querySelector('[data-rb-search]'), st: orders.find(o => o.id == id).status }), idOf('أحمد حسين'));
  ok(!wr.modal && wr.ov === 'flex' && wr.f === 'pick' && !wr.excl && wr.search && wr.st === 'pending', '«✖ لا» ⇒ تُغلق بلا شحن ⇒ «لمن هذا الإيصال؟» بلا المقترح الخاطئ + بحث: ' + JSON.stringify(wr));
  await pg.evaluate(() => { const i = document.querySelector('[data-rb-search]'); i.value = '0944'; i.dispatchEvent(new Event('input')); }); await sleep(150);
  ok(await pg.evaluate(() => document.querySelector('[data-rb-found]').innerText.trim().length > 0), 'البحث بالهاتف يعمل (يعرض نتيجة أو «لا نتيجة»)');
  ok(await pg.evaluate(() => { const c = document.querySelector('[data-rcpt-cam]'), f = document.querySelector('[data-rcpt-files]'); return !!(c && f && c.getBoundingClientRect().width > 100 && /صوّر إيصال/.test(c.textContent) && /ارفع إيصالات/.test(f.textContent)); }), 'زرّا «📷 صوّر إيصال» و«🖼️ ارفع إيصالات» ظاهران في صفحة الأوردرات');
  const real = errs.filter(e => !/Failed to load resource|status of (400|401|404)/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close(); fs.rmSync(dir, { recursive: true, force: true });
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
