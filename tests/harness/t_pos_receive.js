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
    const { browser, ctx, pg, errs } = await H.open(PAGE, { init: H.STAFF_INIT, w, mobile: mob, wait: 6000 });

    const receive = async (num) => {
      const alerts = [];
      await pg.evaluate(async () => { await loadIncomingTransfers(); await openIncomingTransfers(); });
      await pg.waitForTimeout(500);
      const clicked = await pg.evaluate((num) => {
        const card = [...document.querySelectorAll('#inc-trf-body > div')].find(d => d.innerText.includes(num));
        const b = card && [...card.querySelectorAll('button')].find(x => /تأكيد الاستلام|أكمِل الاستلام/.test(x.innerText));
        if (b) b.click(); return !!b;
      }, num);
      // ينتهي حين لا حوار ولا طبقة «جارٍ الاستلام» (الاستلام نفسه قد يطول) — و«انتهى» = بعد آخر حوارٍ أُغلق
      const busy = () => pg.evaluate(() => !!document.querySelector('.gmtask-ov') || !!document.getElementById('rcv-prog-ov'));
      for (let k = 0; k < 120; k++) {
        await pg.waitForTimeout(300);
        const dlg = await pg.evaluate(() => { const o = document.querySelector('.gmtask-ov'); return o ? o.innerText.replace(/\s+/g, ' ').trim() : ''; });
        if (!dlg) { if (alerts.length > 1 && !(await busy())) { await pg.waitForTimeout(700); if (!(await busy())) break; } continue; }
        alerts.push(dlg);
        const noPhoto = await pg.evaluate(() => { const b = [...document.querySelectorAll('.gmtask-ov button')].find(x => /أكّد بلا صورة/.test(x.innerText)); if (b) { b.click(); return true; } return false; });
        if (!noPhoto) await pg.click('.gmtask-ov .gmtask-b.pri').catch(() => {});
      }
      return { clicked, alerts };
    };

    const s0 = await dump(); const d0 = Number(s0.products.find(x => x.id === p1.id).daraa);
    // seq 57: «مؤشّر جارٍ الاستلام · ما بصير أكبس ولا زرّ ولا أغادر» — نُبطئ وسم البند لنرى الطبقة أثناء العمل
    await ctx.route(/stock_transfer_items\?id=eq\./, async (route) => { if (route.request().method() === 'PATCH') await new Promise(r => setTimeout(r, 900)); return route.fallback(); });
    await pg.evaluate(() => { window.__rcvSnap = []; window.__rcvT = setInterval(() => { const o = document.getElementById('rcv-prog-ov'); if (!o) return;
      const r = o.firstElementChild.getBoundingClientRect(); const top = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      window.__rcvSnap.push({ txt: o.innerText.replace(/\s+/g, ' '), onTop: o.contains(top), top: top ? (top.tagName + '#' + top.id + '.' + String(top.className).slice(0, 40) + ' z=' + getComputedStyle(top).zIndex + ' p=' + (top.parentElement && (top.parentElement.id || top.parentElement.className))) : null, busy: __rcvBusy, inView: r.top >= 0 && r.bottom <= innerHeight, z: +getComputedStyle(o).zIndex }); }, 150); });
    const rA = await receive('TRF-R1');
    const snap = await pg.evaluate(() => { clearInterval(window.__rcvT); return window.__rcvSnap; });
    const mid = snap.find(x => /البند 1 من 1/.test(x.txt) && x.onTop) || snap.find(x => /البند 1 من 1/.test(x.txt));   // أوّل لقطة قد تلتقط حوار التأكيد وهو يتلاشى
    ok(!!mid && mid.onTop && mid.busy && mid.inView && mid.z > 99993 && /جارٍ استلام TRF-R1/.test(mid.txt) && /لا تغلق الصفحة/.test(mid.txt), 'أثناء الاستلام: طبقة «📦 جارٍ استلام TRF-R1 · البند 1 من 1» فوق نافذة «وارد» تمنع الضغط + تحذير المغادرة: ' + JSON.stringify(mid || snap[0] || null).slice(0, 160));
    ok(await pg.evaluate(() => !document.getElementById('rcv-prog-ov') && __rcvBusy === false), 'بعد الانتهاء: الطبقة تزول ولا تحذير عند المغادرة');
    await ctx.unroute(/stock_transfer_items\?id=eq\./);
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
    // ── TASK-0147 (لقطة المالك seq 51): انقطاعٌ في منتصف الاستلام ⇒ «لم يكتمل» ⇒ «↻ أكمِل الاستلام» يُكمل الباقي فقط ──
    const [p3, p4, p5] = await H.call('/rest/v1/products', [
      { name: 'YM-S60 هيد', barcode: 'RC3', price: 50, wholesale_price: 30, haleb: 0, daraa: 0 },
      { name: 'YM-S100 هيد', barcode: 'RC4', price: 50, wholesale_price: 30, haleb: 0, daraa: 0 },
      { name: 'Stand 205 cm', barcode: 'RC5', price: 20, wholesale_price: 10, haleb: 0, daraa: 0 }]);
    const [tC] = await H.call('/rest/v1/branch_stock_transfers', [{ transfer_number: 'TRF-R3', status: 'pending', from_branch: 'haleb', to_branch: 'daraa', from_branch_name: 'حلب', to_branch_name: 'درعا' }]);
    await H.call('/rest/v1/stock_transfer_items', [
      { transfer_id: tC.id, product_id: p3.id, product_name: p3.name, qty: 2, requested_qty: 2 },
      { transfer_id: tC.id, product_id: p4.id, product_name: p4.name, qty: 1, requested_qty: 1 },
      { transfer_id: tC.id, product_id: p5.id, product_name: p5.name, qty: 5, requested_qty: 5 }]);
    let down = false, marks = 0, fail503 = 0;
    const dropRoute = async (route) => {
      const u = route.request().url(), m = route.request().method();
      if (down) return route.abort('internetdisconnected');
      if (m === 'PATCH' && /stock_transfer_items\?id=eq\./.test(u) && ++marks === 1) { await route.fallback(); down = true; return; }   // ينقطع بعد أوّل بند
      if (fail503 > 0 && m === 'PATCH' && /branch_stock_transfers\?/.test(u) && /"status":"received"/.test(route.request().postData() || '')) { fail503--; return route.fulfill({ status: 503, body: '{}' }); }   // الحالة النهائية وحدها
      return route.fallback();
    };
    await ctx.route('**/*.supabase.co/**', dropRoute);
    const rC = await receive('TRF-R3');
    down = false;
    s = await dump(); let trC = s.branch_stock_transfers.find(x => x.id === tC.id);
    const got = id => Number(s.products.find(x => x.id === id).daraa);
    ok(trC.status === 'receiving' && got(p3.id) === 2 && got(p4.id) === 0 && got(p5.id) === 0, 'انقطاعٌ بعد البند الأوّل ⇒ أُضيف الأوّل فقط والفاتورة «receiving» (كلقطة المالك): ' + trC.status + ' · ' + [got(p3.id), got(p4.id), got(p5.id)]);
    ok(rC.alerts.some(a => /لم يكتمل الاستلام/.test(a) && /أكمِل الاستلام/.test(a)) && !rC.alerts.some(a => /أبلغ الإدارة بهذا الرقم/.test(a)), 'الرسالة تقول ما حدث وكيف يُكمَل (لا «أبلغ الإدارة بهذا الرقم»)');
    await pg.evaluate(async () => { await loadIncomingTransfers(); await openIncomingTransfers(); }); await pg.waitForTimeout(400);
    const card = await pg.evaluate(() => { const c = document.querySelector('[data-trf="TRF-R3"]'); return c ? { resume: !!c.querySelector('[data-trf-resume]'), btn: [...c.querySelectorAll('button')].map(b => b.innerText).join('|') } : null; });
    ok(card && card.resume && /أكمِل الاستلام/.test(card.btn), 'الفاتورة العالقة تظهر في «وارد» بـ«⏳ استلامٌ بدأ ولم يكتمل» وزرّ «↻ أكمِل الاستلام» (كانت تختفي): ' + JSON.stringify(card));
    // سباق: جهازٌ آخر أكمل الاستيلاء بعد أن فُتحت القائمة هنا ⇒ لا يُكمَل مرّتين
    await H.call('/rest/v1/branch_stock_transfers?id=eq.' + tC.id, { received_by: 'جهاز آخر · zzz999' }, 'PATCH');
    const race = await pg.evaluate(async (id) => { const out = []; const a0 = GMTAsk.alert; GMTAsk.alert = async (m) => { out.push(m); }; GMTAsk.choose = async () => 'go';
      try { await confirmIncomingTransfer(id); } finally { GMTAsk.alert = a0; } return out; }, tC.id);
    s = await dump();
    ok(race.some(a => /يجري استلامها الآن/.test(a)) && got(p4.id) === 0, 'جهازٌ آخر استولى عليها بعد فتح القائمة ⇒ «يجري استلامها الآن» بلا أيّ إضافة (مقارنة-ثمّ-تبديل)');
    // الإكمال الحقيقي + خطأ خادم عابر (503) على الحالة النهائية ⇒ يُعاد ويُحفَظ
    fail503 = 1;
    const rD = await receive('TRF-R3');
    s = await dump(); trC = s.branch_stock_transfers.find(x => x.id === tC.id);
    ok(trC.status === 'received' && got(p3.id) === 2 && got(p4.id) === 1 && got(p5.id) === 5 && fail503 === 0, '«↻ أكمِل الاستلام» ⇒ الباقي فقط (الأوّل لم يُضاعَف 2 · 1 · 5) والحالة received رغم 503 عابر: ' + trC.status + ' · ' + [got(p3.id), got(p4.id), got(p5.id)]);
    ok(rD.alerts.some(a => /اكتمل الاستلام/.test(a) && /استُلم في محاولةٍ سابقة/.test(a)), 'الرسالة: اكتمل · وبندٌ استُلم في محاولةٍ سابقة');
    ok(!/·/.test(String(trC.received_by)), 'اسم المستلِم النهائيّ بلا رمز الاستيلاء: ' + trC.received_by);
    // ── TASK-0150 (seq 57): بندٌ منتجه محذوف (كـSNBLY) لا يعلّق الفاتورة: تُستلم بما وصل، والبند يُفصل لفاتورةٍ جديدة «في الطريق» ──
    await ctx.unroute('**/*.supabase.co/**', dropRoute);   // هذا المعالج وحده (بلا معالجٍ تُزال كلّ المسارات بما فيها توصيل القاعدة الوهمية)
    const GONE = '29f7fe2f-877a-44fe-8aa4-80ad6931fc57';
    const [tE] = await H.call('/rest/v1/branch_stock_transfers', [{ transfer_number: 'TRF-00003', status: 'pending', from_branch: 'haleb', to_branch: 'daraa', from_branch_name: 'حلب', to_branch_name: 'درعا' }]);
    await H.call('/rest/v1/stock_transfer_items', [{ transfer_id: tE.id, product_id: p4.id, product_name: p4.name, qty: 3 }, { transfer_id: tE.id, product_id: GONE, product_name: 'SNBLY', qty: 1 }]);
    const p4before = Number((await dump()).products.find(x => x.id === p4.id).daraa);
    const rE = await receive('TRF-00003');
    s = await dump();
    const trE = s.branch_stock_transfers.find(x => x.id === tE.id), trNew = s.branch_stock_transfers.find(x => /متبقٍّ من TRF-00003/.test(x.title || ''));
    ok(trE.status === 'received' && Number(s.products.find(x => x.id === p4.id).daraa) === p4before + 3, 'الفاتورة اكتملت بما وصل (لم تعلق «في الطريق»): ' + trE.status);
    ok(trNew && trNew.status === 'pending' && s.stock_transfer_items.some(i => i.product_name === 'SNBLY' && i.transfer_id === trNew.id), 'و«SNBLY» في فاتورةٍ جديدة معلّقة ' + (trNew && trNew.transfer_number));
    ok(rE.alerts.some(a => /اكتمل الاستلام/.test(a) && /فُصل إلى فاتورةٍ جديدة معلّقة/.test(a)), 'الرسالة: اكتمل + فُصل البند إلى فاتورة جديدة');
    await pg.evaluate(async () => { await loadIncomingTransfers(); await openIncomingTransfers(); }); await pg.waitForTimeout(400);
    ok(await pg.evaluate((n) => !!document.querySelector('[data-trf="' + n + '"]') && !document.querySelector('[data-trf="TRF-00003"]'), trNew && trNew.transfer_number), 'في «وارد»: الجديدة ظاهرة والأصلية اختفت (مستلَمة)');
    const bad = errs.filter(e => !/favicon|أصول ناقصة|Failed to load resource|internetdisconnected|ERR_INTERNET_DISCONNECTED|Failed to fetch|503|قاعدةٌ لا تردّ/.test(e));   // الانقطاع المحاكى يُطلق تنبيه «قاعدة لا تردّ» في الكونسول — متوقَّع
    ok(bad.length === 0, 'لا أخطاء JS: ' + JSON.stringify(bad.slice(0, 3)));
    await browser.close();
  }
  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
