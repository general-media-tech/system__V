// TASK-B0552 · المالك seq B1086 (صورة): «إضاءة حوالي 50 واط … أقلّ أو أكتر قليلاً … ميزانيتي أقلّ من 100 دولار» ⇒ كان: 100$ و110$ (تجاوز) ولا اعتبار للواط ·
// جواب جامد بلا خيارات · <br><span> ظاهر كنصّ. الآن: الميزانية سقف · الواط ±40% · «فهمت:» · بطاقات بسبب · أزرار شغل · العرض بتنسيقه
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  await H.call('/rest/v1/products', [
    { name: 'Godox SL60W', barcode: 'B1', price: 58, group_name: 'هيد لايت ورؤوس اضائة', haleb: 2 },
    { name: 'Panel P40', barcode: 'B2', price: 95, group_name: 'بانيل ليد', haleb: 1, specs: { __desc: 'لوح إضاءة بقوة 40 واط مع بطارية' } },
    { name: 'YM-S60 head', barcode: 'B3', price: 100, group_name: 'هيد لايت ورؤوس اضائة', haleb: 3 },
    { name: 'Big Light 200W', barcode: 'B4', price: 90, group_name: 'هيد لايت ورؤوس اضائة', haleb: 5 },
    { name: 'Ym 600ss 50W', barcode: 'B5', price: 110, group_name: 'هيد لايت ورؤوس اضائة', haleb: 9 },
    { name: 'Flash TT 50W', barcode: 'B6', price: 50, group_name: 'فلاشات', haleb: 9 }]);
  const Q = 'اضائة حوالي 50 واط. اقل او اكثر قليلا ميزانيتي اقل من 100 دولار';
  const { browser, pg, errs } = await H.open('orders.html', { init: H.ADMIN_INIT, w: 430, h: 900, wait: 5000 });
  const r = await pg.evaluate(async q => await GMTBrain._advise(q), Q);
  const names = r.rows.map(x => x.name);
  ok(r.need.budget.mode === 'max' && r.need.budget.max === 100 && r.need.watt.target === 50, 'فهم: الميزانية سقف ≤ 100 · الواط 50 (ورقم الواط ما اختلط بالسعر): ' + JSON.stringify(r.need));
  ok(!names.includes('Ym 600ss 50W'), 'ما بيقترح فوق الميزانية (110$)');
  ok(names.includes('YM-S60 head'), '100$ = ضمن «أقل من 100»؟ — حدّ الميزانية مسموح');
  ok(names[0] === 'Godox SL60W' && names[1] === 'Panel P40', 'الأقرب للواط أوّلاً (60W · 40 واط من الوصف): ' + names.join(' | '));
  ok(names.indexOf('Big Light 200W') === names.length - 1, 'الواط البعيد (200W) آخر شي');
  ok(!names.includes('Flash TT 50W'), 'فلاش مو «إضاءة» بهالسياق؟ — المجموعات: إضاءة بس');
  // اللوحة الحقيقية
  await pg.evaluate(() => GMTBrain.open()); await pg.waitForSelector('#gb-in', { timeout: 8000 });
  await pg.fill('#gb-in', Q); await pg.press('#gb-in', 'Enter');
  await pg.waitForSelector('[data-ga-adv]', { timeout: 15000 }).catch(() => {});
  const ui = await pg.evaluate(() => { const a = document.querySelector('[data-ga-adv]'); return a && { txt: a.innerText, btns: [...a.querySelectorAll('[data-ga-act]')].map(b => b.dataset.gaAct), raw: /&lt;|<br>|<span/.test(a.innerText) }; });
  ok(ui && /فهمت/.test(ui.txt) && /الميزانية ≤ 100\$/.test(ui.txt) && /~50 واط/.test(ui.txt), '«🧩 فهمت: …» ظاهر بأوّل الجواب: ' + (ui && ui.txt.split('\n')[0]));
  ok(ui && !ui.raw, 'الجواب معروض بتنسيقه — بلا <br><span> كنصّ');
  ok(ui && ['copy1', 'quote', 'open', 'copyAll', 'ask', 'llm'].every(x => ui.btns.includes(x)), 'أزرار شغل: 📋 للزبون · 🧾 عرض سعر · 🔎 فتح · 💬 رسالة بالخيارات · فلاتر · 🧠 بالتفصيل');
  ok(ui && /60 واط ✓/.test(ui.txt) && /القوّة مو مذكورة/.test(ui.txt), 'سبب الاختيار لكلّ منتج (60 واط ✓ · القوّة مو مذكورة)');
  await pg.evaluate(() => [...document.querySelectorAll('[data-ga-act="ask"]')].find(b => /أرخص/.test(b.textContent)).click());
  await pg.waitForFunction(() => document.querySelectorAll('[data-ga-adv]').length >= 2, null, { timeout: 15000 }).catch(() => {});
  ok(await pg.evaluate(() => document.querySelectorAll('[data-ga-adv]').length >= 2), '«⬇️ أرخص» بيعيد الترشيح فوراً');
  const nav = pg.waitForURL(/quote\.html\?add=/, { timeout: 8000 }).then(() => true).catch(() => false);
  await pg.evaluate(() => document.querySelector('[data-ga-adv] [data-ga-act="quote"]').click());
  ok(await nav, '🧾 عرض سعر ⇐ quote.html?add=…');
  await pg.waitForFunction(() => document.querySelectorAll('#q-items .it').length > 0, null, { timeout: 12000 }).catch(() => {});
  ok(await pg.evaluate(() => document.querySelectorAll('#q-items .it').length === 1 && /Godox SL60W/.test(document.querySelector('#q-items [data-f="name"]').value)), 'عرض السعر انفتح والمنتج فيه بسعره');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
