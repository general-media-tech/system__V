const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
(async () => {
  await H.seed();
  const s = await H.open('store.html', { w: 390, h: 900, wait: 4000, init: H.ADMIN_INIT });
  const r = await s.pg.evaluate(async () => {
    // جدولٌ وهميّ أعمدته: id,name,comment,created_at (لا text ولا rating)
    const COLS = ['id', 'name', 'comment', 'created_at']; const rows = [{ id: 1, name: 'سارة', comment: 'ممتاز', created_at: '2026-10-01' }]; const calls = [];
    const miss = (c) => ({ code: '42703', message: 'column gmt_comments.' + c + ' does not exist' });
    _sb.from = () => ({
      select(sel) { calls.push('select ' + sel); const bad = sel.split(',').find(c => !COLS.includes(c)); return { order: async () => bad ? { data: null, error: miss(bad) } : { data: rows.map(r => Object.fromEntries(sel.split(',').map(c => [c, r[c]]))), error: null } }; },
      async insert(arr) { const bad = Object.keys(arr[0]).find(c => !COLS.includes(c)); calls.push('insert ' + Object.keys(arr[0]).join(',')); if (bad) return { error: { code: 'PGRST204', message: "Could not find the '" + bad + "' column of 'gmt_comments' in the schema cache" } }; rows.push(Object.assign({ id: rows.length + 1, created_at: 'x' }, arr[0])); return { error: null }; }
    });
    try { localStorage.removeItem('gmt_cmt_txtcol'); } catch (_) {} _cache.del('comments');
    const got = await fetchComments();
    const okIns = await insertComment({ name: 'خالد', text: 'تقييم جديد' });
    const saved = localStorage.getItem('gmt_cmt_txtcol');
    return { got, okIns, saved, rowsAfter: rows.length, last: rows[rows.length - 1], calls };
  });
  console.log('   calls:', r.calls.length, r.calls.slice(0, 4).join(' | '));
  ok(r.got.length === 1 && r.got[0].text === 'ممتاز', 'القراءة تتكيّف مع عمود «comment» وتوحّد النتيجة في text');
  ok(r.saved === 'comment', 'يتذكّر اسم العمود: ' + r.saved);
  ok(r.okIns && r.last && r.last.comment === 'تقييم جديد' && !('text' in r.last), 'الكتابة تُحوَّل إلى العمود الصحيح');
  // بعد التذكّر: أوّل محاولة بالعمود الصحيح (بلا طلبات فاشلة)
  const r2 = await s.pg.evaluate(async () => { const calls = []; const orig = _sb.from; _sb.from = (t) => { const o = orig(t); return { select(sel) { calls.push(sel); return o.select(sel); } }; }; _cache.del && _cache.del('comments'); await fetchComments(); return calls; });
  ok(r2.length >= 1 && /comment/.test(r2[0]), 'الطلب التالي يبدأ بالعمود المحفوظ: ' + r2[0]);
  console.log('errs:', s.errs.filter(e => !/400|404|Failed|أصول/.test(e)).slice(0, 3));
  await s.browser.close(); console.log(fails ? 'FAILS=' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
