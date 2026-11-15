// (TASK-A0505 · VER-5#REQ-0508) التعديل السريع في جدول الجرد (دبل كليك) يمرّ بصلاحية الأدمن:
// السعر لا يغيّره موظّف عادي · فكّ قفل الكميات لا يبقى مفتوحاً بعد جلسته · وتعديل السعر يُسجَّل.
const H = require('./h.js');
let pass = 0, fails = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
const dbRow = async (id) => (await H.call('/rest/v1/products?id=eq.' + id + '&select=price,haleb', undefined, 'GET'))[0];
const inline = (pg, id, col, val) => pg.evaluate(async ({ id, col, val }) => {
  const asked = [];
  if (window.GMTAuth) { GMTAuth.admin = GMTAuth.admin || {}; GMTAuth.admin.login = async (w) => { asked.push(w); return null; }; GMTAuth.ask = async (k, w) => { asked.push(w); return false; }; }
  const p = allProducts.find(x => String(x.id) === String(id));
  const el = document.createElement('span'); document.body.appendChild(el);
  await startInlineEdit(el, id, col, Number(p[col]) || 0);
  const inp = document.querySelector('input.inline-edit-input');
  if (inp) { inp.value = String(val); inp.blur(); }
  await new Promise(r => setTimeout(r, 900));
  return { asked, opened: !!inp, isAdmin: !!(window.GMTRole && GMTRole.isAdmin()) };
}, { id, col, val });
(async () => {
  const { prods } = await H.seed();
  const P = prods[0];
  const before = await dbRow(P.id);

  /* ── موظّف عادي ── */
  let { browser, pg, errs } = await H.open('inventory.html', { init: H.STAFF_INIT, w: 1366, h: 900, wait: 5000, mobile: false });
  let r = await inline(pg, P.id, 'price', 999);
  let row = await dbRow(P.id);
  ok(!r.isAdmin, 'الجلسة موظّف عادي');
  ok(row.price === before.price, '① موظّف: دبل كليك على السعر لا يغيّره في القاعدة (' + before.price + ' ⇐ ' + row.price + ')');
  ok(!r.opened && r.asked.length === 1 && /السعر/.test(r.asked[0] || ''), '① ويُطلب حساب الأدمن «تعديل السعر»: ' + JSON.stringify(r.asked));
  /* قفلٌ فُكّ في جلسة سابقة على الجهاز نفسه (العلامة باقية في localStorage) */
  await pg.evaluate(() => { localStorage.setItem('gmt_qty_unlock', '1'); localStorage.setItem('gmt_qty_unlock_reason', 'قديم'); localStorage.setItem('gmt_qty_unlock_at', new Date(Date.now() - 3 * 864e5).toISOString()); });
  r = await inline(pg, P.id, 'haleb', 77);
  row = await dbRow(P.id);
  ok(row.haleb === before.haleb && !r.opened, '② موظّف + فكّ قفل قديم باقٍ على الجهاز: الكمية لا تتغيّر (' + before.haleb + ' ⇐ ' + row.haleb + ')');
  const jsErr = errs.filter(e => !/vibrate|favicon|net::ERR|Failed to load resource/i.test(e));
  ok(jsErr.length === 0, 'بلا أخطاء JS (موظّف)' + (jsErr.length ? ': ' + jsErr.slice(0, 2).join(' | ') : ''));
  await browser.close();

  /* ── أدمن ── */
  ({ browser, pg, errs } = await H.open('inventory.html', { w: 1366, h: 900, wait: 5000, mobile: false }));
  r = await inline(pg, P.id, 'price', 123);
  row = await dbRow(P.id);
  ok(r.isAdmin && r.opened && row.price === 123 && r.asked.length === 0, '③ أدمن: السعر يتعدّل بلا سؤال (' + row.price + ')');
  const aud = await H.call('/rest/v1/gmt_audit?select=action,entity_id,field,old_value,new_value', undefined, 'GET').catch(() => []);
  ok((aud || []).some(a => a.action === 'price_set' && String(a.entity_id) === String(P.id)), '③ وتعديل السعر مسجَّل في سجلّ التدقيق (price_set)');
  /* علامة قديمة بلا فكّ في هذه الجلسة ⇒ الكمية مقفلة حتى للأدمن (يفكّها بسبب جديد) */
  await pg.evaluate(() => { localStorage.setItem('gmt_qty_unlock', '1'); localStorage.setItem('gmt_qty_unlock_at', new Date(Date.now() - 3 * 864e5).toISOString()); sessionStorage.removeItem('gmt_qty_unlock_s'); });
  r = await inline(pg, P.id, 'haleb', 55);
  row = await dbRow(P.id);
  ok(row.haleb === before.haleb, '④ أدمن + علامة قديمة من جلسة سابقة: الكمية مقفلة (يلزم فكّ جديد بسبب)');
  /* فكّ في هذه الجلسة ⇒ يعمل */
  await pg.evaluate(() => invQtyUnlockSet('جرد يدوي — اختبار'));
  r = await inline(pg, P.id, 'haleb', 55);
  row = await dbRow(P.id);
  ok(row.haleb === 55, '⑤ أدمن + فكّ القفل في هذه الجلسة: الكمية تتعدّل (' + row.haleb + ')');
  const jsErr2 = errs.filter(e => !/vibrate|favicon|net::ERR|Failed to load resource/i.test(e));
  ok(jsErr2.length === 0, 'بلا أخطاء JS (أدمن)' + (jsErr2.length ? ': ' + jsErr2.slice(0, 2).join(' | ') : ''));
  await browser.close();
  console.log('\nRESULT ' + (fails ? 'FAIL' : 'ALL PASS') + ' (' + pass + ' ✔ · ' + fails + ' ✘)');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
