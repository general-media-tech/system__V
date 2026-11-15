#!/usr/bin/env node
/* (TASK-A0509 · المالك seq 753–754 «ليش عم تطلع هيك اخطاء وما عم تكتشفها؟») فحص «كمّل طقمك» على **كلّ** منتجات المتجر الحيّ قبل أيّ نشر.
   الاستعمال: node tools/kit_audit.js [--dump out.json] [--show "جزء من اسم القسم"]
   يخرج بـ1 إن وُجدت مخالفة: مقترح نافد · ملحق درون لموديل آخر · ريموت/نظّارة لدرون · عدسة/كاميرا لغير كاميرا · MicroSD لكاميرا كانون ·
   تريغر/ديفيوزر يأخذ ستاند · مقترح مكرّر أو المنتج نفسه. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global; global.GMT_COMPAT_NOLOAD = true;
require(path.join(ROOT, 'gmt-compat-kb.js')); const Kit = require(path.join(ROOT, 'gmt-kit.js'));
const cfg = fs.readFileSync(path.join(ROOT, 'gmt-config.js'), 'utf8').match(/STORE:\s*\{[\s\S]*?url:\s*'([^']+)'[\s\S]*?key:\s*'([^']+)'/);
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ''; };
(async () => {
  const r = await fetch(cfg[1] + '/rest/v1/gmt_store?id=eq.1&select=products,categories', { headers: { apikey: cfg[2], Authorization: 'Bearer ' + cfg[2] } });
  const row = (await r.json())[0], products = row.products, C = row.categories;
  const catPath = id => { const c = C.find(x => String(x.id) === String(id)); if (!c) return ['', '']; const t = c.parent_id ? C.find(x => String(x.id) === String(c.parent_id)) : null; return t ? [t.name, c.name] : [c.name, '']; };
  const ctx = { products, catPath, KB: global.GMTCompatKB }, cp = p => catPath(p.category_id).filter(Boolean).join(' › ');
  const bad = [], rows = [];
  for (const p of products) {
    if (Array.isArray(p.package_items)) continue;
    let kit; try { kit = Kit.complements(p, ctx); } catch (e) { bad.push(['خطأ تنفيذ', p.name, e.message]); continue; }
    rows.push({ id: p.id, name: p.name, cat: cp(p), kit: kit.map(k => ({ id: k.id, name: k.name, cat: cp(k), price: k.price, stock: k.stock })) });
    const [top, sub] = catPath(p.category_id), isCam = /^كاميرات$/.test(sub) && /كانون|أوبن بوكس/.test(top), isLens = /العدسات/.test(top) || /^عدسات|سيغما/.test(sub);
    const ids = new Set();
    for (const k of kit) {
      const [kt, ks] = catPath(k.category_id), v = m => bad.push([m, p.name, k.name]);
      if (k.id === p.id || ids.has(k.id)) v('مكرّر أو المنتج نفسه'); ids.add(k.id);
      if (!(parseInt(k.stock, 10) > 0)) v('مقترح نافد');
      if (/الدرونات/.test(top) && sub === 'درونات') {
        if (Kit.DRONE_NO.test(k.name.toLowerCase())) v('ريموت/نظّارة لدرون');
        const dm = Kit.droneModels(p.name).first, a = Kit.droneModels(k.name);
        if (!/الدرونات/.test(kt)) v('مقترح للدرون من خارج قسم الدرونات');
        else if (!(a.models.includes(dm) || (/^mini|^mavicmini/.test(dm) && a.fams.includes('mini')))) v('ملحق درون لموديل آخر (' + dm + ' ≠ ' + (a.models.join('/') || 'بلا موديل') + ')');
      }
      if (!isCam && !isLens && (/^كاميرات$/.test(ks) || /^عدسات|سيغما/.test(ks) || /العدسات/.test(kt))) v('عدسة/كاميرا مقترحة لغير كاميرا');
      if (isCam && /micro/i.test(k.name)) v('MicroSD لكاميرا كانون');
      if (sub === 'فلاشات' && Kit.flashKind(p.name) !== 'studio' && /ستاندات/.test(ks)) v('ستاند لفلاش/تريغر/معدّل');
    }
  }
  const withKit = rows.filter(x => x.kit.length).length;
  console.log('المنتجات: ' + rows.length + ' · لها اقتراحات: ' + withKit + ' · المخالفات: ' + bad.length);
  bad.slice(0, 60).forEach(b => console.log('  ✘ ' + b[0] + ' | ' + String(b[1]).slice(0, 50) + ' ⇐ ' + String(b[2]).slice(0, 50)));
  const show = arg('--show');
  if (show) rows.filter(x => x.cat.includes(show)).forEach(x => { console.log('■ ' + x.name.slice(0, 62) + '  [' + x.cat + ']'); x.kit.forEach(k => console.log('     + ' + k.name.slice(0, 60) + ' | ' + k.cat.split(' › ').pop() + ' | $' + k.price)); });
  if (arg('--dump')) fs.writeFileSync(arg('--dump'), JSON.stringify(rows));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('خطأ:', e.message); process.exit(2); });
