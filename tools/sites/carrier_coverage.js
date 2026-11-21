#!/usr/bin/env node
/* (المالك seq 888) «نعمل تحديث كلّ فترة لنشوف إذا نزّلوا أفرع وصول جديدة» — يقارن مكاتب شركات الشحن المنشورة في مواقعها
   بما في gmt-shipping-offices.js ويطبع: الجديد عندهم وليس عندنا · ما عندنا ولم يعد عندهم. قراءة فقط — لا يكتب شيئاً.
   المصادر (السجلّ: docs/مواقع_مرجعية.md):
     القدموس  https://www.alkadmous.com/branches_final.json  (اسم · مدينة · عنوان · هاتف)
     سات      https://www.sat-cargo.com/  (const DATA = [المحافظة ⇒ المناطق ⇒ المكتب])
   الاستعمال: node tools/sites/carrier_coverage.js            (الأسماء فقط)
             node tools/sites/carrier_coverage.js --full     (مع العناوين والهواتف الجديدة) */
const path = require('path'), { execFileSync } = require('child_process');
global.window = global;
require(path.join(__dirname, '..', '..', 'gmt-shipping-offices.js'));
const O = global.GMTOffices, full = process.argv.includes('--full');
/* curl عبر وكيل البيئة (fetch في node لا يستعمل الوكيل هنا) */
const get = u => execFileSync('curl', ['-sL', '-m', '40', u], { encoding: 'utf8', maxBuffer: 20e6 });
const n = (s, city) => { let t = String(s || '').replace(/\s*-\s*/g, ' ').trim();
  for (let k = 0; k < 3; k++) { const c = city && O.norm(city); if (c && O.norm(t).indexOf(c + ' ') === 0) t = t.slice(t.indexOf(' ') + 1).trim(); t = t.replace(/^(مكتب|فرع)\s+/, ''); }   /* «دمشق - دمشق - شارع بغداد» ⇒ «شارع بغداد» */
  return O.norm(t); };

function report(co, theirs) {
  const ours = O.all(co), ourNames = new Set(ours.map(o => n(o.name, o.city)));
  const fresh = theirs.filter(t => !ourNames.has(n(t.name, t.city)));
  const theirNames = new Set(theirs.map(t => n(t.name, t.city)));
  const gone = ours.filter(o => !theirNames.has(n(o.name, o.city)));
  console.log(`\n■ ${co}: عندهم ${theirs.length} · عندنا ${ours.length} · جديد عندهم ${fresh.length} · عندنا وليس عندهم ${gone.length}`);
  fresh.forEach(t => console.log('  + ' + t.city + ' — ' + t.name + (full && (t.addr || t.phone) ? '  [' + [t.addr, t.phone].filter(Boolean).join(' · ') + ']' : '')));
  gone.forEach(o => console.log('  − ' + o.city + ' — ' + o.name));
}

try {
  const kb = JSON.parse(get('https://www.alkadmous.com/branches_final.json'));
  report('القدموس', kb.map(b => ({ city: b.city, name: String(b.name || '').replace(/^.*?-\s*/, '').replace(/^(مكتب|فرع)\s+/, ''), addr: b.address, phone: b.phone })));
} catch (e) { console.log('القدموس: تعذّرت القراءة — ' + e.message.slice(0, 120)); }

try {
  const h = get('https://www.sat-cargo.com/'), i = h.indexOf('const DATA=');
  if (i < 0) throw new Error('شكل الصفحة تغيّر (لا DATA)');
  let depth = 0, j = i + 11, st = j;
  for (; j < h.length; j++) { const c = h[j]; if (c === '[' || c === '{') depth++; else if (c === ']' || c === '}') { depth--; if (!depth) { j++; break; } } }
  const data = JSON.parse(h.slice(st, j)), list = [];
  data.forEach(g => (g.offices || []).forEach(o => list.push({ city: g.name, name: String(o).replace('مستودع - ', 'مستودع ').replace(/^مكتب\s+/, '') })));
  report('سات', list);
} catch (e) { console.log('سات: تعذّرت القراءة — ' + e.message.slice(0, 120)); }
