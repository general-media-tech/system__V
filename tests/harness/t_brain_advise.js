// TASK-B0546 · المالك seq B1077 (صورة): «زبون بدو إضاءة مستمرة بسعر 50 دولار وما حولها بيهمه بطارية» ⇒ «ما عندنا مطابق» · «وين بحس بعمل عرض سعر» ⇒ «ما لقيت»
// ① الترشيح بالنوع (مجموعات الجرد العربية) + مجال السعر حول الرقم · المستمرّة بلا فلاشات · البطارية ميزة ترفع · المتوفّر أوّلاً
// ② «وين/كيف أعمل…» ⇒ أداة النظام فوراً · ③ زرّ 🔎 بحث الأدوات لحاله جنب 🧠
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  await H.call('/rest/v1/products', [
    { name: 'YN LED Panel 300 NP-F battery', barcode: 'AD1', price: 48, group_name: 'بانيل ليد', haleb: 2 },
    { name: 'Godox SL60W', barcode: 'AD2', price: 58, group_name: 'هيد لايت ورؤوس اضائة', haleb: 1 },
    { name: 'Tube Light T1', barcode: 'AD3', price: 52, group_name: 'تيوب لايت', haleb: 0 },
    { name: 'Godox TT600 Flash', barcode: 'AD4', price: 50, group_name: 'فلاشات', haleb: 3 },
    { name: 'Boya Mic M1', barcode: 'AD5', price: 50, group_name: 'مايك وتوابعه', haleb: 3 },
    { name: 'Big LED Panel 1000', barcode: 'AD6', price: 200, group_name: 'بانيل ليد', haleb: 4 }]);
  const { browser, pg, errs } = await H.open('orders.html', { init: H.ADMIN_INIT, w: 430, h: 900, wait: 5000 });
  const r = await pg.evaluate(async () => await GMTBrain._advise('زبون بدو اضاءة مستمرة بسعر 50 دولار. وماحولها بيهمه بطارية'));
  const names = (r && r.rows || []).map(x => x.name);
  ok(r && r.price && r.price.target === 50 && r.price.from <= 40 && r.price.to >= 60, 'فهم السعر «50 دولار» ومجال حوله: ' + JSON.stringify(r && r.price));
  ok(names.includes('YN LED Panel 300 NP-F battery') && names.includes('Godox SL60W') && names.includes('Tube Light T1'), 'لقى الإضاءات بمجموعاتها العربية (بانيل ليد · هيد لايت · تيوب لايت): ' + names.join(' | '));
  ok(!names.includes('Godox TT600 Flash') && !names.includes('Boya Mic M1'), 'المستمرّة بلا فلاشات — والمايك مو إضاءة');
  ok(!names.includes('Big LED Panel 1000'), 'خارج مجال السعر (200$) ما بينعرض');
  ok(names[0] === 'YN LED Panel 300 NP-F battery' && (r.rows[0].features || []).includes('بطارية/شحن'), 'يلي فيه بطارية + متوفّر أوّلاً: ' + names[0]);
  ok(names.indexOf('Tube Light T1') === names.length - 1, 'غير المتوفّر آخر شي');
  const live = await pg.evaluate(async () => await GMTBrain._live('زبون بدو اضاءة مستمرة بسعر 50 دولار وماحولها بيهمه بطارية'));
  ok(live.adviseMode && live.catalogMatches.length === 3 && /لا تقل «ما عندنا شي مطابق»/.test(live.adviseNote || ''), 'البيانات يلي بتروح للعقل فيها الترشيحات + تعليمة «الأقرب لطلبك»');
  const a = await pg.evaluate(async () => await GMTBrain._localAnswer('وين بحس بعمل عرض سعر'));
  ok(a && /quote\.html/.test(a) && /عرض سعر/.test(a), '«وين بحس بعمل عرض سعر» ⇒ رابط «عرض سعر» فوراً');
  const a2 = await pg.evaluate(async () => await GMTBrain._localAnswer('كيف بسجّل مصروف'));
  ok(a2 && /مصروف/.test(a2), '«كيف بسجّل مصروف» ⇒ جواب فوري (من دليل النظام أو أدواته): ' + String(a2 || '').replace(/<[^>]+>/g, ' ').slice(0, 80));
  await pg.waitForSelector('#gmt-tsearch-btn', { timeout: 8000 }).catch(() => {});
  const btns = await pg.evaluate(() => ({ s: !!document.getElementById('gmt-tsearch-btn'), b: !!document.getElementById('gmt-brain-btn') }));
  ok(btns.s && btns.b, 'زرّ 🔎 بحث الأدوات لحاله + زرّ 🧠 العقل لحاله بالشريط العلوي');
  await pg.click('#gmt-tsearch-btn'); await pg.fill('#gmt-tsearch [data-ts-q]', 'كلمات السر');
  const hits = await pg.evaluate(() => [...document.querySelectorAll('#gmt-tsearch [data-ts-i] b')].map(x => x.textContent));
  ok(hits.length > 0, '🔎 «كلمات السر» ⇒ ' + hits.slice(0, 3).join(' · '));
  await pg.fill('#gmt-tsearch [data-ts-q]', 'وين بعمل عرض سعر');
  const hits2 = await pg.evaluate(() => [...document.querySelectorAll('#gmt-tsearch [data-ts-i] b')].map(x => x.textContent));
  ok(hits2[0] === 'عرض سعر', '🔎 بجملة عادية «وين بعمل عرض سعر» ⇒ ' + hits2[0]);
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
