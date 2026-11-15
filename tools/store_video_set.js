#!/usr/bin/env node
/* (TASK-A0507 · المالك seq 746/748) وضع فيديو يوتيوب رسمي على منتجات المتجر — تضمين لا استضافة (img/v كبُر والموقع حدّه 1 غيغا).
   الاستعمال:  node tools/store_video_set.js <list.json> [--apply]
   list.json:  [{"store_id":"p_…","video_url":"https://www.youtube.com/watch?v=…"}, …]
   بلا --apply = فحص فقط (لا كتابة). القواعد:
     • كلّ رابط يُفحص عبر YouTube oEmbed (200 = موجود ويقبل التضمين) ويُطبع اسم القناة والعنوان للمراجعة بالعين.
     • لا يُكتب فوق فيديو موجود أبداً · منتج غير موجود = يُتخطّى ويُذكر.
     • الكتابة بشرط التزامن (updated_at) كما في gmt-store-sync.js — إن تغيّر المتجر من جهة أخرى تُعاد المحاولة (٣ مرّات).
     • القيم القديمة تُحفظ في ملفّ <list>.before.json قبل الكتابة.
   مفتاح المتجر العامّ يُقرأ من gmt-config.js (لا يُكتب هنا). */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const cfg = fs.readFileSync(path.join(ROOT, 'gmt-config.js'), 'utf8').match(/STORE:\s*\{[\s\S]*?url:\s*'([^']+)'[\s\S]*?key:\s*'([^']+)'/);
if (!cfg) { console.error('لم أجد إعدادات المتجر في gmt-config.js'); process.exit(2); }
const U = cfg[1], H = { apikey: cfg[2], Authorization: 'Bearer ' + cfg[2] };
const file = process.argv[2], APPLY = process.argv.includes('--apply');
if (!file) { console.error('الاستعمال: node tools/store_video_set.js <list.json> [--apply]'); process.exit(2); }
const ytId = u => (String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{6,})/i) || [])[1] || '';

(async () => {
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  const okRows = [];
  for (const it of list) {
    const id = ytId(it.video_url);
    if (!id) { console.log('✘ ليس رابط يوتيوب:', it.store_id, it.video_url); continue; }
    const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
    if (!r.ok) { console.log('✘ الفيديو غير موجود أو لا يقبل التضمين (HTTP ' + r.status + '):', it.store_id, it.video_url); continue; }
    const j = await r.json();
    okRows.push({ store_id: String(it.store_id), video_url: 'https://www.youtube.com/watch?v=' + id, channel: j.author_name, title: j.title });
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const g = await fetch(U + '/rest/v1/gmt_store?id=eq.1&select=id,updated_at,products', { headers: H });
    if (!g.ok) throw new Error('قراءة المتجر HTTP ' + g.status);
    const rec = (await g.json())[0], prods = rec.products, before = [], n0 = prods.length;
    let changed = 0;
    for (const row of okRows) {
      const p = prods.find(x => String(x.id) === row.store_id);
      if (!p) { console.log('✘ منتج غير موجود في المتجر:', row.store_id); continue; }
      if (String(p.video_url || '').trim()) { console.log('• له فيديو أصلاً — لم يُمسّ:', p.name, '⇐', p.video_url); continue; }
      console.log((APPLY ? '✔ ' : '○ ') + p.name + '\n    ⇐ ' + row.video_url + '\n    القناة: ' + row.channel + ' · العنوان: ' + row.title);
      before.push({ store_id: row.store_id, name: p.name, video_url: p.video_url || '' });
      p.video_url = row.video_url; changed++;
    }
    if (!APPLY) { console.log('\nفحص فقط — ' + changed + ' منتجاً جاهزاً. أضِف --apply للكتابة.'); return; }
    if (!changed) { console.log('\nلا شيء يُكتب.'); return; }
    if (prods.length !== n0) throw new Error('عدد المنتجات تغيّر — توقّف');
    fs.writeFileSync(file.replace(/\.json$/, '') + '.before.json', JSON.stringify({ at: new Date().toISOString(), store_updated_at: rec.updated_at, before }, null, 1));
    const url = U + '/rest/v1/gmt_store?id=eq.1&select=id' + (rec.updated_at ? '&updated_at=eq.' + encodeURIComponent(rec.updated_at) : '&updated_at=is.null');
    const w = await fetch(url, { method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=representation' }, H), body: JSON.stringify({ products: prods, updated_at: new Date().toISOString() }) });
    if (!w.ok) throw new Error('حفظ المتجر HTTP ' + w.status);
    const rows = await w.json().catch(() => null);
    if (Array.isArray(rows) && rows.length) { console.log('\nكُتب ' + changed + ' فيديو · المنتجات ' + n0 + ' كما هي.'); return; }
    console.log('المتجر تغيّر من جهة أخرى — إعادة المحاولة…');
  }
  throw new Error('المتجر يتغيّر باستمرار — أعد المحاولة لاحقاً');
})().catch(e => { console.error('خطأ:', e.message); process.exit(1); });
