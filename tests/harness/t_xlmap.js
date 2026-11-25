// TASK-B0564 · A989–A991 م١ · seq B1102 — «النظام يتعلّم شكل ملف كلّ مورّد» (بلا ذكاء اصطناعي)
const H = require('./h.js'), path = require('path');
global.window = globalThis; const X = require('../../gmt-xlmap.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const PI = [['PROFORMA INVOICE'], ['Seller'], [], ['No.', 'Picture', 'Item No.', 'Description', 'QTY (PCS)', 'Unit Price (USD)', 'Amount (USD)', 'Remark']];
  const c = X.mapCols(PI[3]);
  ok(X.findHeader(PI) === 3, 'يلاقي صفّ العناوين تحت ترويسة الفاتورة (الصف 4)');
  ok(c.name === 3 && c.model === 2 && c.qty === 4 && c.purchase === 5 && c.sale === -1 && c.notes === 7, 'فاتورة PI صينية: الاسم = Description (مو Item No.) · الموديل = Item No. · سعر الشراء = Unit Price · «Amount» مو سعر مبيع: ' + JSON.stringify(c));
  const AR = ['#', 'الصورة', 'اسم المنتج', 'الكمية', 'سعر الشراء', 'الحد الأدنى', 'الجملة', 'المبيع', 'ملاحظات'], ca = X.mapCols(AR);
  ok(ca.name === 2 && ca.qty === 3 && ca.purchase === 4 && ca.min === 5 && ca.whole === 6 && ca.sale === 7 && ca.notes === 8, 'ملفاتنا العربية كما كانت (الجملة ≠ المبيع)');
  const EN = ['Name', 'Qty', 'Cost', 'Wholesale', 'Price'], ce = X.mapCols(EN);
  ok(ce.whole === 3 && ce.sale === 4 && ce.purchase === 2, 'Wholesale ≠ Price (التصادم القديم ما رجع)');
  ok(X.docType([['CTN NO.', 'DESCRIPTION', 'QTY', 'G.W. (KG)', 'MEAS (CBM)']]) === 'packing' && X.docType([['HS CODE', 'Description', 'Duty']]) === 'customs' && X.docType(PI) === 'invoice', 'نوع الملف: باكينج · بيان جمركي · فاتورة');
  ok(X.sig(PI[3]) === X.sig(['No.', 'Picture', 'Item No.', 'Description', 'QTY (PCS)', 'Unit Price (USD)', 'Amount (USD)', 'Remark ']) && X.sig(PI[3]) !== X.sig(AR), 'بصمة الشكل ثابتة لنفس العناوين ومختلفة لغيرها');
  /* الواجهة */
  await H.seed();
  const { browser, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 6000 });
  const read = async f => { await pg.evaluate(() => { try { exRows = []; } catch (_) {} window._exLast = null; }); await pg.setInputFiles('#excel-file', path.join(__dirname, f)); await pg.waitForFunction(() => (typeof exRows !== 'undefined' && exRows.length > 0) || window._toastSeen, null, { timeout: 15000 }).catch(() => {}); await sleep(300); };
  await pg.evaluate(() => { window._toasts = []; const o = window.toast; window.toast = (m, k) => { window._toasts.push(m); window._toastSeen = /باكينج/.test(m); try { o && o(m, k); } catch (_) {} }; });
  await read('xl_pi_supplier.xlsx');
  let R = await pg.evaluate(() => exRows.map(r => [r.name, r.qty, r.netCost, r.notes]));
  ok(R.length === 3 && R[0][0] === 'LED video light 60W' && R[0][1] === 20 && R[0][2] === 15.5 && /موديل: LED-60/.test(R[0][3]) && /with bag/.test(R[0][3]), 'استيراد PI: الاسم والكمية وسعر الشراء صح · الموديل بالملاحظة · صفّ TOTAL انتخطّى: ' + JSON.stringify(R));
  ok(await pg.evaluate(() => /خمّنت الأعمدة/.test((document.getElementById('excel-map-bar') || {}).textContent || '')), 'شريط الأعمدة: «🔎 خمّنت — صحّح إذا لازم»');
  /* تصحيح عمود من المعاينة ⇐ البنود بتنبنى من جديد */
  await pg.evaluate(() => { const s = document.querySelector('[data-xl-field="notes"]'); s.value = '-1'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(200);
  R = await pg.evaluate(() => exRows.map(r => r.notes));
  ok(R[0] === 'موديل: LED-60', 'تصحيح عمود (الملاحظات = ما في) ⇐ البنود اتحدّثت فوراً: ' + JSON.stringify(R));
  await pg.evaluate(() => { document.getElementById('in-supplier') && (document.getElementById('in-supplier').value = 'Shenzhen Test'); });
  await pg.evaluate(() => importExcel()); await sleep(1500);
  const d = await H.call('/__dump', undefined, 'GET'), pf = (d.gmt_import_profiles || [])[0];
  ok(pf && pf.col && pf.col.name === 3 && pf.col.notes === -1 && pf.uses === 1, 'بعد الاستيراد: الشكل انحفظ بـgmt_import_profiles (مع تصحيحك): ' + JSON.stringify(pf && pf.col));
  /* المرّة الجاية: نفس الشكل ⇐ بيعرفه لحاله */
  await pg.reload(); await sleep(6000);
  await pg.evaluate(() => { window._toasts = []; });
  await read('xl_pi_supplier.xlsx');
  ok(await pg.evaluate(() => /عرفت شكل هالملف من قبل/.test((document.getElementById('excel-map-bar') || {}).textContent || '') && exRows[0].notes === 'موديل: LED-60'), 'المرّة التانية: «🧠 عرفت شكل هالملف من قبل» وطبّق تصحيحك لحاله');
  /* ملف باكينج بالغلط ⇐ بيقلّك وين */
  await pg.evaluate(() => { window._toasts = []; window._toastSeen = false; const o = window.toast; window.toast = (m, k) => { window._toasts.push(m); window._toastSeen = /باكينج/.test(m); try { o && o(m, k); } catch (_) {} }; });
  await read('xl_packing_only.xlsx');
  ok(await pg.evaluate(() => window._toasts.some(m => /باكينج ليست مو فاتورة/.test(m)) && !exRows.length), 'ملف باكينج ليست بمكان الفاتورة ⇐ «هاد باكينج — ارفعه من 📦» وما بيدخل بنود');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
