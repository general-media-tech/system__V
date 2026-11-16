#!/usr/bin/env node
/* (TASK-A0513 · المالك seq 762 «الكمية زامنها») مزامنة كمية المتجر من الجرد — نفس قاعدة الجسر (bridge.html invTotal):
   مجموع أعمدة الفروع (inv_columns: is_branch · include_in_total · عدا ألمانيا/الصين) لمنتج الجرد المربوط (inv_id) — للقوائم البسيطة فقط
   (القائمة بخيارات كمّيتها من خياراتها ولا تُمسّ). يكتب بشرط التزامن (updated_at) ويحفظ نسخة سابقة لكلّ ما تغيّر.
   الاستعمال: K=<مفتاح القاعدة الرئيسية> node tools/store_stock_sync.js [--apply] [--fix <fix.json>]
   fix.json اختياري: [{"store_id":"…","set":{"price":24,"images":[…],"alt_names":"…"}}] — تعديلات محدّدة في نفس الكتابة. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const cfg = fs.readFileSync(path.join(ROOT, 'gmt-config.js'), 'utf8').match(/STORE:\s*\{[\s\S]*?url:\s*'([^']+)'[\s\S]*?key:\s*'([^']+)'/);
const SU = cfg[1], SH = { apikey: cfg[2], Authorization: 'Bearer ' + cfg[2] };
const MU = 'https://ysawzwtmodkqqbqoiojj.supabase.co', MK = process.env.K; if (!MK) { console.error('ينقص K'); process.exit(2); }
const MH = { apikey: MK, Authorization: 'Bearer ' + MK };
const APPLY = process.argv.includes('--apply'), fi = process.argv.indexOf('--fix'), FIX = fi > 0 ? JSON.parse(fs.readFileSync(process.argv[fi + 1], 'utf8')) : [];
(async () => {
  let keys = ['homs', 'daraa', 'haleb', 'kurani', 'sarmada', 'fakhouri'];
  try { const r = await (await fetch(MU + '/rest/v1/inv_columns?is_branch=eq.true&include_in_total=eq.true&select=key_name&order=sort_order.asc', { headers: MH })).json();
    const ks = (r || []).map(x => String(x.key_name || '')).filter(k => /^[a-z][a-z0-9_]*$/.test(k) && k !== 'germany' && k !== 'china'); if (ks.length) keys = ks; } catch (_) {}
  const inv = await (await fetch(MU + '/rest/v1/products?select=id,' + keys.join(',') + '&limit=10000', { headers: MH })).json();
  const I = {}; inv.forEach(p => I[p.id] = keys.reduce((s, k) => s + (Number(p[k]) || 0), 0));
  console.log('أعمدة الفروع: ' + keys.join(' · ') + ' · منتجات الجرد ' + inv.length);
  for (let attempt = 0; attempt < 3; attempt++) {
    const rec = (await (await fetch(SU + '/rest/v1/gmt_store?id=eq.1&select=id,updated_at,products', { headers: SH })).json())[0];
    const prods = rec.products, n0 = prods.length, before = []; let chg = 0, up = 0, down = 0;
    prods.forEach(p => {
      if (!p.inv_id || !(p.inv_id in I) || (Array.isArray(p.options) && p.options.length)) return;
      const q = I[p.inv_id], s = parseInt(p.stock, 10) || 0; if (q === s) return;
      before.push({ id: p.id, stock: p.stock }); if (q > s) up++; else down++; p.stock = q; chg++;
    });
    FIX.forEach(f => { const p = prods.find(x => String(x.id) === String(f.store_id)); if (!p) { console.log('✘ غير موجود: ' + f.store_id); return; }
      const old = {}; Object.keys(f.set).forEach(k => { old[k] = p[k]; p[k] = f.set[k]; }); before.push({ id: p.id, fix: old }); console.log('• تعديل ' + p.name.slice(0, 50) + ': ' + Object.keys(f.set).join(' · ')); });
    console.log('الكمّيات المختلفة: ' + chg + ' (زادت ' + up + ' · نقصت ' + down + ')');
    if (!APPLY) { console.log('فحص فقط — أضِف --apply'); return; }
    if (!before.length) { console.log('لا شيء يُكتب'); return; }
    const bk = path.join(process.env.BACKUP_DIR || '.', 'store_sync_before_' + Date.now() + '.json');
    fs.writeFileSync(bk, JSON.stringify({ store_updated_at: rec.updated_at, before }));
    const w = await fetch(SU + '/rest/v1/gmt_store?id=eq.1&select=id&updated_at=eq.' + encodeURIComponent(rec.updated_at), { method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=representation' }, SH), body: JSON.stringify({ products: prods, updated_at: new Date().toISOString() }) });
    if (!w.ok) throw new Error('HTTP ' + w.status);
    const rows = await w.json(); if (rows.length) { console.log('✔ كُتب · المنتجات ' + n0 + ' كما هي · النسخة السابقة: ' + bk); return; }
    console.log('المتجر تغيّر — إعادة…');
  }
  throw new Error('المتجر يتغيّر باستمرار');
})().catch(e => { console.error('خطأ:', e.message); process.exit(1); });
