// (TASK-A0574 · المالك seq 972) «نظام جرد داخل نقطة البيع كثير قوي: لما بدق الباركود بيعطيني العدد المسجّل — يا بقول له إيه يا إمّا بدخل عدد ثاني
//  ثمّ ترسل الإدارة، والإدارة إمّا بتعمل تسوية أو تراجعني — ما بتتنقص مباشرة»
//  ① المسح ⇒ المسجّل · «نعم» (Enter فارغ) أو عددٌ آخر   ② «إرسال للإدارة» ⇒ stock_counts «بانتظار المراجعة» بكلّ البنود و«المسجّل لحظة العدّ» · المخزون لم يتغيّر
//  ③ أدمن نقاط البيع: شارة «جرود النقاط» ⇒ المراجعة   ④ «إرجاع للفرع» بملاحظة ⇒ نقطة البيع ترى الشريط والملاحظة ⇒ تعيد العدّ وترسل
//  ⑤ الاعتماد بعد بيعٍ حصل بعد العدّ ⇒ يُطبَّق **فرق العدّ** على الحاليّ (لا «= الفعلي») · ما لم يُعدّ لا يُصفَّر
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dump = () => H.call('/__dump', undefined, 'GET');
(async () => {
  await H.seed();
  const [A, B, C] = await H.call('/rest/v1/products', [
    { name: 'جرد مراجعة أ — عدسة', barcode: 'CR1', price: 100, wholesale_price: 70, daraa: 5 },
    { name: 'جرد مراجعة ب — بطارية', barcode: 'CR2', price: 10, wholesale_price: 6, daraa: 3 },
    { name: 'جرد مراجعة ج — لم يُعدّ', barcode: 'CR3', price: 20, wholesale_price: 12, daraa: 2 }]);
  const P = async id => (await dump()).products.find(p => p.id === id);
  // ── نقطة البيع (درعا) ──
  let o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  let pg = o.pg;
  const stubPos = () => pg.evaluate(() => { _posSign = async () => ({ name: 'سامر', url: 'https://x/sig.png', at: new Date().toISOString() }); window.sendTelegram = async () => true; try { sendTelegram = async () => true; } catch (_) {} });
  await stubPos();
  await pg.evaluate(() => { try { localStorage.removeItem('gmt_stockcount_' + branch.key); } catch (_) {} openStockCount(); }); await sleep(1200);
  // ① أ: عددٌ آخر (4) · ب: «نعم» بـEnter فارغ
  await pg.fill('#sc-search', 'CR1'); await pg.press('#sc-search', 'Enter'); await sleep(250);
  const yesTxt = await pg.evaluate(id => (document.querySelector('[data-sc-yes="' + id + '"]') || {}).textContent || '', A.id);
  ok(/نعم 5/.test(yesTxt), '① المسح ⇒ يظهر المسجّل وزرّ «✅ نعم 5»: ' + yesTxt.trim());
  await pg.keyboard.type('4'); await pg.keyboard.press('Enter'); await sleep(250);
  await pg.fill('#sc-search', 'CR2'); await pg.press('#sc-search', 'Enter'); await sleep(250);
  await pg.keyboard.press('Enter'); await sleep(250);   // فارغ = نعم
  const c1 = await pg.evaluate(([a, b]) => [_scCounts[a], _scCounts[b]], [A.id, B.id]);
  ok(c1[0] === 4 && c1[1] === 3, '① أ = 4 (عددٌ آخر) · ب = 3 (Enter فارغ = «نعم»): ' + c1.join(','));
  // ②
  await pg.evaluate(() => scFinishAndReport()); await sleep(1500);
  let D = await dump(); let rows = (D.stock_counts || []).filter(r => r.details && r.details.source === 'pos');
  const r1 = rows[0];
  ok(rows.length === 1 && r1.details.status === 'submitted' && r1.details.items.length === 2, '② أُرسل «بانتظار المراجعة» بكلّ البنود المعدودة (2): ' + (r1 && r1.details.status));
  const ia = r1.details.items.find(i => i.id === String(A.id)), ib = r1.details.items.find(i => i.id === String(B.id));
  ok(ia.sys_at === 5 && ia.actual === 4 && ib.sys_at === 3 && ib.actual === 3, '② لكلّ بند «المسجّل لحظة العدّ» والفعلي (أ 5⇐4 · ب 3⇐3)');
  ok((await P(A.id)).daraa === 5 && (await P(B.id)).daraa === 3 && !(D.branch_stock_transfers || []).length, '② المخزون لم يتغيّر · ولا فاتورة');
  await o.browser.close();
  // ── أدمن نقاط البيع ──
  let a = await H.open('admin_pos.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  let ap = a.pg;
  const badge = await ap.evaluate(() => paintPosCountsBadge());
  ok(badge === 1 && await ap.evaluate(() => document.getElementById('admin-sc-badge').textContent === '1'), '③ شارة «📋 جرود النقاط» = 1');
  const stubAdm = () => ap.evaluate(() => { window.GMTRole = Object.assign(window.GMTRole || {}, { requireAdmin: async () => true }); window.GMTAuth = Object.assign(window.GMTAuth || {}, { ask: async () => true }); window.GMTAsk = Object.assign(window.GMTAsk || {}, { confirm: async () => true, prompt: async () => 'أعد عدّ العدسة' }); });
  await stubAdm();
  await ap.waitForFunction(() => !!window.GMTReconcile && !!window.GMTStock, null, { timeout: 8000 });
  await ap.evaluate(() => openPosCounts()); await ap.waitForSelector('#gmt-rc [data-ix]', { timeout: 8000 }); await sleep(600);
  const s3 = await ap.evaluate(() => ({ msg: document.querySelector('#gmt-rc [data-msg]').innerText, ret: !document.querySelector('#gmt-rc [data-return]').hidden, zero: document.querySelector('#gmt-rc [data-zero]').checked, body: document.querySelector('#gmt-rc [data-body]').innerText }));
  ok(/بانتظار مراجعتك/.test(s3.msg) && s3.ret && !s3.zero, '③ المراجعة: «📥 بانتظار مراجعتك» · زرّ «↩️ إرجاع للفرع» · «تصفير الفرع» غير مؤشَّر (جردٌ جزئيّ)');
  ok(/المسجّل عند العدّ/.test(s3.body), '③ عمود «المسجّل عند العدّ»');
  // ④ إرجاع
  await ap.click('#gmt-rc [data-return]'); await sleep(800);
  D = await dump(); let rr = D.stock_counts.find(r => r.id === r1.id);
  ok(rr.details.status === 'returned' && rr.details.returned_note === 'أعد عدّ العدسة' && (rr.details.returned_items || []).includes(String(A.id)), '④ «إرجاع للفرع» ⇒ الحالة «أُرجعت» بالملاحظة والبنود المطلوبة (أ)');
  ok((await P(A.id)).daraa === 5, '④ المخزون لم يتغيّر');
  await a.browser.close();
  o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 }); pg = o.pg; await stubPos();
  await pg.evaluate(() => _scReturnedNotice()); await sleep(600);
  const strip = await pg.evaluate(() => (document.getElementById('sc-ret-strip') || {}).innerText || '');
  ok(/أرجعت الجرد/.test(strip) && /أعد عدّ العدسة/.test(strip), '④ نقطة البيع: شريط «↩️ الإدارة أرجعت الجرد» بالملاحظة: ' + strip.replace(/\s+/g, ' ').slice(0, 70));
  await pg.evaluate(() => openStockCount()); await sleep(1200);
  const mine = await pg.evaluate(() => document.getElementById('sc-mine').innerText);
  ok(/أرجعتها الإدارة/.test(mine) && /أعد العدّ وأرسل/.test(mine), '④ «جرودي المرسلة»: أُرجعت + الملاحظة + «أعد العدّ وأرسل من جديد»');
  await pg.evaluate(id => scResume(id), r1.id); await sleep(300);
  const c4 = await pg.evaluate(([a, b]) => [_scCounts[a], _scCounts[b]], [A.id, B.id]);
  ok(c4[0] === undefined && c4[1] === 3, '④ الاستئناف: ب محفوظ (3) · أ (المطلوب) يُعَدّ من جديد');
  await pg.fill('#sc-search', 'CR1'); await pg.press('#sc-search', 'Enter'); await sleep(250); await pg.keyboard.type('4'); await pg.keyboard.press('Enter'); await sleep(250);
  await pg.evaluate(() => scFinishAndReport()); await sleep(1500);
  D = await dump(); rows = D.stock_counts.filter(r => r.details && r.details.source === 'pos');
  const r2 = rows.find(r => r.id !== r1.id), old = rows.find(r => r.id === r1.id);
  ok(r2 && r2.details.status === 'submitted' && r2.details.resubmit_of === r1.id && old.details.status === 'resubmitted', '④ أُعيد الإرسال: جردٌ جديد «بانتظار المراجعة» والقديم «أُعيد إرساله»');
  await o.browser.close();
  // ⑤ بيعٌ بعد العدّ: أ 5 ⇐ 4 · ثمّ الاعتماد
  await H.call('/rest/v1/products?id=eq.' + A.id, { daraa: 4 }, 'PATCH');
  a = await H.open('admin_pos.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 }); ap = a.pg; await stubAdm();
  await ap.waitForFunction(() => !!window.GMTReconcile && !!window.GMTStock, null, { timeout: 8000 });
  await ap.evaluate(() => openPosCounts()); await ap.waitForSelector('#gmt-rc [data-ix]', { timeout: 8000 }); await sleep(600);
  const now5 = await ap.evaluate(() => document.querySelector('#gmt-rc [data-body]').innerText);
  ok(/الآن 4/.test(now5), '⑤ تنبيه «الآن 4» — تغيّر بعد العدّ (بيع)');
  await ap.click('#gmt-rc [data-apply]'); await sleep(4500);
  D = await dump(); const r2b = D.stock_counts.find(r => r.id === r2.id);
  ok((await P(A.id)).daraa === 3, '⑤ الاعتماد طبّق فرق العدّ على الحاليّ: 4 + (4−5) = 3 (كان «= الفعلي» ⇒ 4 فيعود المباع): ' + (await P(A.id)).daraa);
  ok((await P(B.id)).daraa === 3 && (await P(C.id)).daraa === 2, '⑤ المطابق لم يُلمس (ب 3) · وما لم يُعدّ لم يُصفَّر (ج 2)');
  ok(r2b.details.status === 'applied' && (r2b.details.numbers || []).length >= 1, '⑤ الجرد «طُبّق» برقم فاتورة التسوية: ' + (r2b.details.numbers || []).join(' + '));
  const real = [...o.errs, ...a.errs].filter(x => !/status of (400|401|404|406|409|503)|Failed to load resource/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await a.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
