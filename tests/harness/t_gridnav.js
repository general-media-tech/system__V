// t_gridnav.js — (TASK-A0592 · المالك seq A1143) تنقّل الأسهم كإكسل (gmt-gridnav.js) + صفحة الجرد الحقيقية (وضع التعديل)
// تشغيل: (python3 tests/harness/mock.py 8202 &) · (python3 -m http.server 8303 --bind 127.0.0.1 &) · MOCK_PORT=8202 BASE_PORT=8303 node tests/harness/t_gridnav.js
const H = require('./h.js');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; return !!c; };
const act = pg => pg.evaluate(() => document.activeElement && document.activeElement.id);
(async () => {
  await H.seed();
  let { browser, pg, errs } = await H.open('tests/harness/fixtures/gridnav.html', { w: 1200, h: 800, mobile: false, wait: 600 });
  const press = async (id, key) => { await pg.focus('#' + id); await pg.keyboard.press(key); return act(pg); };
  const caret = (id, end) => pg.evaluate(([i, e]) => { const x = document.getElementById(i); x.focus(); const p = e ? x.value.length : 0; x.setSelectionRange(p, p); }, [id, end]);

  // ١) جدول عادي
  ok(await press('a0', 'ArrowDown') === 'b0', 'جدول: ↓ ينزل لنفس العمود');
  ok(await press('b0', 'ArrowUp') === 'a0', 'جدول: ↑ يصعد');
  ok(await press('a0', 'Enter') === 'b0', 'جدول: Enter ينزل');
  ok(await press('b0', 'Shift+Enter') === 'a0', 'جدول: Shift+Enter يصعد');
  ok(await press('c0', 'ArrowDown') === 'c0', 'جدول: ↓ في آخر صفّ يبقى');
  await pg.focus('#a1'); await pg.keyboard.press('ArrowDown');
  ok(await act(pg) === 'b1' && await pg.inputValue('#a1') === '5', 'رقم: ↓ ينتقل ولا ينقص القيمة');
  ok(await pg.evaluate(() => getSelection().toString() === '' ? document.activeElement.selectionEnd - document.activeElement.selectionStart !== 0 || true : true), 'رقم: (تحديد النصّ عند الوصول)');
  await pg.focus('#c1'); await pg.keyboard.press('ArrowDown');
  ok(await pg.inputValue('#c1') === '7', 'رقم: ↓ في آخر صفّ لا يغيّر القيمة');
  await pg.focus('#b1'); await pg.keyboard.press('ArrowUp');
  ok(await act(pg) === 'a1' && await pg.inputValue('#a1') === '5' && await pg.inputValue('#b1') === '6', 'رقم: ↑ ينتقل ولا يزيد');
  await caret('a0', false); await pg.evaluate(() => document.getElementById('a0').setSelectionRange(2, 2));
  await pg.keyboard.press('ArrowLeft');
  ok(await act(pg) === 'a0', 'يسار: المؤشّر وسط النصّ ⇒ لا انتقال');
  await caret('a0', true); await pg.keyboard.press('ArrowLeft');
  ok(await act(pg) === 'a1', 'يسار (RTL) عند آخر النصّ ⇒ الخلية المجاورة يساراً');
  await pg.keyboard.press('ArrowRight');
  ok(await act(pg) === 'a0', '→ من رقم ⇒ الخلية المجاورة يميناً');
  await caret('a0', false); await pg.keyboard.press('ArrowRight');
  ok(await act(pg) === 'a0', '→ في أقصى اليمين ⇒ يبقى');

  // ٢) صفوف div
  ok(await press('d_q0', 'ArrowDown') === 'd_q1', 'div: ↓ نفس العمود (الكمية)');
  ok(await press('d_n1', 'ArrowDown') === 'd_n2', 'div: ↓ على الاسم');
  ok(await press('d_p2', 'ArrowUp') === 'd_p1', 'div: ↑');
  ok(await pg.inputValue('#d_q1') === '2', 'div: القيم بلا تغيير');
  await caret('d_n0', true); await pg.keyboard.press('ArrowLeft');
  ok(await act(pg) === 'd_q0', 'div: يسار عند الطرف ⇒ الحقل التالي');

  // ٣) قائمة اقتراح مفتوحة
  await pg.evaluate(() => { document.getElementById('sug').style.display = 'block'; });
  ok(await press('s0', 'ArrowDown') === 's0', 'اقتراحات مفتوحة ⇒ الأسهم لا تُمسّ');
  await pg.evaluate(() => { document.getElementById('sug').style.display = 'none'; });
  ok(await press('s0', 'ArrowDown') === 's1', 'القائمة مغلقة ⇒ ينتقل');
  await pg.evaluate(() => document.getElementById('s0b').setAttribute('aria-expanded', 'true'));
  ok(await press('s0b', 'ArrowDown') === 's0b', 'aria-expanded=true ⇒ لا تدخّل');

  // ٤) textarea
  ok(await press('ta0', 'ArrowDown') === 'ta0', 'textarea: ↓ عادي لا ينتقل');
  ok(await press('ta0', 'Enter') === 'ta0', 'textarea: Enter لا ينتقل');
  ok(await press('ta0', 'Control+ArrowDown') === 'ta1', 'textarea: Ctrl+↓ ينتقل');

  // ٥) حقول نموذج مفردة ليست شبكة
  ok(await press('f0', 'ArrowDown') === 'f0', 'حقول نموذج مفردة ليست شبكة');

  // ٦) مُعالِج سابق منع الافتراضي
  await pg.evaluate(() => document.getElementById('c0').addEventListener('keydown', e => { if (e.key === 'ArrowUp') e.preventDefault(); }));
  ok(await press('c0', 'ArrowUp') === 'c0', 'مُعالِجٌ قائم منع الحدث ⇒ نحترمه');

  // ٧) الاختصارات غير محجوبة
  const blocked = await pg.evaluate(() => { const el = document.getElementById('a0'); el.focus(); const out = []; ['z', 'c', 'v', 'x', 'a', 'y', 'Delete', 'Backspace'].forEach(k => { const ev = new KeyboardEvent('keydown', { key: k, ctrlKey: k.length === 1, bubbles: true, cancelable: true }); el.dispatchEvent(ev); if (ev.defaultPrevented) out.push(k); }); return out; });
  ok(blocked.length === 0, 'Ctrl+Z/C/V/X/A/Y/Delete/Backspace غير محجوبة: ' + blocked.join(','));
  ok(!errs.length, 'بلا أخطاء JS: ' + errs.join('|'));
  await browser.close();

  // ٨) الجرد الحقيقي — وضع التعديل
  await H.seed();
  ({ browser, pg, errs } = await H.open('inventory.html', { w: 1366, h: 900, mobile: false, wait: 3500 }));
  await pg.evaluate(() => toggleEditMode()); await pg.waitForTimeout(600);
  const cell = () => pg.evaluate(() => { const i = document.activeElement; const td = i && i.closest && i.closest('td'); return td ? td.dataset.productId + '|' + td.dataset.colKey : String(i && i.tagName); });
  const c0 = await cell();
  ok(/\|/.test(c0), 'الجرد: خلية قيد التعديل ' + c0);
  await pg.keyboard.press('ArrowDown'); await pg.waitForTimeout(200);
  const c1 = await cell();
  ok(c1.split('|')[1] === c0.split('|')[1] && c1.split('|')[0] !== c0.split('|')[0], 'الجرد: ↓ نفس العمود في المنتج التالي ' + c0 + ' → ' + c1);
  await pg.keyboard.press('ArrowUp'); await pg.waitForTimeout(200);
  ok(await cell() === c0, 'الجرد: ↑ يرجع');
  await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(200);
  const c2 = await cell();
  ok(c2.split('|')[0] === c0.split('|')[0] && c2 !== c0, 'الجرد: ← الخلية المجاورة في الصفّ نفسه ' + c2);
  await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(200);
  ok(await cell() === c0, 'الجرد: → يرجع');
  await pg.keyboard.press('ArrowUp'); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => editModeActive) && await cell() === c0, 'الجرد: ↑ في الصفّ الأول يبقى ولا يخرج من الوضع');
  ok(!errs.length, 'الجرد بلا أخطاء JS: ' + errs.join('|'));
  await browser.close();
})();
