// (TASK-0204 + TASK-0205 · المالك seq 135) «المصروفات العامة للشركة» و«المسحوبات الشخصية للمدير» حسابان منفصلان ·
// «لما بدخل كأدمن على نافذة تدخل المصروف يدخلني على نقطة بيع وهذا غلط» · كل عملية: الحساب والسبب والمبلغ والتاريخ ·
// سجلّ أصول الشركة (البنود الستّة · 7,850$)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const ASSETS = [['فان ستاريكس', 5500], ['مجموعة لابتوبات مع هاند سكان', 1000], ['أعلام وبرواز', 150], ['رفوف وستاندات', 1000], ['مجموعة عرض', 150], ['كاميرات مراقبة', 50]];
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
(async () => {
  // ① الرئيسيّة: «مصروف» للأدمن ⇒ الإدارة · للموظّف ⇒ نقطة البيع كما كان
  await H.seed();
  for (const [who, init, re] of [['أدمن', H.ADMIN_INIT, /^admin_pos\.html\?tab=expenses&add=general$/], ['موظّف', H.STAFF_INIT, /^pos\.html\?expense=1$/]]) {
    const { browser, pg } = await H.open('home.html', { init, w: 390, wait: 4000 });
    const href = await pg.evaluate(() => { const a = [...document.querySelectorAll('a.qai')].find(x => /مصروف/.test(x.textContent)); return a ? a.getAttribute('href') : null; });
    ok(re.test(href || ''), who + ': «مصروف» في الإجراءات السريعة ⇒ ' + href);
    await browser.close();
  }
  for (const W of [390, 1366]) {
    await H.seed();
    await H.call('/rest/v1/gmt_assets', ASSETS.map(([name, value]) => ({ name, value, currency: 'usd', voided: false, note: 'سجلّ الأصول — المالك seq 135' })));
    const { browser, pg, errs } = await H.open('admin_pos.html?tab=expenses&add=general', { init: H.ADMIN_INIT, w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 6000 });
    await pg.waitForSelector('#exp-acct', { timeout: 8000 }).catch(() => {});
    const m0 = await pg.evaluate(() => ({ acct: (document.getElementById('exp-acct') || {}).value, date: (document.getElementById('exp-date') || {}).value, title: document.getElementById('modal-title').textContent,
      opts: [...document.querySelectorAll('#exp-acct option')].map(o => o.textContent.trim()), kinds: [...document.querySelectorAll('#exp-kind option')].map(o => o.textContent) }));
    ok(m0.acct === 'general' && m0.date === ymd(new Date()) && /مصروف عام للشركة/.test(m0.title), W + ': الرابط يفتح نافذة المصروف في الإدارة: الحساب «المصروفات العامة للشركة» والتاريخ اليوم: ' + JSON.stringify({ a: m0.acct, d: m0.date }));
    ok(m0.opts.length === 3 && /المصروفات العامة للشركة/.test(m0.opts[0]) && /المسحوبات الشخصية للمدير/.test(m0.opts[1]) && /مصروف فرع/.test(m0.opts[2]) && !m0.kinds.includes('شخصي'),
      W + ': الحسابات الثلاثة · «شخصي» لم يعد نوع مصروف للشركة: ' + JSON.stringify(m0.opts));
    // ② مسحوبات: تبديل الحساب لا يمسح المكتوب
    await pg.fill('#exp-title', 'سفر شخصي'); await pg.fill('#exp-amount', '25');
    await pg.selectOption('#exp-acct', 'drawing'); await pg.waitForTimeout(200);
    const m1 = await pg.evaluate(() => ({ t: document.getElementById('exp-title').value, a: document.getElementById('exp-amount').value, kindSel: !!document.querySelector('select#exp-kind'), ttl: document.getElementById('modal-title').textContent }));
    ok(m1.t === 'سفر شخصي' && m1.a === '25' && !m1.kindSel && /المسحوبات الشخصية للمدير/.test(m1.ttl), W + ': «المسحوبات الشخصية للمدير» ⇒ بلا «نوع مصروف» والمكتوب باقٍ: ' + JSON.stringify(m1));
    await pg.selectOption('#exp-currency', 'usd');
    await pg.evaluate(() => document.querySelector('#modal-body button[onclick^="saveExpense"]').click()); await pg.waitForTimeout(900);
    // ③ مصروف عام للشركة بتاريخ أمس
    const y = new Date(); y.setDate(y.getDate() - 1);
    await pg.evaluate(() => openAddExpenseModal(true));
    await pg.fill('#exp-title', 'إيجار المستودع'); await pg.fill('#exp-amount', '10'); await pg.selectOption('#exp-currency', 'usd'); await pg.fill('#exp-date', ymd(y));
    await pg.evaluate(() => document.querySelector('#modal-body button[onclick^="saveExpense"]').click()); await pg.waitForTimeout(900);
    // التاريخ المستقبليّ مرفوض
    const t2 = new Date(); t2.setDate(t2.getDate() + 3);
    await pg.evaluate(() => openAddExpenseModal(true));
    await pg.fill('#exp-title', 'مستقبل'); await pg.fill('#exp-amount', '5'); await pg.selectOption('#exp-currency', 'usd'); await pg.fill('#exp-date', ymd(t2));
    await pg.evaluate(() => document.querySelector('#modal-body button[onclick^="saveExpense"]').click()); await pg.waitForTimeout(600);
    await pg.evaluate(() => closeModal());
    const rows = await H.call('/rest/v1/gmt_expenses?select=*', undefined, 'GET');
    const dr = rows.find(r => r.title === 'سفر شخصي'), gn = rows.find(r => r.title === 'إيجار المستودع');
    ok(rows.length === 2 && dr && dr.kind === 'مسحوبات شخصية للمدير' && dr.is_general === true && dr.branch_key == null && dr.approved === true && Number(dr.amount) === 25,
      W + ': المسحوبات حُفظت بحسابها (kind «مسحوبات شخصية للمدير») والتاريخ المستقبليّ رُفض: ' + JSON.stringify(rows.map(r => [r.title, r.kind])));
    ok(gn && gn.is_general === true && gn.kind === 'تشغيلي' && ymd(new Date(gn.created_at)) === ymd(y), W + ': المصروف العام بتاريخه المختار (' + ymd(y) + '): ' + (gn && gn.created_at));
    // ④ القائمة: المسحوبات خارج «إجمالي المصاريف» ولها بطاقة وحدها
    const v = await pg.evaluate(() => ({ txt: document.getElementById('app-content').innerText, dr: (document.querySelector('[data-exp-drawings]') || {}).innerText || '' }));
    ok(/إجمالي المصاريف المعتمدة\s*10\.00\$/.test(v.txt) && /25\.00\$/.test(v.dr) && /المسحوبات الشخصية للمدير/.test(v.txt) && /المصروفات العامة للشركة/.test(v.txt),
      W + ': «إجمالي المصاريف» 10$ فقط · المسحوبات 25$ في بطاقتها');
    // ⑤ الدفتر: الربح لا يطرح المسحوبات · الصندوق ينقصها في سطرها
    const L = await pg.evaluate(() => { const ctx = { invoices: [], transfers: [], comm: [], expenses: allExpenses, isMgmt: () => true, isExcluded: () => false, opening: 100 };
      const p = GMTLedger.profit(ctx, null, () => ({ known: true, cost: 0 })), c = GMTLedger.centralCash(ctx, null); return { exp: p.expenses, dr: p.drawings, profit: p.profit, cDr: c.lines.drawingsCentral, cExp: c.lines.expCentral, total: c.total }; });
    ok(L.exp === 10 && L.dr === 25 && L.profit === -10 && L.cDr === 25 && L.cExp === 10 && L.total === 65, W + ': الربح −10 (بلا المسحوبات) · الصندوق 100−10−25=65 بسطرٍ للمسحوبات: ' + JSON.stringify(L));
    await pg.evaluate(() => switchTab('accounting')); await pg.waitForTimeout(500);
    const acc = await pg.evaluate(() => document.getElementById('app-content').innerText);
    ok(/−\s*المسحوبات الشخصية للمدير\s*25\.00\$/.test(acc) && /−\s*مصاريف الإدارة \(عامّة \/ دفعتَها أنت\)\s*10\.00\$/.test(acc), W + ': المحاسبة: صندوق الإدارة — المسحوبات 25$ في سطرها والمصاريف العامة 10$ في سطرها');
    // ⑥ الأصول
    await pg.evaluate(() => switchTab('assets')); await pg.waitForTimeout(800);
    const a = await pg.evaluate(() => ({ rows: [...document.querySelectorAll('[data-asset-row]')].map(r => r.innerText.replace(/\s+/g, ' ')), tot: (document.querySelector('[data-assets-total]') || {}).textContent }));
    ok(a.rows.length === 6 && a.tot === '7,850$' && /فان ستاريكس/.test(a.rows[0]) && /5,500\$/.test(a.rows[0]) && /كاميرات مراقبة/.test(a.rows[5]), W + ': تبويب «🏢 الأصول»: ٦ بنود · الإجمالي 7,850$: ' + a.tot);
    await pg.evaluate(() => openAddAssetModal()); await pg.fill('#as-name', 'طابعة ملصقات'); await pg.fill('#as-value', '120');
    await pg.evaluate(() => document.querySelector('[data-asset-save]').click()); await pg.waitForTimeout(800);
    const db1 = await H.call('/rest/v1/gmt_assets?select=*', undefined, 'GET');
    const t1 = await pg.evaluate(() => document.querySelector('[data-assets-total]').textContent);
    ok(db1.length === 7 && db1.some(x => x.name === 'طابعة ملصقات' && Number(x.value) === 120) && t1 === '7,970$', W + ': «➕ أصل جديد» يُحفظ والإجمالي 7,970$');
    await pg.evaluate(() => { GMTAsk.prompt = async () => 'بيعت'; const id = allAssets.find(x => x.name === 'طابعة ملصقات').id; return voidAsset(id); }); await pg.waitForTimeout(600);
    const db2 = await H.call('/rest/v1/gmt_assets?select=*', undefined, 'GET'); const vd = db2.find(x => x.name === 'طابعة ملصقات');
    ok(db2.length === 7 && vd.voided === true && vd.void_reason === 'بيعت' && await pg.evaluate(() => document.querySelector('[data-assets-total]').textContent) === '7,850$', W + ': الإبطال لا يحذف (يبقى بسببه) ويُخفى من السجلّ');
    const hs = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(!hs, W + ': لا طفح أفقي');
    if (W === 390) await pg.screenshot({ path: '/tmp/gmt-out/assets_390.png' });
    const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
