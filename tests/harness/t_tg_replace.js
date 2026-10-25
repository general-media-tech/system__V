// (25 ت1 · TASK-0171) المالك seq 85: «عم يتعذّر الحذف للتعديل» (لقطة: «✏️ تعديل طلب — تعذّر حذف الرسالة السابقة، اعتمد هذه») + seq 86
// «أعِد الحذف بأمان». الحذف المباشر أُلغي 17 ت1 (اختراق البوت) — الآن «الاستبدال» في الوسيط: كل رسالة أوردر تحمل معرّفه (gmt_order)،
// والتعديل يُرسل المعدَّلة عبر replacePhoto مع رقم القديمة (replace_id) فيحذفها الوسيط إن سجّلها هو لهذا الأوردر وكانت حديثة.
// الوسيط هنا بديلٌ يسجّل ما يصله (اختبار الوسيط نفسه — السجلّ · الأوردر نفسه · ٤٧ ساعة · لا حذف مباشر — في نصّه منفصلاً).
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const get = async id => (await H.call('/rest/v1/gmt_orders?id=eq.' + id, undefined, 'GET'))[0];
(async () => {
  for (const W of [390, 1366]) {
    await H.seed();
    const [o1] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون التعديل ' + W, phone: '0933000801', product: 'كاميرا', qty: 1, price: 50, status: 'pending', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي', tg_msg_id: '500' }]);
    const { browser, ctx, pg, errs } = await H.open('orders.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 4500 });
    const seen = []; let mode = { replaced: true };
    await ctx.route('**/functions/v1/gmt-tg/**', async r => {
      const q = r.request(), route = q.url().split('/gmt-tg/')[1], body = q.postData() || '';
      const f = k => { const m = new RegExp('name="' + k + '"\\r\\n\\r\\n([^\\r]*)').exec(body); return m ? m[1] : null; };
      let jb = null; try { jb = JSON.parse(body); } catch (_) {}
      seen.push({ route, gmt_order: f('gmt_order') || (jb && jb.gmt_order) || null, replace_id: f('replace_id'), caption: (f('caption') || (jb && jb.text) || '').slice(0, 80) });
      const id = 600 + seen.length;
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Object.assign({ ok: true, result: { message_id: id } }, route === 'replacePhoto' ? mode : {})) });
    });
    const direct = []; await ctx.route('https://api.telegram.org/bot*/deleteMessage', r => { direct.push(r.request().url()); r.fulfill({ status: 200, body: '{"ok":true}' }); });

    // ١) التعديل ⇒ replacePhoto بمعرّف الأوردر ورقم الرسالة القديمة — لا حذف مباشر · والجملة «تعذّر حذف…» لا تُكتب
    await pg.evaluate(async id => { await loadOrders(); await openEditModal(id); document.getElementById('edit-name').value = 'زبون معدَّل'; document.getElementById('saveEditBtn').click(); }, o1.id);
    for (let i = 0; i < 40 && !seen.some(s => s.route === 'replacePhoto'); i++) await pg.waitForTimeout(250);
    const rp = seen.find(s => s.route === 'replacePhoto');
    ok(rp && rp.gmt_order === String(o1.id) && rp.replace_id === '500', W + ': التعديل ⇒ استبدالٌ بمعرّف الأوردر ورقم القديمة: ' + JSON.stringify(rp));
    ok(rp && !/تعذّر حذف/.test(rp.caption) && /تعديل طلب/.test(rp.caption), W + ': نصّ الرسالة بلا «تعذّر حذف الرسالة السابقة»: ' + (rp && rp.caption));
    ok(!direct.length, W + ': لا حذف مباشر من الصفحة');
    await pg.waitForTimeout(800);
    ok(String((await get(o1.id)).tg_msg_id) === String(600 + seen.indexOf(rp) + 1), W + ': رقم الرسالة الجديدة حُفظ على الأوردر (تُستبدل هي في التعديل التالي)');
    const t1 = await pg.evaluate(() => document.getElementById('toast-wrap').innerText);
    ok(!/فبقيت القديمة/.test(t1), W + ': استبدالٌ ناجح ⇒ لا تنبيه');

    // ٢) الوسيط لم يحذف (أقدم من ٤٨ ساعة) ⇒ يُقال السبب بوضوح
    mode = { replaced: false, why: 'too-old' }; seen.length = 0;
    await pg.evaluate(async id => { closeModal('editModal'); await openEditModal(id); document.getElementById('edit-name').value = 'زبون معدَّل ٢'; document.getElementById('saveEditBtn').click(); }, o1.id);
    for (let i = 0; i < 40 && !seen.some(s => s.route === 'replacePhoto'); i++) await pg.waitForTimeout(250);
    await pg.waitForTimeout(400);
    const t2 = await pg.evaluate(() => document.getElementById('toast-wrap').innerText);
    ok(/أقدم من 48 ساعة/.test(t2) && /فبقيت القديمة/.test(t2), W + ': تعذّر الحذف ⇒ السبب ظاهر: ' + t2.replace(/\s+/g, ' ').slice(0, 120));

    // ٣) أوردرٌ جديد ⇒ رسالته تحمل معرّفه (فيُسجّلها الوسيط)
    seen.length = 0;
    const o2 = (await H.call('/rest/v1/gmt_orders', [{ name: 'جديد ' + W, phone: '0933000802', product: 'عدسة', qty: 1, price: 30, status: 'pending', branch: 'حلب', address: 'حمص' }]))[0];
    await pg.evaluate(async id => { await loadOrders(); const o = orders.find(x => x.id == id); await sendFullOrderNotification(o, 'اختبار', true); }, o2.id);
    const np = seen.find(s => s.route === 'sendPhoto');
    ok(np && np.gmt_order === String(o2.id) && !np.replace_id, W + ': صورة الأوردر تحمل معرّفه بلا استبدال: ' + JSON.stringify(np));
    // نصٌّ (تم التحصيل) يحمل معرّفه أيضاً
    await pg.evaluate(async id => { const o = orders.find(x => x.id == id); await sendFullOrderNotification(o, '💰 تم تحصيل المبلغ', false); }, o2.id);
    const nm = seen.find(s => s.route === 'sendMessage');
    ok(nm && nm.gmt_order === String(o2.id), W + ': رسالة النصّ تحمل معرّف الأوردر');

    const real = errs.filter(e => !/status of (400|401|404|406|503)/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
