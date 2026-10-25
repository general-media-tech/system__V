// TASK-0152 — المالك seq 57 (23–24 ت1): «القيمة عم تتصفّر لحالها لو عم نكتب» · «ممنوع أي قيمة صفر — كلمة سرّ وسبب (كمالة أوردر · مدفوع
// شام كاش · غيره)» · «عند تعديل الطلب عم يطلع قيمة واحدة — لازم المبلغ الأساسي والمراد تحصيله» · «قيمة الطلب تدخل المجموع ولو التحصيل صفر» ·
// البطاقة: «19 مشطوبة إنها محصّلة … 35 · 15 فقط للتحصيل» · «قيد التجهيز ما فيه زرّ مراسلة واتساب» · «شكل زرّ عرض الإيصال يوحي بحوالة/فاتورة ($)».
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const get = async id => (await H.call('/rest/v1/gmt_orders?id=eq.' + id, undefined, 'GET'))[0];
const tiny = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

async function dialog(pg) {
  await pg.waitForFunction(() => [...document.querySelectorAll('.gmtask-ov')].some(x => !/نرجع نبلّغ/.test(x.innerText)), null, { timeout: 6000 }).catch(() => {});
  return pg.evaluate(() => { const o = [...document.querySelectorAll('.gmtask-ov')].reverse().find(x => !/نرجع نبلّغ/.test(x.innerText)) || null; return o ? { text: o.innerText.replace(/\s+/g, ' '), btns: [...o.querySelectorAll('button')].map(b => b.textContent.trim()) } : null; });
}
/* (TASK-0169 · seq 83) بعد كل تعديل يُسأل «نرجع نبلّغ؟» ⇒ يُجاب «لا» (يُرجع: هل سُئل) */
const noRenotify = pg => pg.waitForFunction(() => [...document.querySelectorAll('.gmtask-ov')].some(x => /نرجع نبلّغ/.test(x.innerText)), null, { timeout: 6000 })
  .then(() => pg.evaluate(() => { const o = [...document.querySelectorAll('.gmtask-ov')].find(x => /نرجع نبلّغ/.test(x.innerText)); [...o.querySelectorAll('button')].find(b => b.textContent.trim() === 'لا').click(); return true; })).catch(() => false);
async function press(pg, re) {
  await pg.evaluate(src => { const rx = new RegExp(src); const b = [...document.querySelectorAll('.gmtask-ov button')].find(x => rx.test(x.textContent)); if (b) b.click(); }, re.source);
  await pg.waitForTimeout(500);
}

