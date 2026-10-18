// t_inv1_recount.js — «🔄 إعادة العدّ» لفواتير النقل غير المنقولة/الناقصة (وثيقة الطلبات §1)
// نصّ المالك: «كبسة زر ترجع تعدّد الكميات وتحدّد لي كل شيء مو موجود في المخزون المصدر لحتى أرفع الكمية —
//             لازم الموضوع ينحل خلال كبسة زر واحدة أو اثنتين، وليس كل واحدة يدوياً إلا إذا في شيء بدي أعدّله يدوياً».
// يفتح الصفحة الحقيقية على قاعدة وهمية ويؤكّد **أرقام المخزون بالضبط** قبل/بعد: رفع المصدر · الإكمال · عدم المضاعفة عند التكرار ·
// الرفع بما كتبه المالك · رفضٌ بلا أدمن · استعادة الكمية عند فشل الكتابة · فاتورة قديمة بلا أعمدة · فاتورة مستلمة · سجلّ العمليات · 390 و1366.
const H = require('./h.js');
const OUT = process.env.OUT_DIR || '/tmp';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } return !!c; };
const dump = async () => await H.call('/__dump', undefined, 'GET');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ── بذر: أصناف A..E بمخزون حلب/درعا + ثلاث فواتير ناقصة + فاتورة مُلغاة (يجب تجاهلها) ── */
async function seed(extra) {
  await H.call('/__reset', {});
  await H.call('/__opts', { reject_cols: [], unique_order_invoice: true, old_rpc_false: false, rls_block: [], no_pos_fn: false, sov: '2003', pos_protected: true, pos_locked: false });
  await H.call('/rest/v1/inv_columns', [['haleb', 'حلب'], ['daraa', 'درعا']].map(([k, n], i) => ({ key_name: k, display_name: n, col_type: 'number', include_in_total: true, is_branch: true, show_form: true, show_table: true, sort_order: i })));
  const mk = (name, haleb, daraa) => ({ name, barcode: 'BC-' + name, price: 100, wholesale_price: 80, cost_price: 60, haleb, daraa, in_transit: {} });
  const P = await H.call('/rest/v1/products', [mk('صنف A', 2, 0), mk('صنف B', 0, 0), mk('صنف C', 10, 0), mk('صنف D', 0, 1), mk('صنف E', 6, 0)]);
  const id = n => P.find(p => p.name === 'صنف ' + n).id;
  const hdr = (no, from, to, status, note, created) => ({ transfer_number: no, from_branch: from, from_branch_name: from === 'haleb' ? 'حلب' : 'درعا', to_branch: to, to_branch_name: to === 'haleb' ? 'حلب' : 'درعا', status, note: note || null, settled: false, created_by: 'x', created_at: created });
  const T = await H.call('/rest/v1/branch_stock_transfers', [
    hdr('TRF-1', 'haleb', 'daraa', 'needs_settlement', 'تعذّر خصم 2 صنف: صنف A، صنف B', '2026-10-01T10:00:00Z'),
    hdr('TRF-2', 'haleb', 'daraa', 'needs_settlement', 'تعذّر خصم 2 صنف: صنف B، صنف C', '2026-10-02T10:00:00Z'),
    hdr('TRF-3', 'daraa', 'haleb', 'needs_settlement', 'تعذّر خصم 1 صنف: صنف D', '2026-10-03T10:00:00Z'),
    hdr('TRF-9', 'haleb', 'daraa', 'cancelled', null, '2026-09-01T10:00:00Z')
  ]);
  const tid = no => T.find(t => t.transfer_number === no).id;
  const it = (t, pid, name, qty, req, failed) => ({ transfer_id: tid(t), product_id: id(pid), product_name: name, qty, requested_qty: req, waived_qty: 0, deduction_failed: !!failed, unit_cost: 60, sale_price: 100 });
  await H.call('/rest/v1/stock_transfer_items', [
    it('TRF-1', 'A', 'صنف A', 0, 5, true),      // مفتوح 5 · المصدر 2 ⇒ ناقص 3
    it('TRF-1', 'B', 'صنف B', 2, 6, true),      // مفتوح 4 (منقول 2) · مصدر B = 0
    it('TRF-1', 'E', 'صنف E', 2, 2, false),     // مكتمل — لا يُعدّ
    it('TRF-2', 'B', 'صنف B', 0, 3, true),      // مفتوح 3 ⇒ مجموع B = 7 · المصدر 0 ⇒ ناقص 7
    it('TRF-2', 'C', 'صنف C', 0, 4, true),      // مفتوح 4 · المصدر 10 ⇒ جاهز
    it('TRF-3', 'D', 'صنف D', 0, 2, true),      // من درعا: مفتوح 2 · المصدر 1 ⇒ ناقص 1
    it('TRF-9', 'A', 'صنف A', 0, 9, true)       // فاتورة مُلغاة: تُتجاهل كلياً
  ]);
  return { P, T, id, tid };
}
const stk = (d, n, br) => Number(d.products.find(p => p.name === 'صنف ' + n)[br]);
const itm = (d, trf, n) => { const t = d.branch_stock_transfers.find(x => x.transfer_number === trf); return d.stock_transfer_items.find(i => String(i.transfer_id) === String(t.id) && i.product_name === 'صنف ' + n); };
const trf = (d, no) => d.branch_stock_transfers.find(x => x.transfer_number === no);
const audits = (d, a) => (d.gmt_audit || []).filter(x => x.action === a);
const stateStr = d => ['A', 'B', 'C', 'D', 'E'].map(n => n + ':' + stk(d, n, 'haleb') + '/' + stk(d, n, 'daraa')).join(' ');

