// (دفعة «الجرد والمنتجات» · طابور سونيت) VER-1#REQ-0066 · VER-3#REQ-0282 — صفحة طابعة الملصقات labels.html
//  ١) مقاس 50×30mm (5×3 سم): الاسم + الباركود + رمز QR (رابط المتجر للزبون إن وُجد وإلا الباركود) — يُبنى محلّياً بلا إنترنت
//  ٢) صورة المنتج مصغّرةً في قائمة الاختيار فقط (لا على الملصق المطبوع)
//  ٣) بلا عمودَي image_url/store_url في القاعدة ⇒ تعمل الصفحة بالاستعلام الأدنى
const H = require('./h.js');
let pass = 0, fails = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
(async () => {
  await H.call('/__reset', {});
  await H.call('/__opts', { reject_cols: [] });
  const prods = await H.call('/rest/v1/products', [
    { name: 'منتج أ بصورة ورابط', barcode: '111111', price: 10, image_url: PNG, store_url: 'store.html#product=abc123' },
    { name: 'منتج ب بصورة بلا رابط', barcode: '222222', price: 20, image_url: PNG },
    { name: 'منتج ج بلا صورة', barcode: '333333', price: 30 },
  ]);
  const { browser, pg, errs } = await H.open('labels.html', { w: 1366, h: 900, wait: 3500, mobile: false });
  const ev = (f, a) => pg.evaluate(f, a);

  /* ② المصغّرات في القائمة */
  const th = await ev(() => ({ n: document.querySelectorAll('#tb img.l-thumb').length, rows: document.querySelectorAll('#tb tr').length, w: (document.querySelector('#tb img.l-thumb') || {}).width }));
  ok(th.rows === 3 && th.n === 2, 'مصغّرتان فقط (للمنتجين اللذين لهما صورة) من ٣ أسطر: ' + JSON.stringify(th));
  /* ١) 50×30 */
  const opt = await ev(() => [...document.querySelectorAll('#size option')].map(o => o.value));
  ok(opt.includes('50x30'), 'خيار المقاس 50×30 موجود: ' + opt.join());
  await ev(() => { selectAllShown(); });
  await ev(() => { window.__qrReq = []; const o = GMTSticker.qr; GMTSticker.qr = t => { __qrReq.push(t); return o(t); }; });
  await ev(() => { const s = document.getElementById('size'); s.value = '50x30'; onSizeChange(); });
  await pg.waitForTimeout(1500);
  const lab = await ev(async () => {
    await window._qrReady;
    const L = [...document.querySelectorAll('#labels .label')];
    return {
      n: L.length, w: L[0].style.width, h: L[0].style.height, qrOn: document.getElementById('showQr').checked,
      body: L.map(l => !!l.querySelector('.l-body svg.bc') && !!l.querySelector('.l-body img.l-qr')),
      png: L.map(l => { const i = l.querySelector('img.l-qr'); return i ? /^data:image\/png/.test(i.src) && i.style.visibility !== 'hidden' : false; }),
      thumbOnLabel: document.querySelectorAll('#labels img.l-thumb').length, req: window.__qrReq.slice(),
    };
  });
  ok(lab.n === 3 && lab.w === '50mm' && lab.h === '30mm' && lab.qrOn, '٣ ملصقات بمقاس 50×30mm وخانة QR فُعِّلت تلقائياً: ' + JSON.stringify([lab.n, lab.w, lab.h, lab.qrOn]));
  ok(lab.body.every(Boolean) && lab.png.every(Boolean), 'كلّ ملصق فيه الباركود + QR (صورة PNG محلّية) بجانبه: ' + JSON.stringify(lab.body) + JSON.stringify(lab.png));
  const reqs = lab.req.slice().sort();
  ok(reqs.length === 3 && reqs.some(t => /store\.html#product=abc123$/.test(t) && !/direct=/.test(t)) && reqs.includes('222222') && reqs.includes('333333'), 'محتوى QR: رابط المتجر للزبون (بلا direct) إن وُجد وإلا الباركود: ' + reqs.join(' | '));
  ok(lab.thumbOnLabel === 0, 'الصورة المصغّرة لا تظهر على الملصق المطبوع');
  /* إيقاف QR / الرفيع */
  let n = await ev(() => { document.getElementById('showQr').checked = false; render(); return document.querySelectorAll('#labels img.l-qr').length; });
  ok(n === 0, 'إلغاء QR ⇒ لا رمز على الملصقات');
  n = await ev(() => { document.getElementById('showQr').checked = true; document.getElementById('size').value = 'thin'; render(); return document.querySelectorAll('#labels img.l-qr').length; });
  ok(n === 0, 'المقاس الرفيع (اسم + شريط فقط) لا يحمل QR');
  /* بقيّة المقاسات تعمل كما كانت (QR اختياري) */
  n = await ev(async () => { document.getElementById('size').value = '3'; document.getElementById('showQr').checked = false; render(); return { l: document.querySelectorAll('#labels .label').length, qr: document.querySelectorAll('#labels img.l-qr').length, bc: document.querySelectorAll('#labels svg.bc').length }; });
  ok(n.l === 3 && n.qr === 0 && n.bc === 3, 'مقاس 3 بالصف كما كان: ' + JSON.stringify(n));
  /* انتظار QR قبل الطباعة + صوت الطباعة */
  const pr = await ev(async () => {
    document.getElementById('size').value = '50x30'; document.getElementById('showQr').checked = true; render();
    let printed = 0; window.print = () => { printed++; window.__qrAtPrint = [...document.querySelectorAll('#labels img.l-qr')].filter(i => /^data:/.test(i.src)).length; };
    printNow(); await new Promise(r => setTimeout(r, 800));
    return { printed, qrAtPrint: window.__qrAtPrint, last: GMTSound.last() };
  });
  ok(pr.printed === 1 && pr.qrAtPrint === 3, 'الطباعة تنتظر اكتمال رموز QR (٣ جاهزة لحظة print): ' + JSON.stringify(pr));
  ok(pr.last === 'labelPrint', 'صوت «طباعة ملصقات» عند الطباعة: ' + pr.last);
  await browser.close();

  /* ③ قاعدة بلا العمودين ⇒ استعلام أدنى (يُحاكى برفض أيّ استعلامٍ يذكر image_url/store_url بـ٤٠٠ كما تفعل PostgREST) */
  const b2 = await H.open('labels.html', { w: 1366, h: 900, wait: 3000, mobile: false });
  let tries = 0;
  await b2.pg.route(/\/rest\/v1\/products\?.*(image_url|store_url)/, r => { tries++; r.fulfill({ status: 400, contentType: 'application/json', body: '{"code":"42703","message":"column products.image_url does not exist"}' }); });
  await b2.pg.evaluate(async () => { document.getElementById('tb').innerHTML = ''; await load(); });
  const r2 = await b2.pg.evaluate(() => ({ rows: document.querySelectorAll('#tb tr td input[type=checkbox]').length, thumbs: document.querySelectorAll('#tb img.l-thumb').length, err: /تعذّر/.test(document.getElementById('tb').textContent) }));
  ok(tries === 1 && r2.rows === 3 && r2.thumbs === 0 && !r2.err, 'قاعدةٌ بلا image_url/store_url (٤٠٠) ⇒ استعلامٌ أدنى: القائمة تُحمَّل بلا مصغّرات ولا خطأ: ' + JSON.stringify([tries, r2]));
  await b2.browser.close();

  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 3)));
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
