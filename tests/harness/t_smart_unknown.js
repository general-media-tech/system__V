// (25 ت1 · TASK-0182) المالك seq 110: «الأشياء اللي ما فهمها على أنّها ملاحظة أو سعر أو منتج يعطيني إيّاها في حقل لحاله في جدول لحاله وأنا بكتب
// له شو هي · ضعهم كل واحدة في سطر وبحدّد لك كل شيء شو هو · أو بنسخهم وبعبّيهم أنا · لا يعيش شيء ما يتعبّى: ملاحظة أو سعر أو وجهة…».
// ① الجدول يظهر مقسّماً سطراً سطراً فوراً · ② «💵 سعر» و«📍 عنوان/وجهة» و«📋 نسخ» لكل سطر · ③ لا قصّ صامت: سعرٌ ثانٍ · ما زاد عن ١٢ بنداً ·
// الحرف الواحد · وما بعد «العنوان:» ولم يدخل الحقل.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
async function fill(pg, msg) {
  return pg.evaluate(async (msg) => {
    try { openAddModal && openAddModal(); } catch (_) {}
    await new Promise(z => setTimeout(z, 400));
    ['in-name', 'in-phone', 'in-addr', 'in-notes', 'in-price'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    document.getElementById('sp-text').value = msg; await smartFillFromPaste(); await new Promise(z => setTimeout(z, 300));
    return { addr: document.getElementById('in-addr').value, price: document.getElementById('in-price').value, notes: document.getElementById('in-notes').value,
      items: [...document.querySelectorAll('#add-items-container [data-field="name"]')].map(i => i.value).filter(Boolean),
      rows: [...document.querySelectorAll('#sp-unk-rows [data-unk]')].map(c => ({ t: c.querySelector('div').innerText.trim(), b: [...c.querySelectorAll('button[data-k]')].map(b => b.getAttribute('data-k')) })) };
  }, msg);
}
const press = (pg, line, k) => pg.evaluate(([line, k]) => { const c = [...document.querySelectorAll('#sp-unk-rows [data-unk]')].find(c => c.querySelector('div').innerText.trim() === line);
  const b = c && c.querySelector('button[data-k="' + k + '"]'); if (b) b.click(); return !!b; }, [line, k]);
(async () => {
  for (const [w, h] of [[390, 844], [1366, 800]]) {
    await H.seed();
    await H.call('/rest/v1/products', [{ name: 'كاميرا كانون 2000D', barcode: 'C2000', price: 300, haleb: 2 }]);
    const { browser, pg, errs } = await H.open('orders.html', { w, h, mobile: w < 500, wait: 4500, init: H.ADMIN_INIT + ` try{localStorage.removeItem('gmt_orders_recog');localStorage.removeItem('gmt_sp_products');}catch(e){}` });

    // ١) رسالةٌ فيها سعران · عنوانٌ بتفصيلٍ زائد · منتجٌ معروف وآخر لا
    const r = await fill(pg, 'الاسم: محمد احمد\nالرقم: 0944123456\nالعنوان: حمص - كرم الشامي قرب الجامع الكبير\nالسعر 85$\nالتوصيل 2$\nكاميرا كانون 2000D\nشغلة غريبة زرقاء\nملاحظة: يتصل قبل');
    const T = r.rows.map(x => x.t);
    ok(r.rows.length > 0, w + ': جدول «ما تعرّفنا عليهم» يظهر مقسّماً سطراً سطراً بلا ضغطة: ' + T.join(' | '));
    ok(r.rows.every(x => ['prod', 'note', 'price', 'addr', 'name', 'phone', 'copy', 'skip'].every(k => x.b.includes(k))), w + ': لكل سطر: منتج · ملاحظة · 💵 سعر · 📍 عنوان/وجهة · اسم · رقم · 📋 نسخ · تجاهل');
    ok(Number(r.price) >= 85 && Number(r.price) < 90, w + ': السعر الأوّل في حقل السعر (والأجور المقترحة تُضاف كما كانت): ' + r.price);
    ok(T.some(t => /التوصيل/.test(t) && /2/.test(t)), w + ': السعر الثاني «التوصيل 2$» لا يُحذف بصمت ⇒ سطرٌ في الجدول');
    ok(/الجامع الكبير/.test(r.addr) || T.some(t => /الجامع الكبير/.test(t)), w + ': تفصيل العنوان «قرب الجامع الكبير» في حقل العنوان أو في الجدول (لا يضيع): ' + r.addr.slice(0, 50));
    ok(T.some(t => /شغلة غريبة زرقاء/.test(t)) && !r.items.some(x => /شغلة غريبة/.test(x)), w + ': ما لم يُفهم ⇒ الجدول لا المنتجات');
    ok(r.items.some(x => /2000D/.test(x)), w + ': المنتج المعروف عُبّئ: ' + r.items.join(','));
    ok(/يتصل قبل/.test(r.notes), w + ': الملاحظة المعلَّمة في الملاحظات');
    if (w === 390) await pg.screenshot({ path: '/tmp/gmt-out/smart_unknown_' + w + '.png', fullPage: false });

    // ٢) «💵 سعر» على سطر ⇒ حقل السعر · «📍 عنوان/وجهة» ⇒ العنوان · «📝 ملاحظة» ⇒ الملاحظات
    const delivLine = T.find(t => /التوصيل/.test(t));
    await press(pg, delivLine, 'price'); await pg.waitForTimeout(200);
    ok((await pg.evaluate(() => document.getElementById('in-price').value)) === '2', w + ': «💵 سعر» على «' + delivLine + '» ⇒ حقل السعر 2');
    await press(pg, 'شغلة غريبة زرقاء', 'note'); await pg.waitForTimeout(200);
    ok(/شغلة غريبة زرقاء/.test(await pg.evaluate(() => document.getElementById('in-notes').value)), w + ': «📝 ملاحظة» ⇒ في الملاحظات');

    // ٣) ١٤ سطراً + حرفٌ واحد ⇒ لا قصّ صامت
    const many = Array.from({ length: 14 }, (_, i) => 'غرض مجهول رقم ' + (i + 1)).join('\n') + '\nب';
    const r2 = await fill(pg, 'الاسم: سامر\nالرقم: 0944000111\n' + many);
    const T2 = r2.rows.map(x => x.t);
    ok(T2.some(t => /غرض مجهول رقم 14/.test(t)) && T2.some(t => /غرض مجهول رقم 13/.test(t)), w + ': ما بعد البند الثاني عشر لا يُقصّ ⇒ في الجدول (' + T2.length + ' سطراً)');
    ok(T2.includes('ب'), w + ': الحرف الواحد لا يُرمى ⇒ في الجدول');

    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, w + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
