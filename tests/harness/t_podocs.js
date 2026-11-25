// TASK-B0560 · A1004 P6 م٣ · seq B1098 — أرشيف مستندات المشتريات (خاصّ: رفع فقط + رابط موقَّع للأدمن)
const H = require('./h.js');
const PD = require('../../gmt-podocs.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  ok(PD.guessKind('Packing List CN-0008.xlsx') === 'packing' && PD.guessKind('PI-2026-11.pdf') === 'pi' && PD.guessKind('B/L MSKU.pdf') === 'bl' && PD.guessKind('بيان جمركي.pdf') === 'customs' && PD.guessKind('حوالة.jpg') === 'receipt' && PD.guessKind('IMG_1.jpg', 'image/jpeg') === 'photo' && PD.guessKind('Commercial Invoice.pdf') === 'invoice', 'نوع المستند من اسمه (باكينج · PI · بوليصة · جمارك · حوالة · صورة · فاتورة)');
  const p = PD.pathFor('inv-99', 'فاتورة المورّد.PDF', 1700000000000, 'ab12cd');
  ok(/^po\/inv-99\/[a-z0-9]+_ab12cd\.pdf$/.test(p) && /^po\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(p), 'المسار آمن بلا الاسم العربي ويطابق شرط الخادم: ' + p);
  await H.seed();
  await H.call('/rest/v1/import_log', [{ id: 995, inv_number: 'CN-DOC-1', inv_type: 'china', supplier: 'مورد', inv_date: '2026-11-01', status: 'transit', total_amount: 10, items_snapshot: [{ id: 1, name: 'x', qty: 1, unit_price: 10 }], created_at: '2026-11-01T00:00:00Z' }]);
  const { browser, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 6500 });
  const up = [], sign = [];
  await pg.route('**/storage/v1/object/po-docs/**', r => { up.push({ url: r.request().url(), m: r.request().method() }); r.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"ok"}' }); });
  await pg.route('**/functions/v1/gmt-admin', r => { const b = JSON.parse(r.request().postData() || '{}'); sign.push(b); r.fulfill({ status: b.token ? 200 : 401, contentType: 'application/json', body: JSON.stringify(b.token ? { ok: true, url: 'about:blank#signed' } : { ok: false, error: 'auth' }) }); });
  ok(await pg.evaluate(() => !!document.querySelector('[data-podocs-open="995"]')), 'زرّ 📎 على بطاقة الفاتورة');
  await pg.click('[data-podocs-open="995"]'); await sleep(500);
  let t = await pg.evaluate(() => document.querySelector('[data-podocs]').innerText);
  ok(/لسّا ما في مستندات/.test(t) && /فاتورة المورّد \(PI\)/.test(t) && /باكينج ليست/.test(t), 'النافذة: فاضية + شو المطلوب (PI · باكينج · بيان · بوليصة)');
  await pg.setInputFiles('[data-pd-file]', [{ name: 'Packing List.xlsx', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('pk') }, { name: 'فاتورة PI.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') }]);
  await sleep(200);
  ok(await pg.evaluate(() => [...document.querySelectorAll('[data-pd-kind]')].map(s => s.value).join()) === 'packing,pi', 'قبل الرفع: النوع متخمَّن (باكينج · PI) وبيتغيّر');
  await pg.click('[data-pd-up]'); await pg.waitForFunction(() => !document.querySelector('[data-pd-pend]'), null, { timeout: 8000 }).catch(() => {}); await sleep(600);
  const d = await H.call('/__dump', undefined, 'GET'), docs = d.gmt_po_docs || [];
  ok(up.length === 2 && up.every(x => x.m === 'POST' && /\/po-docs\/po\/inv-995\//.test(x.url)) && docs.length === 2 && docs.every(x => +x.invoice_id === 995 && /^po\/inv-995\//.test(x.path)), 'رفع ملفّين للدلو الخاصّ + صفّين بـgmt_po_docs (الاسم الأصلي محفوظ)');
  const L = await pg.evaluate(() => ({ n: document.querySelectorAll('[data-pd-doc]').length, has: [...document.querySelectorAll('[data-pd-has]')].map(x => x.getAttribute('data-pd-has')).join(), txt: document.querySelector('[data-podocs]').textContent }));
  ok(L.n === 2 && /Packing List\.xlsx/.test(L.txt) && /فاتورة PI\.pdf/.test(L.txt) && L.has === 'pi:1,packing:1,customs:0,bl:0', 'القائمة بعد الرفع (2) + «✓» على PI والباكينج · الباقي ناقص: ' + L.has);
  /* الفتح بلا دخول الإدارة ⇒ ممنوع · مع رمز ⇒ رابط موقَّع */
  await pg.evaluate(() => { try { sessionStorage.removeItem('gmt_adm_tok'); } catch (_) {} window.GMTAuth = Object.assign(window.GMTAuth || {}, { token: () => '' }); window._toasts = []; const o = window.toast; window.toast = (m, k) => { window._toasts.push(m); }; window.open = () => null; });
  await pg.click('[data-pd-open]'); await sleep(300);
  ok(sign.length === 0 && await pg.evaluate(() => window._toasts.some(m => /ادخل الإدارة/.test(m))), 'بلا دخول الإدارة: ما بيطلب رابط · رسالة «ادخل الإدارة باسمك»');
  await pg.evaluate(() => { window.GMTAuth.token = () => 'TOK123'; window._opened = []; window.open = (u) => { window._opened.push(u); return { document: { write() {} }, location: { set href(v) { window._opened.push(v); } }, close() {} }; }; });
  await pg.click('[data-pd-open]'); await sleep(500);
  ok(sign.length === 1 && sign[0].a === 'doc_url' && sign[0].token === 'TOK123' && /^po\/inv-995\//.test(sign[0].path) && await pg.evaluate(() => window._opened.includes('about:blank#signed')), 'مع الدخول: doc_url بالرمز ⇒ ينفتح الرابط الموقَّع');
  /* الإلغاء بسبب (ما في حذف) */
  await pg.evaluate(() => { window.GMTAsk = Object.assign(window.GMTAsk || {}, { prompt: () => Promise.resolve('نسخة غلط') }); });
  await pg.click('[data-pd-void]'); await sleep(700);
  const d2 = await H.call('/__dump', undefined, 'GET');
  ok(d2.gmt_po_docs.length === 2 && d2.gmt_po_docs.filter(x => x.voided).length === 1 && d2.gmt_po_docs.some(x => x.void_reason === 'نسخة غلط'), 'الإلغاء بسبب — الصفّ بيضلّ (لا حذف)');
  await pg.click('[data-pd-x]'); await pg.evaluate(() => render()); await sleep(200);
  ok(await pg.evaluate(() => /1/.test(document.querySelector('[data-podocs-open="995"]').textContent)), 'عدد المستندات على 📎 (1 بعد الإلغاء)');
  ok(!errs.filter(e => !/favicon|404|400|406|401|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|401|status of 503/.test(e)).slice(0, 2)));
  await pg.click('[data-podocs-open="995"]'); await sleep(500);
  await pg.setViewportSize({ width: 390, height: 844 }); await sleep(300);
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= 392), 'عالهاتف: بلا تمرير أفقي');
  await pg.screenshot({ path: '/tmp/claude-0/-home-user/c15c36cd-5ab9-561f-b25b-b44644a4d063/scratchpad/podocs_m.png' });
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
