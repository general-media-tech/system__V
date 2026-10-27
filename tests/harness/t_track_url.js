// (TASK-0227 · المالك seq 155–156) «شاحن الصندوق ظهرت في الرابط والشاحن الجديده لفان ظهرت في التطبيق»:
// رابط التتبّع في رسائل الزبائن لا يبقى على نشرٍ قديم محفوظ — يتبع النشر الحيّ الذي يعمل منه النظام
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, wait: 4000 });
  const LIVE = 'https://general-media-tech.github.io/system__V/track_order.html';
  const r = await pg.evaluate(L => [
    pickTrackUrl('https://general-media-tech.github.io/rebrand_system_v/track_order.html', L),
    pickTrackUrl('https://general-media-tech.github.io/system_17/track_order.html', L),
    pickTrackUrl('', L),
    pickTrackUrl(L, L),
    pickTrackUrl('https://track.gmt-sy.com/', L),
    pickTrackUrl('https://general-media-tech.github.io/rebrand_system_v/track_order.html', 'http://127.0.0.1:8765/track_order.html'),
  ], LIVE);
  ok(r[0] === LIVE && r[1] === LIVE, 'رابطٌ محفوظ على نشرٍ قديم (rebrand_system_v · system_17) ⇒ يُستبدَل برابط النشر الحيّ');
  ok(r[2] === LIVE && r[3] === LIVE, 'بلا محفوظ ⇒ النشر الحيّ · المحفوظ الصحيح يبقى');
  ok(r[4] === 'https://track.gmt-sy.com/', 'نطاقٌ خاصّ اختاره المالك ⇒ يبقى كما هو');
  ok(r[5] === 'https://general-media-tech.github.io/rebrand_system_v/track_order.html', 'نسخةٌ محلّية (ليست نشراً حيّاً) ⇒ لا تُغيِّر المحفوظ');
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