(async () => {
  await H.seed();
  for (const [w, h] of [[390, 844], [1366, 800]]) {
    console.log(`— ${w}×${h}`);
    // (TASK-0166 · seq 79/82/86) أوردرات الأجور: 85 + 2 ⇒ 87 رقمٌ واحد · مكتملٌ بتحصيلٍ أقلّ ⇒ 85 كاملة في الحسابات
    const [oFee, oDoneFee, oDonePart] = await H.call('/rest/v1/gmt_orders', [
      { name: 'أجور ' + w, phone: '0933000706', product: 'كاميرا', qty: 1, price: 85, collect_amount: 87, status: 'pending', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي' },
      { name: 'مكتمل أجور ' + w, phone: '0933000707', product: 'عدسة', qty: 1, price: 85, collect_amount: 87, status: 'completed', branch: 'حلب', address: 'حمص', shipping_company: 'المفتي' },
      { name: 'مكتمل جزئي ' + w, phone: '0933000708', product: 'حامل', qty: 1, price: 85, collect_amount: 15, status: 'completed', branch: 'حلب', address: 'حماة', shipping_company: 'المفتي' }]);
    const [oFull, oPaid, oPart, oShip, oZero] = await H.call('/rest/v1/gmt_orders', [
      { name: 'كامل ' + w, phone: '0933000701', product: 'كاميرا', qty: 1, price: 50, status: 'pending', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي' },
      { name: 'مدفوع ' + w, phone: '0933000702', product: 'عدسة', qty: 1, price: 19, collect_amount: 0, status: 'pending', branch: 'حلب', address: 'حمص' },
      { name: 'جزئي ' + w, phone: '0933000703', product: 'حامل', qty: 1, price: 35, collect_amount: 15, status: 'pending', branch: 'حلب', address: 'حماة' },
      { name: 'مشحون ' + w, phone: '0933000704', product: 'فلاش', qty: 1, price: 20, status: 'shipped', branch: 'حلب', address: 'درعا', shipping_company: 'المفتي', receipt_img: tiny, receipt_at: new Date().toISOString() },
      { name: 'صفر قديم ' + w, phone: '0933000705', product: 'كفر', qty: 1, price: 0, status: 'pending', branch: 'حلب', address: 'إدلب' }]);
    const { browser, pg, errs } = await H.open('orders.html', { w, h, wait: 4500 });
    await pg.evaluate(async () => { await loadOrders(); });
    await pg.waitForTimeout(500);

    // ١) لا تصفير أثناء الكتابة: أرقام عربية · فاصلة عشرية
    await pg.evaluate(() => { document.getElementById('addModal').classList.remove('hidden'); initAddModal(); });
    const typeIn = async (txt) => {
      await pg.evaluate(() => initAddModal());
      await pg.click('#in-price'); await pg.keyboard.type(txt);
      const during = await pg.evaluate(() => document.getElementById('in-price').value);
      await pg.click('#in-name');
      return { during, after: await pg.evaluate(() => document.getElementById('in-price').value), coll: await pg.evaluate(() => document.getElementById('in-collect').value) };
    };
    let r = await typeIn('١٥');
    ok(r.during === '15' && Number(r.after) >= 15, 'أرقام عربية «١٥» ⇒ 15 (كانت تصير 0 عند الخروج من الحقل): ' + JSON.stringify(r));
    r = await typeIn('15,5');
    ok(r.during === '15.5', 'الفاصلة العشرية «15,5» ⇒ 15.5 (كانت 155): ' + JSON.stringify(r));
    r = await typeIn('٢٠٫٥');
    ok(r.during === '20.5', '«٢٠٫٥» ⇒ 20.5: ' + JSON.stringify(r));
    const def = await pg.evaluate(() => { initAddModal(); return document.getElementById('in-price').value; });
    ok(def === '', 'حقل قيمة الطلب يبدأ فارغاً (لا «0» افتراضية): «' + def + '»');

    // ٢) الإنشاء بقيمة صفر ⇒ سؤال السبب؛ «رجوع» ⇒ لا حفظ
    const fill = async (price, collect) => pg.evaluate(({ price, collect }) => {
      initAddModal();
      document.getElementById('in-name').value = 'زبون صفر';
      document.getElementById('in-phone').value = '0933000799';
      document.getElementById('in-addr').value = 'حمص';
      const row = document.querySelector('#add-items-container .item-row');
      const nm = row.querySelector('[data-field="name"]'); nm.value = 'عدسة'; try { nm.dataset.confirmed = '1'; row.dataset.confirmed = '1'; } catch (_) {}
      document.getElementById('in-price').value = price;
      document.getElementById('in-collect').value = collect;
      try { window.blockIfUnconfirmed = () => false; } catch (_) {}
    }, { price, collect });
    const nBefore = (await H.call('/rest/v1/gmt_orders?select=id', undefined, 'GET')).length;
    await fill('0', '0');
    await pg.evaluate(() => document.getElementById('saveBtn').click());
    let d = await dialog(pg);
    ok(d && /قيمة الطلب ٠/.test(d.text) && d.btns.some(b => /كمالة أوردر/.test(b)) && d.btns.some(b => /مدفوع شام كاش/.test(b)) && d.btns.some(b => /سببٌ آخر/.test(b)),
      'قيمة صفر ⇒ «ما السبب؟»: كمالة أوردر · مدفوع شام كاش · سببٌ آخر: ' + JSON.stringify(d && d.btns));
    await press(pg, /رجوع/);
    await pg.waitForTimeout(600);
    ok((await H.call('/rest/v1/gmt_orders?select=id', undefined, 'GET')).length === nBefore, '«رجوع» ⇒ لم يُحفظ شيء');

    // ٣) قيمة 16 ومراد تحصيله ٠ ⇒ «مدفوع شام كاش» + كلمة سرّ الأدمن ⇒ يُحفظ والسبب ومن أذن في الملاحظات · الجهاز لا يبقى أدمناً
    /* الأدمن يأذن: النافذة الحقيقية تمنح الجلسة — الحارس يعيدها مغلقة (لم يكن الجهاز أدمناً). (حزمة الاختبار تضبط وضع الإدارة في كل إطارٍ
       يُحمَّل، فيُفحص الإغلاق لحظة الإذن لا بعده.) */
    await pg.evaluate(() => { window.__adm = []; window.__seq = [];
      const R = GMTRole.revoke.bind(GMTRole); GMTRole.revoke = () => { const x = R(); __seq.push('revoke:' + GMTRole.isAdmin()); return x; };
      GMTAuth.admin.login = async (w) => { __adm.push(w); try { GMTRole.grant('المالك'); } catch (_) {} __seq.push('grant'); return 'المالك'; };
      try { GMTRole.revoke(); } catch (_) {} __seq.length = 0; });
    await fill('16', '0');
    await pg.evaluate(() => document.getElementById('saveBtn').click());
    d = await dialog(pg);
    ok(d && /المراد تحصيله ٠ \(قيمة الطلب \$16\)/.test(d.text), 'مراد تحصيله ٠ ⇒ السؤال يذكره مع قيمة الطلب: ' + (d && d.text.slice(0, 80)));
    await press(pg, /مدفوع شام كاش/);
    await pg.waitForTimeout(1500);
    const all = await H.call('/rest/v1/gmt_orders?select=*&name=eq.' + encodeURIComponent('زبون صفر'), undefined, 'GET');
    const sv = all[all.length - 1];
    const adm = await pg.evaluate(() => ({ asked: __adm.slice(), seq: __seq.slice() }));
    await press(pg, /لاحقاً|إلغاء/);                                   // «تبليغ الزبون» (واتساب ممنوع في متصفّح الاختبار)
    ok(sv && Number(sv.price) === 16 && Number(sv.collect_amount) === 0 && /مدفوع شام كاش/.test(sv.notes || '') && /أذن: المالك/.test(sv.notes || ''),
      'حُفظ: قيمة 16 · تحصيل 0 · الملاحظة «مدفوع شام كاش · أذن: المالك»: ' + JSON.stringify(sv && { p: sv.price, c: sv.collect_amount, n: (sv.notes || '').split('\n')[0] }));
    ok(adm.asked.length === 1 && JSON.stringify(adm.seq) === '["grant","revoke:false"]', 'كلمة سرّ الأدمن طُلبت مرّة، وأُغلق وضع الإدارة فور الإذن (لم يكن الجهاز أدمناً): ' + JSON.stringify(adm));

    // ٤) التعديل يُظهر القيمتين ويحفظ المراد تحصيله
    await pg.evaluate(async () => { closeModal('addModal'); await loadOrders(); });
    const ed = await pg.evaluate(async (id) => { await openEditModal(id); return { p: document.getElementById('edit-price').value, c: document.getElementById('edit-collect').value }; }, oPart.id);
    ok(ed.p === '35' && ed.c === '15', 'التعديل يُظهر القيمتين: قيمة الطلب 35 · المراد تحصيله 15: ' + JSON.stringify(ed));
    await pg.evaluate(() => { document.getElementById('edit-collect').value = '20'; document.getElementById('saveEditBtn').click(); });
    await pg.waitForTimeout(1500);
    ok(await noRenotify(pg), 'بعد حفظ التعديل يُسأل «نرجع نبلّغ؟» (seq 83) ⇒ «لا»');
    let g = await get(oPart.id);
    ok(Number(g.price) === 35 && Number(g.collect_amount) === 20, 'حفظ التعديل: قيمة 35 · تحصيل 20: ' + JSON.stringify({ p: g.price, c: g.collect_amount }));
    // تعديل التحصيل إلى ٠ ⇒ السؤال · «رجوع» ⇒ لا تغيير
    await pg.evaluate(async (id) => { await loadOrders(); await openEditModal(id); document.getElementById('edit-collect').value = '0'; document.getElementById('saveEditBtn').click(); }, oFull.id);
    d = await dialog(pg);
    ok(d && /المراد تحصيله ٠/.test(d.text), 'التعديل إلى تحصيل ٠ ⇒ السؤال نفسه');
    await press(pg, /رجوع/);
    g = await get(oFull.id);
    ok(g.collect_amount == null && Number(g.price) === 50, '«رجوع» ⇒ الأوردر كما كان');
    // أوردر صفرُه قديم: تعديل الاسم وحده لا يسأل
    await pg.evaluate(async (id) => { closeModal('editModal'); await openEditModal(id); document.getElementById('edit-name').value = 'صفر قديم معدّل'; document.getElementById('saveEditBtn').click(); }, oZero.id);
    await pg.waitForTimeout(1500);
    /* لا سؤال الصفر — والسؤال الوحيد «نرجع نبلّغ؟» (TASK-0169) */
    const noAsk = await pg.evaluate(() => [...document.querySelectorAll('.gmtask-ov')].every(x => /نرجع نبلّغ/.test(x.innerText) && !/السبب/.test(x.innerText)));
    await noRenotify(pg);
    g = await get(oZero.id);
    ok(noAsk && /معدّل/.test(g.name), 'صفرٌ محفوظ سابقاً: تعديلٌ آخر لا يسأل من جديد');

    // ٥) البطاقات · ٦) واتساب «قيد التجهيز» · ٧) أيقونة الإيصال · ٨) المجموع بقيمة الطلب
    await pg.evaluate(async () => { closeModal('editModal'); await loadOrders(); render(); });
    await pg.waitForTimeout(600);
    const cards = await pg.evaluate((ids) => {
      const out = {};
      for (const [k, id] of Object.entries(ids)) {
        const el = document.querySelector('#card-' + id + ' [data-amt-card]');
        out[k] = el ? { kind: el.getAttribute('data-amt-card'), text: el.innerText.replace(/\s+/g, ' ') } : null;
      }
      return out;
    }, { full: oFull.id, paid: oPaid.id, part: oPart.id, fee: oFee.id });
    ok(cards.paid && cards.paid.kind === 'paid' && /\$19/.test(cards.paid.text) && /محصّلة مسبقاً/.test(cards.paid.text), 'بطاقة «تحصيل ٠»: $19 مشطوبة «✓ محصّلة مسبقاً» (كانت $0): ' + JSON.stringify(cards.paid));
    ok(cards.part && cards.part.kind === 'part' && /\$35/.test(cards.part.text) && /للتحصيل \$20/.test(cards.part.text), 'بطاقة جزئيّة: «$35 · للتحصيل $20»: ' + JSON.stringify(cards.part));
    ok(cards.full && cards.full.kind === 'full' && /\$50/.test(cards.full.text), 'بطاقة كاملة: $50 كما كانت');
    const ui = await pg.evaluate((ids) => ({
      waPending: !!document.querySelector(`[data-wa-pending][onclick*="(${ids.full})"]`),
      waShipped: !!document.querySelector(`[data-wa-pending][onclick*="(${ids.ship})"]`),
      rcptNew: !!document.querySelector(`[onclick="viewReceipt(${ids.ship})"] [data-rcpt-icon]`),
      rcptOld: !!document.querySelector(`[onclick="viewReceipt(${ids.ship})"] [data-lucide="receipt"], [onclick="viewReceipt(${ids.ship})"] .lucide-receipt`),
      sumPending: (document.getElementById('sumPending') || {}).textContent || '',
      sumCompleted: (document.getElementById('sumCompleted') || {}).textContent || '',
      /* (TASK-0166 · seq 82 — يغلب seq 57) الجاري ⇒ ما بقي للتحصيل (المحصَّل مسبقاً خارجه) · المكتمل ⇒ الأكبر من القيمة والتحصيل */
      expect: orders.filter(o => o.status === 'pending').reduce((t, o) => t + (o.collect_amount == null ? (Number(o.price) || 0) : Number(o.collect_amount)), 0),
      expectC: orders.filter(o => o.status === 'completed').reduce((t, o) => t + Math.max(Number(o.price) || 0, o.collect_amount == null ? 0 : Number(o.collect_amount)), 0),
      month: (() => { const m = buildMonthlyReport()[0]; return { total: m.total, completedAmt: m.completedAmt, pendingAmt: m.pendingAmt }; })(),
      expectM: orders.reduce((t, o) => t + Math.max(Number(o.price) || 0, o.collect_amount == null ? 0 : Number(o.collect_amount)), 0)
    }), { full: oFull.id, ship: oShip.id });
    ok(ui.waPending && !ui.waShipped, 'زرّ واتساب الزبون على «قيد التجهيز» (لا على «في الطريق»): ' + JSON.stringify({ p: ui.waPending, s: ui.waShipped }));
    ok(ui.rcptNew && !ui.rcptOld, 'زرّ عرض الإيصال: ورقة بوليصةٍ بباركود لا أيقونة الفاتورة ($)');
    const url = await pg.evaluate((id) => { let u = ''; const W = window.open; window.open = (x) => { u = x; }; contactCustomerPending(id); window.open = W; return u; }, oFull.id);
    ok(/wa\.me\/963933000701|phone=963933000701/.test(url) && /%D8%A8%D8%AE%D8%B5%D9%88%D8%B5/.test(url), 'الزرّ يفتح واتساب الزبون (963…) برسالة «بخصوص طلبك»');
    ok(cards.fee && cards.fee.kind === 'full' && /\$87/.test(cards.fee.text) && !/\$85/.test(cards.fee.text), 'بطاقة أجور الشحن (85 + 2): رقمٌ واحد $87 لا «85 · للتحصيل 87»: ' + JSON.stringify(cards.fee));
    ok(ui.sumCompleted === '$' + ui.expectC.toLocaleString() && ui.expectC >= 87 + 85, 'مجموع «تم التحصيل»: 87 كاملة لأوردر الأجور و85 كاملة لتحصيلٍ أقلّ (15): ' + ui.sumCompleted + ' = ' + ui.expectC);
    ok(Math.abs(ui.month.total - ui.expectM) < 0.01 && ui.month.completedAmt >= 87 + 85, 'الملخّص الشهري (مبيعات الشحن): قيمة كل أوردر كاملة والمحصَّل مسبقاً داخل: ' + JSON.stringify(ui.month) + ' = ' + ui.expectM);
    ok(ui.sumPending === '$' + ui.expect.toLocaleString() && ui.expect >= 16 + 0 + 15 + 87, 'مجموع «قيد التجهيز» بما بقي للتحصيل (المحصَّل مسبقاً خارجه · seq 82) — 87 للأجور: ' + ui.sumPending + ' = ' + ui.expect);

    const bad = errs.filter(e => !/favicon|أصول ناقصة|Failed to load resource|404/.test(e));
    ok(bad.length === 0, 'لا أخطاء JS: ' + JSON.stringify(bad.slice(0, 3)));
    await browser.close();
  }
  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
