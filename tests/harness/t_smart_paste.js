// اختبار اللصق الذكي (وثيقة الطلبات §١٠ · 19 ت1): العلامات لا تُؤخذ قيماً · الأرقام العربية · التحيّات · الاسم ≤ ٤ كلمات
// · ما لم يُفهم يبقى وحده (نسخ/تحديد: منتج · اسم · رقم · عنوان · ملاحظة) · مفتاح التعرّف على المنتجات — والصيغ القديمة لا تنكسر
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };

async function fill(pg, msg) {
  return pg.evaluate(async (m) => {
    ['in-name', 'in-phone', 'in-addr', 'in-price', 'in-notes', 'in-company'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });   // كأوردرٍ جديد: لا شركة باقية من الرسالة السابقة
    document.getElementById('sp-text').value = m; await smartFillFromPaste();
    await new Promise(r => setTimeout(r, 150));
    const unk = document.getElementById('sp-unk-text');
    return {
      name: document.getElementById('in-name').value, phone: document.getElementById('in-phone').value, addr: document.getElementById('in-addr').value,
      price: (document.getElementById('in-price') || {}).value, notes: (document.getElementById('in-notes') || {}).value,
      items: [...document.querySelectorAll('#add-items-container [data-row] input[type=text], #add-items-container input.item-name, #add-items-container input[id^="add-name"]')].map(i => i.value).filter(Boolean),
      itemsAll: [...document.querySelectorAll('#add-items-container input')].map(i => i.value).filter(v => v && !/^\d+$/.test(v)),
      unk: unk ? unk.value : '', rep: document.getElementById('sp-result').innerText.replace(/\s+/g, ' ')
    };
  }, msg);
}

