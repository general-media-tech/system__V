// seq 48 «مازالت لا تعمل» (لقطة: نقطة البيع ← «نقل وارد إلى فرعك» ← «تأكيد الاستلام» ⇒ «⛔ هذه الفاتورة يجري استلامها الآن أو استُلمت مسبقاً»).
// الجذر: طلبات الاستلام في pos.html كانت بلا 'Content-Type: application/json' ⇒ القاعدة الحيّة تردّ 400 PGRST102 فيُفهم الرفض «سباقاً».
// المحاكي صار يرفضها مثلها (mock.py). الاختبار من واجهة الموظّف نفسها كما في اللقطة: فاتورة عاديّة + فاتورة «ناقصة» (needs_settlement).
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = async () => H.call('/__dump', undefined, 'GET');
const PAGE = process.env.POS_PAGE || 'pos.html';

(async () => {
  for (const [w, mob] of [[390, true], [1366, false]]) {
    console.log('— ' + w + ' (' + PAGE + ')');
    await H.seed();
    const [p1, p2] = await H.call('/rest/v1/products', [
      { name: 'Canon 85mm 1.8', barcode: 'RC1', price: 400, wholesale_price: 300, haleb: 0, daraa: 1 },
      { name: 'Yongnuo 50 1.8', barcode: 'RC2', price: 90, wholesale_price: 60, haleb: 0, daraa: 0 }]);
    const [tA, tB] = await H.call('/rest/v1/branch_stock_transfers', [
      { transfer_number: 'TRF-R1', status: 'pending', from_branch: 'haleb', to_branch: 'daraa', from_branch_name: 'حلب', to_branch_name: 'درعا' },
      { transfer_number: 'TRF-R2', status: 'needs_settlement', from_branch: 'haleb', to_branch: 'daraa', from_branch_name: 'حلب', to_branch_name: 'درعا', note: 'تعذّر خصم 1 صنف: Yongnuo 50 1.8' }]);
    await H.call('/rest/v1/stock_transfer_items', [
      { transfer_id: tA.id, product_id: p1.id, product_name: p1.name, qty: 2, requested_qty: 2 },
      // كـTRF-00006 الحيّة تماماً: البند المخصوم بـrequested_qty، وغير المخصوم «قديم» (بلا requested_qty، qty كاملة) واسمه في ملاحظة الفاتورة
      { transfer_id: tB.id, product_id: p1.id, product_name: p1.name, qty: 1, requested_qty: 1 },
      { transfer_id: tB.id, product_id: p2.id, product_name: p2.name, qty: 3, deduction_failed: false }]);
    const { browser, pg, errs } = await H.open(PAGE, { init: H.STAFF_INIT, w, mobile: mob, wait: 6000 });

    const receive = async (num) => {
      const alerts = [];
      await pg.evaluate(async () => { await loadIncomingTransfers(); await openIncomingTransfers(); });
      await pg.waitForTimeout(500);
      const clicked = await pg.evaluate((num) => {
        const card = [...document.querySelectorAll('#inc-trf-body > div')].find(d => d.innerText.includes(num));
        const b = card && [...card.querySelectorAll('button')].find(x => /تأكيد الاستلام/.test(x.innerText));
        if (b) b.click(); return !!b;
      }, num);
      for (let k = 0; k < 30; k++) {
        await pg.waitForTimeout(400);
        const dlg = await pg.evaluate(() => { const o = document.querySelector('.gmtask-ov'); return o ? o.innerText.replace(/\s+/g, ' ').trim() : ''; });
        if (!dlg) { if (alerts.length && !(await pg.evaluate(() => !!document.querySelector('.gmtask-ov')))) { await pg.waitForTimeout(600); if (!(await pg.evaluate(() => !!document.querySelector('.gmtask-ov')))) break; } continue; }
        alerts.push(dlg);
        const noPhoto = await pg.evaluate(() => { const b = [...document.querySelectorAll('.gmtask-ov button')].find(x => /أكّد بلا صورة/.test(x.innerText)); if (b) { b.click(); return true; } return false; });
        if (!noPhoto) await pg.click('.gmtask-ov .gmtask-b.pri').catch(() => {});
      }
      return { clicked, alerts };
    };

    const s0 = await dump(); const d0 = Number(s0.products.find(x => x.id === p1.id).daraa);
    const rA = await receive('TRF-R1');
    let s = await dump(); const trA = s.branch_stock_transfers.find(x => x.id === tA.id);
    const d1 = Number(s.products.find(x => x.id === p1.id).daraa);
    ok(rA.clicked && trA.status === 'received' && d1 === d0 + 2, 'فاتورة عاديّة: «تأكيد الاستلام» ⇒ الحالة received ومخزون درعا ' + d0 + '⇐' + d1 + ' · الحوار: ' + (rA.alerts.slice(-1)[0] || '').slice(0, 80));
    ok(!rA.alerts.some(a => /يجري استلامها الآن/.test(a)), 'لا «يجري استلامها الآن» (رسالة اللقطة)');
    ok(rA.alerts.some(a => /اكتمل الاستلام/.test(a)), 'رسالة «✅ اكتمل الاستلام» ظهرت');

    const rB = await receive('TRF-R2');
    s = await dump(); const trB = s.branch_stock_transfers.find(x => x.id === tB.id);
    const d2 = Number(s.products.find(x => x.id === p1.id).daraa), y2 = Number(s.products.find(x => x.id === p2.id).daraa);
    ok(rB.clicked && trB.status === 'received' && d2 === d1 + 1 && y2 === 0, 'فاتورة «ناقصة» (كـTRF-00006): يُستلم المخصوم فقط (85mm +1) ويبقى غير المخصوم (Yongnuo) بانتظار التسوية: ' + trB.status + ' · ' + (rB.alerts.slice(-1)[0] || '').slice(0, 90));
    ok(rB.alerts.some(a => /بانتظار تسوية الإدارة/.test(a)), 'والرسالة تقول إنّ البند غير المخصوم بانتظار تسوية الإدارة');

    // استلامٌ ثانٍ للفاتورة نفسها ⇒ الحارس يعمل فعلاً (لا مضاعفة)
    await pg.evaluate((id) => { _incomingTransfers.push({ id, transfer_number: 'TRF-R1', status: 'received' }); }, tA.id);
    const again = await pg.evaluate(async (id) => { const out = []; const a0 = GMTAsk.alert; GMTAsk.alert = async (m) => { out.push(m); }; GMTAsk.choose = async () => 'go';
      try { await confirmIncomingTransfer(id); } finally { GMTAsk.alert = a0; } return out; }, tA.id);
    s = await dump();
    ok(again.some(a => /يجري استلامها الآن أو استُلمت مسبقاً/.test(a)) && Number(s.products.find(x => x.id === p1.id).daraa) === d2, 'إعادة استلام فاتورةٍ مستلَمة ⇒ «استُلمت مسبقاً» بلا أيّ إضافة (الحارس سليم)');
    const bad = errs.filter(e => !/favicon|أصول ناقصة|Failed to load resource/.test(e));
    ok(bad.length === 0, 'لا أخطاء JS: ' + JSON.stringify(bad.slice(0, 3)));
    await browser.close();
  }
  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
