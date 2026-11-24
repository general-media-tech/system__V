// (المالك seq B1045 «وزرّ جرّبها فعلاً ياخدنا للتجربة · وبتدرّب البوتات تجرّبها أو على الأقلّ تكشف إذا صار فيها غلط»)
// لكلّ بندٍ حديث في «شو الجديد» له «جرّبها»: يفتح الصفحة بـ ?wn=N كما يفعل الزرّ ⇒ الصفحة تُحمَّل بلا أخطاء JS ·
// شريط الإرشاد يظهر · وإن كان للبند هدفٌ (sel) فهو موجود ومؤطَّر. FROM = أوّل رقم يُفحص (افتراضياً آخر ٢٠ بنداً).
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const probe = await H.open('home.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 3000 });
  const items = await probe.pg.evaluate(() => ((window.GMTWhatsNew && GMTWhatsNew.news) || []).map(n => ({ v: n.v, t: n.t, go: (n.go || []).map(g => ({ p: g.p, sel: g.sel || '' })) })));
  await probe.browser.close();
  const FROM = Number(process.env.FROM) || (Math.max(...items.map(x => x.v)) - 19);
  const list = items.filter(n => n.v >= FROM && n.go.length);
  console.log('بنود تُجرَّب:', list.map(n => n.v).join(' · '));
  for (const n of list) {
    const g = n.go[0];
    const o = await H.open(g.p + (g.p.includes('?') ? '&' : '?') + 'wn=' + n.v, { init: H.ADMIN_INIT + ";try{localStorage.setItem('gmt_whatsnew_seen','0')}catch(e){}", w: 1366, h: 900, mobile: false, wait: 7000 });
    const r = await o.pg.evaluate(sel => ({ coach: !!document.getElementById('gwn-coach'), tgt: sel ? !!document.querySelector('.gwn-target') : true }), g.sel);
    const real = o.errs.filter(e => !/status of (4\d\d|503)|Failed to load resource|favicon|ERR_/.test(e));
    ok(r.coach && r.tgt && !real.length, n.v + ' «' + n.t.slice(0, 50) + '» ⇒ ' + g.p + (r.coach ? '' : ' · ✘ لا شريط إرشاد') + (r.tgt ? '' : ' · ✘ الهدف ' + g.sel + ' غير موجود') + (real.length ? ' · ✘ ' + real.slice(0, 2).join(' / ') : ''));
    await o.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
