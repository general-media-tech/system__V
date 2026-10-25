// (19 ت1 · TASK-0029 + TASK-0025) أزرار الأوردرات المرتبطة/المرتجعة في ⋮ لكل مرحلة · تعديل الفرع المُرسِل من نافذة التعديل
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  for (const w of [390, 1366]) {
    console.log('— ' + w);
    await H.seed();
    await H.call('/__opts', { reject_cols: [], rls_block: [] });
    const base = { phone: '0933000020', product: 'كاميرا', qty: 1, price: 100, branch: 'حلب', address: 'دمشق' };
    const stages = ['pending', 'prepared', 'shipped', 'delivered', 'completed'];
    const rows = await H.call('/rest/v1/gmt_orders', stages.map((s, i) => ({ ...base, name: 'مرتبط ' + s, status: s, invoice_number: 'INV-9' + i, is_locked: true, shipping_company: 'مسارات', tracking_number: s === 'pending' || s === 'prepared' ? null : '77' + i }))
      .concat([{ ...base, name: 'مفتي للتعديل', status: 'shipped', shipping_company: 'المفتي', tracking_number: '196682', ship_from_office: 'حلب|السريان' }]));
    const ids = rows.map(r => r.id), M = ids[ids.length - 1];
    const { browser, pg, errs } = await H.open('orders.html', { w, mobile: w < 700, h: 900, wait: 4500, init: H.ADMIN_INIT });
    for (let i = 0; i < stages.length; i++) {
      const items = await pg.evaluate(id => cardMoreItems(orders.find(o => o.id == id)).map(x => x.t), ids[i]);
      ok(items.some(t => /مرتجع الفاتورة/.test(t)) && items.some(t => /بطاقة الفاتورة المرتبطة #INV-9/.test(t)), stages[i] + ': ⋮ فيه «مرتجع الفاتورة» و«بطاقة الفاتورة»');
    }
    // القائمة نفسها: ثلاثة خيارات حقيقية
    await pg.evaluate(id => openLinkedActions(id), ids[2]); await pg.waitForTimeout(400);
    const txt = await pg.evaluate(() => document.body.innerText);
    ok(/↩︎ مرتجع الفاتورة/.test(txt) && /مرتجع \+ فكّ الارتباط ⇐ تعديل/.test(txt) && /مرتجع \+ فكّ الارتباط ⇐ فاتورة جديدة/.test(txt), 'نافذة المرتجع تعرض الخيارات الثلاثة (مرتجع · مرتجع+تعديل · مرتجع+فاتورة جديدة)');
    await pg.keyboard.press('Escape'); await pg.evaluate(() => document.querySelectorAll('.gmtask-ov,[id$="-ov"]').forEach(e => e.remove()));
    // التعديل على أوردرٍ مرتبط يمرّ بالمرتجع لا بالتعديل المباشر
    await pg.evaluate(id => { window.__la = []; const f = window.openLinkedActions; window.openLinkedActions = x => window.__la.push(x); openEditModal(id); window.openLinkedActions = f; }, ids[1]);
    ok((await pg.evaluate(() => window.__la)).length === 1 && await pg.evaluate(() => document.getElementById('editModal').classList.contains('hidden')), 'تعديل أوردرٍ مرتبط بفاتورة يفتح المرتجع/الفكّ لا نافذة التعديل');
    // TASK-0025: الفرع المُرسِل من نافذة التعديل
    await pg.evaluate(id => openEditModal(id), M); await pg.waitForTimeout(500);
    const before = await pg.evaluate(() => ({ vis: !document.getElementById('edit-sender-wrap').classList.contains('hidden'), v: document.getElementById('edit-ship-from').value, opts: [...document.getElementById('edit-ship-from').options].map(o => o.value).filter(Boolean) }));
    ok(before.vis && before.v === 'حلب|السريان', 'نافذة التعديل تعرض الفرع المُرسِل الحالي: ' + before.v);
    const other = before.opts.find(v => v !== 'حلب|السريان');
    await pg.selectOption('#edit-ship-from', other);
    await pg.evaluate(() => document.getElementById('saveEditBtn').click()); await pg.waitForTimeout(1800);
    /* (TASK-0169 · seq 83) بعد كل تعديل: «نرجع نبلّغ؟» ⇒ «لا» كما يجيب الموظّف */
    const reAsk = await pg.evaluate(() => { const o = [...document.querySelectorAll('.gmtask-ov')].find(x => /نرجع نبلّغ/.test(x.innerText)); if (!o) return false; [...o.querySelectorAll('button')].find(b => b.textContent.trim() === 'لا').click(); return true; });
    ok(reAsk, 'بعد التعديل يسأل «نرجع نبلّغ؟» (seq 83)');
    await pg.waitForTimeout(300);
    const db = (await H.call('/__dump', undefined, 'GET')).gmt_orders.find(o => o.id == M);
    ok(db && db.ship_from_office === other, 'الحفظ يكتب الفرع الجديد في القاعدة: ' + (db && db.ship_from_office) + ' (المطلوب ' + other + ')');
    ok(await pg.evaluate((id) => (orders.find(o => o.id == id) || {}).ship_from_office, M) === other, 'الواجهة تحدّثت بلا إعادة تحميل');
    // تغيير الشركة لغير المفتي يُخفي الحقل
    await pg.evaluate(id => openEditModal(id), M); await pg.waitForTimeout(400);
    /* (TASK-0163 · seq 75) القدموس ومسارات لهما فرعٌ مُرسِل من بنكهما ⇒ الحقل يبقى · شركةٌ بلا بنك ⇒ يختفي */
    const setCo = pick => pg.evaluate(src => { const s = document.getElementById('edit-company'); s.value = [...s.options].map(o => o.value).find(new Function('v', 'return ' + src)); s.dispatchEvent(new Event('change', { bubbles: true }));
      return { co: s.value, hidden: document.getElementById('edit-sender-wrap').classList.contains('hidden') }; }, pick);
    let sc = await setCo("v === 'القدموس'");
    ok(sc.co === 'القدموس' && !sc.hidden, 'القدموس ⇐ حقل الفرع المُرسِل يبقى (فروعها من بنكها — TASK-0163): ' + JSON.stringify(sc));
    sc = await setCo("v && TRANSFER_COS.indexOf(v) === -1");
    ok(sc.co && sc.hidden, 'شركةٌ بلا بنك فروع ⇐ حقل الفرع المُرسِل يختفي: ' + JSON.stringify(sc));
    const real = errs.filter(e => !/Failed to load resource/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