(async () => {
  await H.seed();
  for (const [w, h] of [[390, 900], [1366, 800]]) {
    console.log(`— ${w}×${h}`);
    const { browser, pg, errs } = await H.open('orders.html', { w, h, wait: 4500, init: H.ADMIN_INIT + "localStorage.removeItem('gmt_sp_products');" });
    await pg.evaluate(() => { try { openAddModal && openAddModal(); } catch (_) {} const m = document.getElementById('addModal'); if (m) m.classList.remove('hidden'); });
    await pg.waitForTimeout(500);

    // §١٠ — العلامات
    let r = await fill(pg, 'الاسم: محمد أحمد الخطيب\nالرقم: 0988123456\nالعنوان: حلب السريان');
    ok(r.name === 'محمد أحمد الخطيب', 'كلمة «الاسم» لم تُؤخذ: ' + r.name);
    ok(r.phone === '0988123456', '«الرقم:» ⇒ الرقم بعدها: ' + r.phone);
    ok(/^حلب — السريان/.test(r.addr), '«العنوان:» ⇒ حلب — السريان: ' + r.addr.slice(0, 30));
    ok(!/الاسم|العنوان|الرقم/.test(r.unk + r.name + r.addr), 'لا تبقى كلمات العلامات في أيّ حقل ولا في المتروك');

    r = await fill(pg, 'رقم الهاتف 0955000111 الاسم خالد العلي المدينة حماة');
    ok(r.name === 'خالد العلي' && r.phone === '0955000111' && /^حماة/.test(r.addr), 'علامات في سطرٍ واحد بلا «:» — ' + [r.name, r.phone, r.addr.slice(0, 12)].join(' | '));

    r = await fill(pg, 'مرحبا بدي اطلب\nالاسم : سامر\nموبايل: ٠٩٤٤١٢٣٤٥٦\nالمحافظة: اللاذقية\nالعنوان: الزراعة');
    ok(r.name === 'سامر', 'التحية «مرحبا بدي اطلب» لم تُؤخذ اسماً: ' + r.name);
    ok(r.phone === '0944123456', 'الأرقام العربية ٠٩٤٤… ⇒ هاتف: ' + r.phone);
    ok(/^اللاذقية — الزراعة/.test(r.addr), '«المحافظة» + «العنوان» ⇒ اللاذقية — الزراعة: ' + r.addr.slice(0, 25));

    r = await fill(pg, 'الاسم محمد عبد الرحمن علي الحسن الشامي\n0999123456\nحمص');
    ok(r.name === 'محمد عبد الرحمن علي الحسن', 'الاسم ≤ ٤ كلمات («عبد الرحمن» كلمة): ' + r.name);
    ok(/الشامي/.test(r.unk), 'الزائد «الشامي» بقي لك لتحدّده: ' + JSON.stringify(r.unk));

    r = await fill(pg, 'اسم أحمد علي\nرقم 0933 111 222\nعنوان دمشق البرامكة\nملاحظة: اتصل قبل التسليم');
    ok(r.name === 'أحمد علي' && r.phone === '0933111222' && /^دمشق — البرامكة/.test(r.addr), 'علامات بلا «ال» (اسم · رقم · عنوان)');
    ok(/اتصل قبل التسليم/.test(r.notes || ''), '«ملاحظة:» ⇒ الملاحظات');
    ok(!r.unk, 'رسالةٌ فُهمت كلّها ⇒ لا شيء متروك (لا يُعاد ما فُهم)');

    // الصيغ القديمة — لا تنكسر
    r = await fill(pg, 'بلال الخطيب\nحلب – السليمانية\n0988733536');
    ok(r.name === 'بلال الخطيب' && r.phone === '0988733536' && /^حلب/.test(r.addr), 'اسم ⇐ مدينة ⇐ رقم: ' + [r.name, r.addr.slice(0, 10)].join(' | '));
    r = await fill(pg, '0988733536\nبلال الخطيب');
    ok(r.name === 'بلال الخطيب', 'الرقم قبل الاسم');
    r = await fill(pg, 'سامر الحلبي\n0999111222\nحمص');
    ok(/^حمص/.test(r.addr), 'لقب «الحلبي» لا يسرق الوجهة: ' + r.addr.slice(0, 12));

    // المنتجات + المتروك + المفتاح
    r = await fill(pg, 'كاميرا تجربة 5\nأحمد علي\n0933000112\nدمشق');
    ok(r.name === 'أحمد علي', 'منتجٌ قبل الاسم لا يُؤخذ اسماً');
    /* («5» في آخر السطر تُقرأ كمية — سلوكٌ مقصود) المهمّ أنّ المنتج المكتوب قبل الرقم لم يُرمَ كما كان */
    ok(r.itemsAll.some(v => /كاميرا تجربة/.test(v)) || /كاميرا تجربة/.test(r.unk), 'منتجٌ مكتوبٌ قبل الرقم لم يضع: ' + JSON.stringify(r.itemsAll) + ' · ' + r.unk);
    r = await fill(pg, 'خالد\n0933000113\nحماة\nشي غريب ما بينفهم');
    ok(/شي غريب ما بينفهم/.test(r.unk) && !/خالد|0933000113|حماة/.test(r.unk), 'المتروك = ما لم يُفهم فقط: ' + JSON.stringify(r.unk));
    // تحديد سطرٍ متروك: «رقم» و«اسم»
    await pg.evaluate(() => { document.getElementById('sp-unk-text').value = 'وليد الأحمد\n0944555666'; splitUnknown(); });
    await pg.evaluate(() => { document.querySelector('[data-unk="0"] [data-k="name"]').click(); document.querySelector('[data-unk="1"] [data-k="phone"]').click(); });
    await pg.waitForTimeout(200);
    const as = await pg.evaluate(() => [document.getElementById('in-name').value, document.getElementById('in-phone').value]);
    ok(as[0] === 'وليد الأحمد' && as[1] === '0944555666', 'تحديد المتروك: «👤 اسم» و«📞 رقم» يملآن الحقلين: ' + as.join(' | '));

    // مفتاح «تعرّف تلقائي على المنتجات»
    ok(await pg.evaluate(() => document.getElementById('sp-prod-on').checked), 'المفتاح ظاهر ومُفعَّل افتراضياً');
    await pg.click('#sp-prod-on');
    r = await fill(pg, 'رامي\n0933000114\nدمشق\nكاميرا تجربة 3');
    ok(r.itemsAll.every(v => !/كاميرا/.test(v)) && /كاميرا تجربة 3/.test(r.unk) && /مُطفأ/.test(r.rep), 'المفتاح مُطفأ ⇒ لا مطابقة، والنصّ لك: ' + JSON.stringify(r.unk));
    ok(await pg.evaluate(() => localStorage.getItem('gmt_sp_products')) === 'off', 'الاختيار محفوظ على الجهاز');
    await pg.click('#sp-prod-on');
    const fit = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(fit <= 1, 'لا طفح أفقي');
    const own = errs.filter(e => !/status of (400|503)/.test(e));
    ok(!own.length, 'لا أخطاء JS ' + own.join(' | '));
    await browser.close();
  }
  console.log(fails ? `FAIL=${fails}` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