async function open(w, mobile) {
  const r = await H.open('inventory.html', { init: H.ADMIN_INIT, w, h: 900, wait: 5500, mobile });
  await r.pg.evaluate(() => { switchAppMode('transfer'); window.GMTAsk.alert = async () => true; });
  return r;
}
/* يجيب نافذة السبب (GMTAsk.prompt) آلياً بنصٍّ ما — ويسجّل رسالتها */
const autoPrompt = (pg, answer) => pg.evaluate(a => { window.__prompts = []; window.GMTAsk.prompt = async (m, o) => { window.__prompts.push({ m, v: o && o.value }); await new Promise(r => setTimeout(r, 150)); return a === undefined ? (o && o.value) : a; }; }, answer);

(async () => {
  // ═══════════ S1 — الزرّ يعدّ ويعرض الناقص من المصدر (أرقام + تجميع بين فاتورتين + استثناء المُلغاة) ═══════════
  let ctx = await seed();
  let { browser, pg, errs } = await open(1366, false);
  await pg.click('#st-recount-btn'); await sleep(1800);
  const rep = await pg.evaluate(() => {
    const box = document.getElementById('st-recount-box'); if (!box) return null;
    const rows = [...box.querySelectorAll('.st-rc-row')].map(r => ({
      name: r.querySelector('.st-rc-name b').textContent.trim(),
      txt: r.querySelector('.st-sl-nums').innerText.replace(/\s+/g, ' ').trim(),
      def: r.querySelector('input').value, br: r.querySelector('.st-rc-name small').textContent
    }));
    return { rows, heads: [...box.querySelectorAll('.st-rc-br')].map(h => h.textContent.trim()), sum: (box.querySelector('.st-rc-sum') || {}).innerText, head: box.querySelector('.st-rc-head').innerText.replace(/\s+/g, ' '), raiseBtn: !!document.getElementById('st-rc-raise'), availBtn: !!document.getElementById('st-rc-avail'), vis: box.getBoundingClientRect().width > 0 };
  });
  console.log('S1 report:', JSON.stringify(rep));
  ok(rep && rep.vis && rep.rows.length === 3, 'S1 الزرّ يفتح اللوحة ويعرض 3 أصناف ناقصة في مصدرها (A وB وD) — C جاهز وE مكتمل والمُلغاة مُتجاهَلة');
  const rowA = rep.rows.find(r => r.name === 'صنف A'), rowB = rep.rows.find(r => r.name === 'صنف B'), rowD = rep.rows.find(r => r.name === 'صنف D');
  ok(rowA && /المطلوب 5/.test(rowA.txt) && /المتاح الآن 2/.test(rowA.txt) && /الناقص 3/.test(rowA.txt) && rowA.def === '3', 'S1 صنف A: المطلوب 5 · المتاح 2 · الناقص 3 (وخانة الرفع الافتراضية 3)');
  ok(rowB && /المطلوب 7/.test(rowB.txt) && /المتاح الآن 0/.test(rowB.txt) && /الناقص 7/.test(rowB.txt) && /TRF-1/.test(rowB.br) && /TRF-2/.test(rowB.br), 'S1 صنف B: فاتورتان تسحبان من رصيدٍ واحد ⇒ المطلوب 7 (4+3) · المتاح 0 · الناقص 7');
  ok(rowD && /المطلوب 2/.test(rowD.txt) && /المتاح الآن 1/.test(rowD.txt) && /الناقص 1/.test(rowD.txt) && rep.heads.some(h => /من «درعا»/.test(h)) && rep.heads.some(h => /من «حلب»/.test(h)), 'S1 صنف D من فرعٍ مصدرٍ آخر (درعا): المطلوب 2 · المتاح 1 · الناقص 1 — والأصناف مجمّعةٌ تحت عنوان كل فرعٍ مصدر');
  ok(rep.raiseBtn && rep.availBtn && /3/.test(rep.sum) && /11/.test(rep.sum), 'S1 زرّا التنفيذ ظاهران والملخّص: 3 أصناف · 11 قطعة ناقصة');
  const g1 = await pg.evaluate(() => { const b = document.getElementById('st-settle-body'); const r = document.getElementById('st-recount-box').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, over: b.scrollWidth > b.clientWidth + 1, boxIn: r.left >= 0 && r.right <= innerWidth + 1 }; });
  ok(g1.sw <= g1.cw + 1 && !g1.over && g1.boxIn, 'S1 1366: لا طفح أفقي وصندوق العدّ ضمن الشاشة');
  let d = await dump();
  ok(stateStr(d) === 'A:2/0 B:0/0 C:10/0 D:0/1 E:6/0', 'S1 العدّ وحده لا يلمس المخزون (قراءة فقط): ' + stateStr(d));
  await pg.screenshot({ path: `${OUT}/inv1_recount_1366.png` });

  // ═══════════ S2 — «ارفع الناقص وأكمل الكل»: ضغطةٌ + نافذة السبب الحقيقية ═══════════
  await pg.click('#st-rc-raise'); await pg.waitForSelector('.gmtask-ov .gmtask-in', { timeout: 5000 });
  const dlg = await pg.evaluate(() => { const b = document.querySelector('.gmtask-bx'); const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + 20); return { msg: b.querySelector('.gmtask-bd').textContent, val: b.querySelector('.gmtask-in').value, onTop: !!(top && b.contains(top)) }; });
  console.log('S2 dialog:', JSON.stringify(dlg).slice(0, 300));
  ok(dlg.onTop && /11 قطعة/.test(dlg.msg) && /صنف A/.test(dlg.msg) && /من 2 إلى 5/.test(dlg.msg) && dlg.val.length > 5, 'S2 نافذة تأكيدٍ واحدة بالملخّص (11 قطعة · من 2 إلى 5…) وسببٌ جاهز قابل للتعديل');
  d = await dump();
  ok(stateStr(d) === 'A:2/0 B:0/0 C:10/0 D:0/1 E:6/0', 'S2 قبل التأكيد لا شيء يتغيّر في المخزون');
  await pg.click('.gmtask-bx .gmtask-b.pri');
  await pg.waitForSelector('.st-rc-res', { timeout: 20000 }); await sleep(600);
  d = await dump();
  console.log('S2 after:', stateStr(d), 'in_transit', JSON.stringify(d.products.map(p => p.in_transit)));
  ok(stateStr(d) === 'A:0/0 B:0/0 C:6/0 D:0/0 E:6/0', 'S2 المخزون بالضبط: A 2→(رُفع 5)→0 · B 0→(رُفع 7)→0 · C 10→6 · D(درعا) 1→(رُفع 2)→0 · E كما هو 6');
  const tr = { a: itm(d, 'TRF-1', 'A'), b1: itm(d, 'TRF-1', 'B'), b2: itm(d, 'TRF-2', 'B'), c: itm(d, 'TRF-2', 'C'), dd: itm(d, 'TRF-3', 'D') };
  ok(tr.a.qty === 5 && tr.b1.qty === 6 && tr.b2.qty === 3 && tr.c.qty === 4 && tr.dd.qty === 2, 'S2 وصلت كل البنود بأعدادها: A=5 · B(TRF-1)=6 · B(TRF-2)=3 · C=4 · D=2');
  ok([tr.a, tr.b1, tr.b2, tr.c, tr.dd].every(x => x.deduction_failed === false), 'S2 لم يبقَ بندٌ موسومٌ «فاشل»');
  ok(['TRF-1', 'TRF-2', 'TRF-3'].every(n => trf(d, n).status === 'pending' && !trf(d, n).note), 'S2 الفواتير الثلاث عادت «في الطريق» والملاحظات نُظّفت');
  ok(d.stock_transfer_items.find(i => i.product_name === 'صنف A' && String(i.transfer_id) === String(trf(d, 'TRF-9').id)).qty === 0 && trf(d, 'TRF-9').status === 'cancelled', 'S2 الفاتورة المُلغاة لم تُمسّ');
  const itr = Object.fromEntries(d.products.map(p => [p.name, p.in_transit]));
  ok(itr['صنف A'].daraa === 5 && itr['صنف B'].daraa === 7 && itr['صنف C'].daraa === 4 && itr['صنف D'].haleb === 2, 'S2 «في الطريق» للوجهات: A 5 · B 7 · C 4 (درعا) · D 2 (حلب)');
  const raised = audits(d, 'branch_stock_raised'), fills = audits(d, 'transfer_fill'), rcs = audits(d, 'transfer_recount');
  console.log('S2 audit:', raised.map(a => a.entity_name + ':' + a.old_value + '→' + a.new_value).join(' | '));
  ok(raised.length === 3 && raised.some(a => a.entity_name === 'صنف A' && a.old_value === '2' && a.new_value === '5') && raised.some(a => a.entity_name === 'صنف B' && a.old_value === '0' && a.new_value === '7') && raised.some(a => a.entity_name === 'صنف D' && a.old_value === '1' && a.new_value === '2'), 'S2 سجلّ العمليات: 3 حركات رفعٍ بالقيم قبل/بعد (A 2→5 · B 0→7 · D 1→2) ولا رفعٌ لـ C');
  ok(fills.length === 5 && rcs.length === 3 && raised.every(a => /سبب|إكمال/.test(a.reason || '')) && fills.every(a => a.actor), 'S2 سجلّ العمليات: 5 حركات إكمالٍ (transfer_fill) + سطرٌ لكل فاتورة (transfer_recount) والسبب مكتوب');
  const banner = await pg.evaluate(() => (document.querySelector('.st-rc-res') || {}).innerText || '');
  ok(/تمّ التنفيذ/.test(banner) && /5/.test(banner) && /11/.test(banner), 'S2 بيانٌ ظاهرٌ بالنتيجة (5 بنود · رُفع 11) يبقى على الشاشة: «' + banner.replace(/\s+/g, ' ').slice(0, 90) + '»');
  await pg.screenshot({ path: `${OUT}/inv1_recount_1366_done.png` });

  // ═══════════ S3 — التكرار آمن: لا رفعٌ ولا خصمٌ إضافي ═══════════
  const before = JSON.stringify(await dump());
  await autoPrompt(pg);
  const again = await pg.evaluate(async () => { const a = await stRecountApply('raise'); const b = await stRecountApply('avail'); return [a, b].map(x => ({ ok: x.ok, noop: !!x.noop })); });
  d = await dump();
  ok(again.every(x => x.ok && x.noop) && stateStr(d) === 'A:0/0 B:0/0 C:6/0 D:0/0 E:6/0' && audits(d, 'branch_stock_raised').length === 3 && audits(d, 'transfer_fill').length === 5, 'S3 ضغطةٌ ثانية (رفع + نقل المتاح): لا شيء يُفعَل — المخزون كما هو وسجلّ العمليات لم يزد');
  // ضغطتان في اللحظة نفسها على حالةٍ جديدة ⇒ واحدةٌ تعمل والثانية تُردّ (قفلٌ واحد)
  await browser.close();

  ctx = await seed();
  ({ browser, pg, errs } = await open(1366, false));
  await autoPrompt(pg);
  const dbl = await pg.evaluate(async () => { const [a, b] = await Promise.all([stRecountApply('raise'), stRecountApply('raise')]); return { a: !!a.ok && !a.busy, b: !!b.busy, full: a.full, raised: a.raisedTotal }; });
  d = await dump();
  console.log('S3 double:', JSON.stringify(dbl), stateStr(d));
  ok(dbl.a && dbl.b && dbl.full === 5 && dbl.raised === 11 && stateStr(d) === 'A:0/0 B:0/0 C:6/0 D:0/0 E:6/0' && audits(d, 'branch_stock_raised').length === 3, 'S3 ضغطتان متزامنتان على «ارفع وأكمل»: واحدةٌ نُفِّذت والثانية رُدّت (مشغول) — لا رفعٌ مضاعف ولا خصمٌ مضاعف');
  const dbl2 = await pg.evaluate(async () => { const [a, b] = await Promise.all([stRecountApply('avail'), stFill('x', 'y', 'avail')]); return { a: !!a.ok, b: !!b.busy }; });
  ok(dbl2.a && dbl2.b, 'S3 «إعادة العدّ» و«أعِد المحاولة» لا يعملان معاً (قفلٌ مشترك): الثانية تُردّ «مشغول»');
  await browser.close();

  // ═══════════ S4 — «انقل المتاح فقط»: بلا رفعٍ وبلا أدمن؛ الباقي يبقى ناقصاً ثم يُرفع لاحقاً ═══════════
  ctx = await seed();
  ({ browser, pg, errs } = await open(1366, false));
  await pg.evaluate(() => { sessionStorage.removeItem('gmt_admin_mode'); window.GMTRole.requireAdmin = async () => { window.__adminAsked = (window.__adminAsked || 0) + 1; return false; }; });
  await pg.click('#st-recount-btn'); await sleep(1500);
  await pg.click('#st-rc-avail'); await pg.waitForSelector('.st-rc-res', { timeout: 20000 }); await sleep(500);
  d = await dump();
  console.log('S4 after avail:', stateStr(d), 'adminAsked', await pg.evaluate(() => window.__adminAsked || 0));
  ok(stk(d, 'A', 'haleb') === 0 && itm(d, 'TRF-1', 'A').qty === 2 && itm(d, 'TRF-1', 'A').deduction_failed === true, 'S4 A: نُقل المتاح 2 فقط (المصدر 2→0) والبند ما زال ناقصاً 3');
  ok(stk(d, 'B', 'haleb') === 0 && itm(d, 'TRF-1', 'B').qty === 2 && itm(d, 'TRF-2', 'B').qty === 0, 'S4 B: لا رصيد ⇒ لم يُنقل شيء (TRF-1 يبقى 2 وTRF-2 يبقى 0) ولم يُخصم المصدر');
  ok(stk(d, 'C', 'haleb') === 6 && itm(d, 'TRF-2', 'C').qty === 4 && stk(d, 'D', 'daraa') === 0 && itm(d, 'TRF-3', 'D').qty === 1, 'S4 C: نُقل كاملاً (10→6) · D: نُقل المتاح 1 (درعا 1→0) وبقي 1 ناقصاً');
  ok(await pg.evaluate(() => !window.__adminAsked) && audits(d, 'branch_stock_raised').length === 0, 'S4 «انقل المتاح» لم يطلب صلاحية الأدمن ولم يرفع شيئاً (لا حركة رفع في السجل)');
  ok(['TRF-1', 'TRF-2', 'TRF-3'].every(n => trf(d, n).status === 'needs_settlement') && /صنف A/.test(trf(d, 'TRF-1').note) && !/صنف C/.test(trf(d, 'TRF-2').note) && /صنف B/.test(trf(d, 'TRF-2').note), 'S4 الفواتير تبقى «تحتاج تسوية» وملاحظاتها تحمل الباقي فقط (TRF-2: B وحده بلا C)');
  const bn4 = await pg.evaluate(() => (document.querySelector('.st-rc-res') || {}).innerText || '');
  ok(/تعذّر/.test(bn4) && /جزئياً/.test(bn4), 'S4 البيان يذكر ما تعذّر (B) وما نُقل جزئياً: «' + bn4.replace(/\s+/g, ' ').slice(0, 120) + '»');
  // بلا أدمن: «ارفع الناقص» تُرفض بلا لمس
  const snap4 = stateStr(d); const aud4 = ['branch_stock_raised', 'transfer_fill', 'transfer_recount'].map(a => audits(d, a).length).join();
  await pg.click('#st-recount-hdr-btn'); await sleep(1200);      // الزرّ داخل اللوحة المفتوحة (إعادة العدّ بعد أي تغيير)
  await pg.click('#st-rc-raise'); await sleep(1200);
  d = await dump();
  ok(await pg.evaluate(() => window.__adminAsked === 1) && stateStr(d) === snap4 && ['branch_stock_raised', 'transfer_fill', 'transfer_recount'].map(a => audits(d, a).length).join() === aud4, 'S4 «ارفع الناقص» بلا صلاحية أدمن: طُلبت الصلاحية فرُفضت — لا تغيير في المخزون ولا في السجلّ');
  // ثم بصلاحية: يكمل الباقي (A 3 · B 7 · D 1)
  await pg.evaluate(() => { window.GMTRole.requireAdmin = async () => true; });
  await autoPrompt(pg, 'رفع بعد النقل الجزئي');
  await pg.click('#st-recount-hdr-btn'); await sleep(1200);
  const row4 = await pg.evaluate(() => [...document.querySelectorAll('.st-rc-row')].map(r => r.querySelector('.st-rc-name b').textContent.trim() + ':' + r.querySelector('.st-sl-nums').innerText.replace(/\s+/g, ' ')));
  console.log('S4 rows after partial:', JSON.stringify(row4));
  ok(row4.length === 3 && row4.some(x => /^صنف A:.*المطلوب 3.*المتاح الآن 0.*الناقص 3/.test(x)) && row4.some(x => /^صنف B:.*المطلوب 7.*الناقص 7/.test(x)) && row4.some(x => /^صنف D:.*المطلوب 1.*المتاح الآن 0.*الناقص 1/.test(x)), 'S4 العدّ الجديد يعرض الباقي فقط: A 3 · B 7 · D 1');
  await pg.click('#st-rc-raise'); await pg.waitForSelector('.st-rc-res', { timeout: 20000 }); await sleep(600);
  d = await dump();
  ok(stk(d, 'A', 'haleb') === 0 && stk(d, 'B', 'haleb') === 0 && stk(d, 'D', 'daraa') === 0 && stk(d, 'C', 'haleb') === 6 && itm(d, 'TRF-1', 'A').qty === 5 && itm(d, 'TRF-1', 'B').qty === 6 && itm(d, 'TRF-2', 'B').qty === 3 && itm(d, 'TRF-3', 'D').qty === 2 && ['TRF-1', 'TRF-2', 'TRF-3'].every(n => trf(d, n).status === 'pending'), 'S4 بعد الرفع: كل البنود بأعدادها (5/6/3/4/2) والمخزون A0 B0 C6 D0 والفواتير «في الطريق» — لا خصم مضاعف على ما نُقل جزئياً');
  ok(audits(d, 'branch_stock_raised').length === 3 && audits(d, 'branch_stock_raised').reduce((q, a) => q + (Number(a.new_value) - Number(a.old_value)), 0) === 3 + 7 + 1, 'S4 الرفع المسجَّل 3+7+1 = 11 فقط (ما نُقل جزئياً أولاً لم يُرفَع مرّةً ثانية)');
  await browser.close();

  // ═══════════ S5 — الرفع بما يكتبه المالك (تعديلٌ يدويّ) ═══════════
  ctx = await seed();
  ({ browser, pg, errs } = await open(1366, false));
  await autoPrompt(pg);
  await pg.click('#st-recount-btn'); await sleep(1500);
  const keyA = 'haleb|' + ctx.id('A'), keyB = 'haleb|' + ctx.id('B');
  await pg.fill(`input[data-rc-key="${keyA}"]`, '1');       // بدل الناقص 3: يرفع 1 فقط
  await pg.fill(`input[data-rc-key="${keyB}"]`, '0');       // لا يرفع B أبداً
  await pg.click('#st-rc-raise'); await pg.waitForSelector('.st-rc-res', { timeout: 20000 }); await sleep(600);
  d = await dump();
  console.log('S5 after:', stateStr(d), 'A qty', itm(d, 'TRF-1', 'A').qty, 'B', itm(d, 'TRF-1', 'B').qty, itm(d, 'TRF-2', 'B').qty);
  ok(stk(d, 'A', 'haleb') === 0 && itm(d, 'TRF-1', 'A').qty === 3 && itm(d, 'TRF-1', 'A').deduction_failed === true, 'S5 A: كتبتُ 1 ⇒ رُفع 1 فقط (2→3) فنُقل 3 من 5 وبقي 2 ناقصاً');
  ok(stk(d, 'B', 'haleb') === 0 && itm(d, 'TRF-1', 'B').qty === 2 && itm(d, 'TRF-2', 'B').qty === 0, 'S5 B: كتبتُ 0 ⇒ لا رفع ولا نقل (المخزون 0 كما هو)');
  ok(stk(d, 'C', 'haleb') === 6 && stk(d, 'D', 'daraa') === 0 && itm(d, 'TRF-3', 'D').qty === 2, 'S5 C وD (الافتراضي) نُفِّذا كما في الحالة العادية: C 10→6 · D اكتمل');
  const r5 = audits(d, 'branch_stock_raised');
  ok(r5.length === 2 && r5.some(a => a.entity_name === 'صنف A' && a.old_value === '2' && a.new_value === '3') && !r5.some(a => a.entity_name === 'صنف B'), 'S5 السجلّ: رفع A من 2 إلى 3 ورفع D — ولا رفع لـ B');
  await browser.close();

  // ═══════════ S6 — فشل كتابة البند بعد الخصم ⇒ تُعاد الكمية للمصدر ولا نجاح كاذب ═══════════
  ctx = await seed();
  ({ browser, pg, errs } = await open(1366, false));
  await H.call('/__opts', { rls_block: ['stock_transfer_items'] });
  await pg.click('#st-recount-btn'); await sleep(1500);
  await pg.click('#st-rc-avail'); await pg.waitForSelector('.st-rc-res', { timeout: 20000 }); await sleep(600);
  d = await dump();
  console.log('S6 after:', stateStr(d), 'C qty', itm(d, 'TRF-2', 'C').qty);
  ok(stateStr(d) === 'A:2/0 B:0/0 C:10/0 D:0/1 E:6/0', 'S6 كتابة البند مرفوضة من القاعدة ⇒ كل خصمٍ أُعيد للمصدر بالضبط: ' + stateStr(d));
  const bn6 = await pg.evaluate(() => (document.querySelector('.st-rc-res') || {}).innerText || '');
  ok(/تعذّر/.test(bn6) && /أُعيدت الكمية للمصدر/.test(bn6) && !/✅ تمّ التنفيذ/.test(bn6) && itm(d, 'TRF-2', 'C').qty === 0, 'S6 البيان يعلن الفشل صراحةً (لا «تمّ») ويقول إن الكمية أُعيدت: «' + bn6.replace(/\s+/g, ' ').slice(0, 150) + '»');
  await H.call('/__opts', { rls_block: [] });
  await browser.close();

  // ═══════════ S7 — فشل رفع المصدر لصنفٍ: لا يُمسّ بنودُه وبقيّة الأصناف تكتمل ═══════════
  ctx = await seed();
  ({ browser, pg, errs } = await open(1366, false));
  await autoPrompt(pg);
  await pg.evaluate(pid => { const o = GMTStock.move; GMTStock.move = async (k, p, b, q) => (k === 'add' && String(p) === String(pid)) ? { ok: false, error: 'رفضٌ تجريبي' } : o(k, p, b, q); }, ctx.id('B'));
  await pg.click('#st-recount-btn'); await sleep(1500);
  await pg.click('#st-rc-raise'); await pg.waitForSelector('.st-rc-res', { timeout: 20000 }); await sleep(600);
  d = await dump();
  ok(stk(d, 'B', 'haleb') === 0 && itm(d, 'TRF-1', 'B').qty === 2 && itm(d, 'TRF-2', 'B').qty === 0 && stk(d, 'A', 'haleb') === 0 && itm(d, 'TRF-1', 'A').qty === 5 && stk(d, 'C', 'haleb') === 6 && stk(d, 'D', 'daraa') === 0, 'S7 صنف B فشل رفعُه ⇒ بنودُه لم تُمسّ (0 و2 و0)، وA وC وD اكتملت: ' + stateStr(d));
  ok(/رفضٌ تجريبي/.test(await pg.evaluate(() => document.querySelector('.st-rc-res').innerText)) && trf(d, 'TRF-1').status === 'needs_settlement' && /صنف B/.test(trf(d, 'TRF-1').note) && !/صنف A/.test(trf(d, 'TRF-1').note), 'S7 السبب الحقيقي ظاهرٌ في البيان، وTRF-1 تبقى «تحتاج تسوية» وملاحظتها B وحده');
  await browser.close();

  // ═══════════ S8 — فاتورة قديمة بلا أعمدة «المطلوب» + فاتورة مستلمة ═══════════
  await H.call('/__reset', {});
  await H.call('/rest/v1/inv_columns', [['haleb', 'حلب'], ['daraa', 'درعا']].map(([k, n], i) => ({ key_name: k, display_name: n, col_type: 'number', include_in_total: true, is_branch: true, show_form: true, show_table: true, sort_order: i })));
  const P8 = await H.call('/rest/v1/products', [{ name: 'قديم A', barcode: 'L1', price: 1, haleb: 1, daraa: 0, in_transit: {} }, { name: 'قديم B', barcode: 'L2', price: 1, haleb: 0, daraa: 0, in_transit: {} }, { name: 'قديم C', barcode: 'L3', price: 1, haleb: 9, daraa: 0, in_transit: {} }, { name: 'مستلم R', barcode: 'R1', price: 1, haleb: 1, daraa: 3, in_transit: {} }]);
  const H8 = await H.call('/rest/v1/branch_stock_transfers', [
    { transfer_number: 'OLD-1', from_branch: 'haleb', from_branch_name: 'حلب', to_branch: 'daraa', to_branch_name: 'درعا', status: 'needs_settlement', note: 'تعذّر خصم 2 صنف: قديم A، قديم B', settled: false, created_at: '2026-09-01T00:00:00Z' },
    { transfer_number: 'RCV-1', from_branch: 'haleb', from_branch_name: 'حلب', to_branch: 'daraa', to_branch_name: 'درعا', status: 'received', note: 'تعذّر خصم 1 صنف: مستلم R', settled: false, created_at: '2026-09-02T00:00:00Z' }]);
  await H.call('/rest/v1/stock_transfer_items', [
    { transfer_id: H8[0].id, product_id: P8[0].id, product_name: 'قديم A', qty: 3 }, { transfer_id: H8[0].id, product_id: P8[1].id, product_name: 'قديم B', qty: 2 }, { transfer_id: H8[0].id, product_id: P8[2].id, product_name: 'قديم C', qty: 2 },
    { transfer_id: H8[1].id, product_id: P8[3].id, product_name: 'مستلم R', qty: 0, requested_qty: 4, waived_qty: 0, deduction_failed: true }]);
  ({ browser, pg, errs } = await open(1366, false));
  await autoPrompt(pg);
  await pg.click('#st-recount-btn'); await sleep(1500);
  const rows8 = await pg.evaluate(() => [...document.querySelectorAll('.st-rc-row')].map(r => r.querySelector('.st-rc-name b').textContent.trim() + ':' + r.querySelector('.st-sl-nums').innerText.replace(/\s+/g, ' ')));
  console.log('S8 rows:', JSON.stringify(rows8));
  ok(rows8.length === 3 && rows8.some(x => /^قديم A:.*المطلوب 3.*المتاح الآن 1.*الناقص 2/.test(x)) && rows8.some(x => /^قديم B:.*المطلوب 2.*المتاح الآن 0.*الناقص 2/.test(x)) && rows8.some(x => /^مستلم R:.*المطلوب 4.*المتاح الآن 1.*الناقص 3/.test(x)), 'S8 الفاتورة القديمة (الفاشل يُعرف من ملاحظتها: A وB فقط، وC غير فاشل) والمستلمة تُعرَضان بأرقامهما');
  await pg.click('#st-rc-raise'); await pg.waitForSelector('.st-rc-res', { timeout: 20000 }); await sleep(600);
  d = await dump();
  const hv = n => Number(d.products.find(p => p.name === n).haleb), dv = n => Number(d.products.find(p => p.name === n).daraa);
  console.log('S8 after:', ['قديم A', 'قديم B', 'قديم C', 'مستلم R'].map(n => n + ':' + hv(n) + '/' + dv(n)).join(' '), JSON.stringify(d.stock_transfer_items.map(i => [i.product_name, i.qty])));
  ok(hv('قديم A') === 0 && hv('قديم B') === 0 && hv('قديم C') === 9 && d.stock_transfer_items.find(i => i.product_name === 'قديم A').qty === 3 && d.stock_transfer_items.find(i => i.product_name === 'قديم B').qty === 2, 'S8 القديمة: A رُفع 1→3 ثم خُصم 3 → 0 · B رُفع 0→2 ثم خُصم → 0 · C (غير فاشل) لم يُمسّ 9');
  ok(trf(d, 'OLD-1').status === 'pending' && !trf(d, 'OLD-1').note, 'S8 الفاتورة القديمة عادت «في الطريق» وملاحظتها نُظّفت');
  ok(hv('مستلم R') === 0 && dv('مستلم R') === 3 + 4 && d.stock_transfer_items.find(i => i.product_name === 'مستلم R').qty === 4, 'S8 المستلمة: رُفع المصدر 1→4 ثم خُصم 4 → 0 وأُضيفت للوجهة فوراً (درعا 3→7)');
  await browser.close();

  // ═══════════ S9 — الهاتف 390: لا طفح ولا قصّ، والزرّان بلمسة كاملة ═══════════
  ctx = await seed();
  ({ browser, pg, errs } = await open(390, true));
  await pg.click('#st-recount-btn'); await sleep(1800);
  const geo = await pg.evaluate(() => {
    const ov = document.getElementById('st-settle-ov'), b = document.getElementById('st-settle-body'), box = document.getElementById('st-recount-box');
    const btns = [...box.querySelectorAll('.st-rc-acts button')].map(x => { const r = x.getBoundingClientRect(); return { t: x.textContent.trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height), inside: r.left >= 0 && r.right <= innerWidth + 1 }; });
    const rows = [...box.querySelectorAll('.st-rc-row')].map(r => { const q = r.getBoundingClientRect(); return q.right <= innerWidth + 1 && q.left >= -1 && r.scrollWidth <= r.clientWidth + 1; });
    const inputs = [...box.querySelectorAll('input')].map(i => { const q = i.getBoundingClientRect(); return q.width >= 60 && q.height >= 30 && q.right <= innerWidth + 1; });
    return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bodyOver: b.scrollWidth > b.clientWidth + 1, btns, rows, inputs, ovVis: ov.getBoundingClientRect().width > 0 };
  });
  console.log('S9 geo', JSON.stringify(geo));
  ok(geo.ovVis && geo.sw <= geo.cw + 1 && !geo.bodyOver, 'S9 390: اللوحة ظاهرة بلا طفحٍ أفقي');
  ok(geo.btns.length === 3 && geo.btns.every(b => b.inside && b.h >= 40 && b.w >= 120) && geo.rows.length === 3 && geo.rows.every(Boolean) && geo.inputs.every(Boolean), 'S9 390: الأزرار الثلاثة ضمن الشاشة ولمستها ≥40px، والصفوف وخانات الرفع غير مقصوصة');
  await pg.screenshot({ path: `${OUT}/inv1_recount_390.png` });
  await autoPrompt(pg);
  await pg.click('#st-rc-raise'); await pg.waitForSelector('.st-rc-res', { timeout: 20000 }); await sleep(600);
  d = await dump();
  ok(stateStr(d) === 'A:0/0 B:0/0 C:6/0 D:0/0 E:6/0', 'S9 390: نفس النتيجة بالأرقام على الهاتف');
  await pg.screenshot({ path: `${OUT}/inv1_recount_390_done.png` });
  // زرّ شريط النقل ظاهرٌ على الهاتف
  const tb = await pg.evaluate(() => { const b = document.getElementById('st-recount-btn'); const r = b.getBoundingClientRect(); return { vis: r.width > 0 && r.right <= innerWidth + 1 && r.left >= 0, txt: b.textContent.trim() }; });
  ok(tb.vis && /إعادة العدّ/.test(tb.txt), 'S9 390: زرّ «🔄 إعادة العدّ» في شريط النقل ظاهرٌ كاملاً');
  console.log('errs', errs.filter(e => !/404|400|Failed|qrserver|ERR_|CORS|logo/.test(e)).slice(0, 5));
  await browser.close();
  console.log(fails ? ('FAILED: ' + fails) : 'ALL PASSED');
})();
