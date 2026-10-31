/* ═══════════════════════════════════════════════════════════════════════════
   gmt-merge-review.js — «🔎 مشابهات تنتظر قرارك» (TASK-0291 · المالك seq 235)
   «الاشياء اللي بدها دمج او شاكك فيها خليها تطلع قدامي فورا اول ما ادخل على السيستم …
    اعرضها لي مع الصور ومع كل شيء لحتى اوافق او قلك لا هي غيرها»

   مصدرها جدول gmt_merge_review (القاعدة الرئيسية) — يكتبه التدقيق (Claude) أو الأدوات:
     kind = 'merge' ⇐ منتج الجرد subject_id قد يكون نفسه أحد المرشّحين cands[].id
                      «✅ نعم هو نفسه» ⇒ يُدمج فيه: أسماء الفاتورة + اسمه بين الأسماء البديلة
                      + مواصفاته/توافقه/صوره إن كان المرشّح بلا شيء — ثمّ يُحذف بعد لقطةٍ كاملة
                      في السجلّ (قابلٌ للاسترجاع). لا يُدمج آلياً منتجٌ له كمية أو فواتير.
     kind = 'pick'  ⇐ منتجٌ له اسمان/توافقان وهو واحد في الحقيقة: اختر الصحيح ⇒ يُعدَّل الاسم والتوافق
     kind = 'link'  ⇐ منتج الجرد ومنتج المتجر cands[].store_id: «اربطهما» ⇒ رابط المتجر في الجرد
     kind = 'link' بلا subject_id ⇐ منتج متجر cands[0].store_id أمام مرشّحي الجرد cands[].id (المالك seq 242: «جمع كل منتجات المتجر وربطها بالجرد»)
                      «✅ هو نفسه» ⇒ يُربط (رابط المتجر في الجرد، أو inv_id في المتجر إن كان منتج الجرد مربوطاً بغيره)
                      «❌ ولا واحد منها» ⇒ يُعرَّف منتجاً جديداً في الجرد بكمية صفر مربوطاً به
     kind = 'bulk'  ⇐ دفعة توحيدٍ مؤكَّدة بالأدلّة (مثل ألوان الكفر ⇐ كفر الموديل): cands[] = {into, ids[], label, noAlt}
                      «✅ نفّذ» مرّةً واحدة ⇒ كلّ منتجٍ يُدمج في هدفه بالشروط نفسها (بلا كمية · بلا فواتير · لقطة كاملة)
   «❌ لا، مختلف» يحفظ القرار فلا يُسأل مرّةً ثانية · «⏭ لاحقاً» يتركه للمرّة القادمة.
   يظهر للأدمن تلقائياً عند الدخول (مرّةً في الجلسة) وعند فتح وضع الأدمن، ومن «الأدوات» دائماً.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTMergeReview) return;
  const T = 'gmt_merge_review';
  const QTY = ['homs', 'daraa', 'haleb', 'kurani', 'sarmada', 'fakhouri', 'hny_sbyl', 'germany', 'china', 'count'];
  const SEEN = 'gmt_mr_seen';
  let rows = [], prods = new Map(), store = null, idx = 0, busy = false, el = null;

  const db = () => global.GMT_DB && GMT_DB.MAIN;
  const H = (extra) => { const d = db(); return Object.assign({ apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json' }, extra || {}); };
  async function rest(method, path, body, extra) {
    const r = await fetch(db().url + '/rest/v1/' + path, { method, headers: H(extra), body: body == null ? undefined : JSON.stringify(body) });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (_) {}
    if (!r.ok) throw new Error((j && (j.message || j.hint)) || ('HTTP ' + r.status));
    return j;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isAdm = () => { try { return !!(global.GMTRole && GMTRole.isAdmin()); } catch (_) { return false; } };
  const who = () => { try { return (global.GMTRole && GMTRole.name && GMTRole.name()) || 'الأدمن'; } catch (_) { return 'الأدمن'; } };
  const qtyOf = p => QTY.reduce((s, k) => s + (Number(p && p[k]) || 0), 0);
  const nk = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  function imgsOf(p) {
    const a = [];
    if (p && p.image_url) a.push(p.image_url);
    (p && Array.isArray(p.images) ? p.images : []).forEach(u => { if (u && !a.includes(u)) a.push(u); });
    return a.filter(u => /^https?:|^data:|^img\//.test(String(u)));
  }
  function realSpecs(s) {
    if (!s) return [];
    if (Array.isArray(s)) return s.filter(x => x && x.label && x.value != null).map(x => [x.label, x.value]);
    if (typeof s === 'object') return Object.keys(s).filter(k => !/^__/.test(k)).map(k => [k, s[k]]);
    return [];
  }

  async function load() {
    rows = await rest('GET', T + '?status=eq.pending&order=prio.asc,id.asc&select=*') || [];
    const ids = new Set();
    rows.forEach(r => { if (r.subject_id) ids.add(r.subject_id); (r.cands || []).forEach(c => { if (!c) return; if (c.id) ids.add(c.id); if (c.into) ids.add(c.into); (Array.isArray(c.ids) ? c.ids : []).forEach(x => x && ids.add(x)); }); });
    prods = new Map();
    const L = [...ids];
    for (let i = 0; i < L.length; i += 60) {
      const part = await rest('GET', 'products?id=in.(' + L.slice(i, i + 60).join(',') + ')&select=*') || [];
      part.forEach(p => prods.set(String(p.id), p));
    }
    if (rows.some(r => r.kind === 'link')) await loadStore().catch(() => {});
    return rows;
  }
  async function loadStore() {
    if (store) return store;
    const S = global.GMT_DB && GMT_DB.STORE; if (!S) return null;
    const r = await fetch(S.url + '/rest/v1/gmt_store?id=eq.1&select=products', { headers: { apikey: S.key, Authorization: 'Bearer ' + S.key } });
    const j = await r.json(); store = new Map(((j && j[0] && j[0].products) || []).map(p => [String(p.id), p]));
    return store;
  }

  /* ── البطاقة ── */
  function prodCard(p, role, btn) {
    if (!p) return `<div class="mr-col mr-miss">المنتج لم يعد موجوداً في الجرد</div>`;
    const im = imgsOf(p), sp = realSpecs(p.specs).slice(0, 10), inv = Array.isArray(p.invoice_names) ? p.invoice_names : [];
    return `<div class="mr-col">
      <div class="mr-role">${role}</div>
      <div class="mr-gal">${im.length ? im.map(u => `<img src="${esc(u)}" loading="lazy" alt="" onclick="window.open(this.src,'_blank')">`).join('') : '<div class="mr-noimg">بلا صورة</div>'}</div>
      <div class="mr-name">${esc(p.name)}</div>
      <div class="mr-kv">
        <span>المجموعة: <b>${esc(p.group_name || '—')}</b></span>
        <span>الكمية: <b>${qtyOf(p)}</b></span>
        <span>السعر: <b>${Number(p.price) || 0}</b></span>
        ${isAdm() ? `<span>الشراء: <b>${Number(p.cost_price) || 0}</b></span>` : ''}
        <span>الباركود: <b dir="ltr">${esc(p.barcode || '—')}</b></span>
      </div>
      ${p.compat ? `<div class="mr-line">🎯 متوافق مع: <b>${esc(p.compat)}</b></div>` : ''}
      ${inv.length ? `<div class="mr-line">🧾 في الفواتير: ${inv.map(x => `<code>${esc(x && x.n)}</code>`).join(' ')}</div>` : ''}
      ${p.alt_names ? `<div class="mr-line mr-dim">أسماء بديلة: ${esc(String(p.alt_names).slice(0, 160))}</div>` : ''}
      ${sp.length ? `<table class="mr-sp">${sp.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</td></tr>`).join('')}</table>` : '<div class="mr-dim">بلا مواصفات</div>'}
      ${btn || ''}
    </div>`;
  }
  function storeCard(s, btn) {
    if (!s) return `<div class="mr-col mr-miss">منتج المتجر لم يعد موجوداً</div>`;
    const im = (Array.isArray(s.images) ? s.images : []).filter(Boolean);
    return `<div class="mr-col"><div class="mr-role">🛒 في المتجر</div>
      <div class="mr-gal">${im.length ? im.map(u => `<img src="${esc(u)}" loading="lazy" alt="" onclick="window.open(this.src,'_blank')">`).join('') : '<div class="mr-noimg">بلا صورة</div>'}</div>
      <div class="mr-name">${esc(s.name)}</div>
      <div class="mr-kv"><span>السعر: <b>${Number(s.price) || 0}</b></span></div>
      ${s.description ? `<div class="mr-line mr-dim">${esc(String(s.description).slice(0, 260))}</div>` : ''}
      ${btn || ''}</div>`;
  }
  function render() {
    if (!el) return;
    const box = el.querySelector('.mr-body'), head = el.querySelector('.mr-count');
    if (idx >= rows.length) {
      head.textContent = '';
      box.innerHTML = `<div class="mr-done">✅ لا شيء ينتظر قرارك الآن.</div>`;
      return;
    }
    const r = rows[idx], subj = prods.get(String(r.subject_id));
    head.textContent = (idx + 1) + ' / ' + rows.length;
    let cols = '';
    if (r.kind === 'merge') {
      cols = prodCard(subj, '🆕 هذا المنتج', '') + (r.cands || []).map((c, i) => prodCard(prods.get(String(c.id)), '📦 ' + (c.label || 'عندك في الجرد'),
        `<button class="mr-yes" data-mr="merge" data-i="${i}">✅ نعم هو نفسه — ادمجهما</button>`)).join('');
    } else if (r.kind === 'link' && !r.subject_id) {
      const sc = (r.cands || []).find(c => c && c.store_id) || {};
      cols = storeCard(store && store.get(String(sc.store_id)), '') + (r.cands || []).map((c, i) => c && c.id ? prodCard(prods.get(String(c.id)), '📦 ' + (c.label || 'عندك في الجرد'),
        `<button class="mr-yes" data-mr="slink" data-i="${i}">✅ نعم هو نفسه — اربطهما</button>`) : '').join('');
    } else if (r.kind === 'link') {
      cols = prodCard(subj, '📦 في الجرد', '') + (r.cands || []).map((c, i) => storeCard(store && store.get(String(c.store_id)),
        `<button class="mr-yes" data-mr="link" data-i="${i}">✅ نعم هو نفسه — اربطهما</button>`)).join('');
    } else if (r.kind === 'bulk') {
      /* (المالك seq 245) «باقي المنتجات … احدد شيء يندمج وحدد شيء ما يندمج · نفّذ المحدد» ⇒ مربّع لكلّ منتج (محدَّدٌ افتراضياً) ولكلّ مجموعة */
      const g = (r.cands || []).map((c, gi) => { const t = prods.get(String(c.into)), L = (c.ids || []).map(x => prods.get(String(x))).filter(Boolean);
        return `<div class="mr-bk"><label class="mr-bk-h"><input type="checkbox" data-bkg="${gi}" checked> ⇐ ${esc(t ? t.name : 'غير موجود')}${c.label ? ' <span class="mr-dim">· ' + esc(c.label) + '</span>' : ''}</label>${L.length ? `<ul>${L.map(p => `<li><label><input type="checkbox" data-bk="${gi}" value="${esc(p.id)}" checked> ${esc(p.name)}${qtyOf(p) ? ' <b class="mr-warn">(كمية ' + qtyOf(p) + ')</b>' : ''}</label></li>`).join('')}</ul>` : '<div class="mr-dim">✓ تمّ</div>'}</div>`; }).join('');
      const im = (r.cands || []).map(c => prods.get(String(c.into))).filter(Boolean).map(imgsOf)[0] || [];
      cols = `<div class="mr-col"><div class="mr-role">📦 توحيد</div>${im.length ? `<div class="mr-gal">${im.map(u => `<img src="${esc(u)}" loading="lazy" alt="" onclick="window.open(this.src,'_blank')">`).join('')}</div>` : ''}${g}
        <button class="mr-yes" data-mr="bulk">✅ نفّذ المحدَّد</button></div>`;
    } else if (r.kind === 'pick') {
      cols = prodCard(subj, '📦 المنتج', `<div class="mr-picks">${(r.cands || []).map((c, i) =>
        `<button class="mr-yes" data-mr="pick" data-i="${i}">✅ ${esc(c.label || c.name)}</button>`).join('')}</div>`);
    }
    const stage = r.stage || (r.kind === 'bulk' ? 'توحيد' : r.kind === 'pick' ? 'تصحيح الاسم والتوافق' : r.kind === 'link' ? 'ربط المتجر بالجرد' : 'دمج المكرّر');
    box.innerHTML = `<div class="mr-q"><div class="mr-stage">المرحلة: ${esc(stage)}</div><div class="mr-title">${esc(r.title || 'هل هما المنتج نفسه؟')}</div>
        ${r.note ? `<div class="mr-note">🔎 ${esc(r.note)}</div>` : ''}${r.conf ? `<div class="mr-conf">ثقتي: ${Number(r.conf)}٪</div>` : ''}</div>
      <div class="mr-cols">${cols}</div>
      <div class="mr-acts"><button class="mr-no" data-mr="no">❌ ${r.kind === 'pick' ? 'لا، اتركه كما هو' : (r.kind === 'link' && !r.subject_id) ? 'ولا واحد منها — عرّفه جديداً في الجرد' : 'لا، مختلف'}</button><button class="mr-later" data-mr="later">⏭ لاحقاً</button></div>
      <div class="mr-err"></div>`;
  }
  function setErr(m) { const e = el && el.querySelector('.mr-err'); if (e) e.textContent = m || ''; }
  /* (المالك seq 245) «يعرض لي شريط التقدم اثناء الدمج او الحفظ» */
  function setProg(m, frac) {
    const e = el && el.querySelector('.mr-prog'); if (!e) return;
    e.style.display = m ? '' : 'none'; if (!m) { e.innerHTML = ''; return; }
    const w = frac == null ? null : Math.max(3, Math.round(frac * 100));
    e.innerHTML = `<div class="mr-prog-t">${esc(m)}</div><div class="mr-bar"><div class="mr-bar-i${w == null ? ' mr-bar-ind' : ''}" style="width:${w == null ? 35 : w}%"></div></div>`;
  }

  /* ── الأفعال ── */
  async function audit(o) {
    try { await rest('POST', 'gmt_audit', [Object.assign({ actor: who(), page: (location.pathname.split('/').pop() || 'home.html'), entity: 'product' }, o)], { Prefer: 'return=minimal' }); } catch (_) {}
  }
  async function decide(r, status, result) {
    await rest('PATCH', T + '?id=eq.' + r.id, { status, decided_by: who(), decided_at: new Date().toISOString(), result: result || null }, { Prefer: 'return=minimal' });
  }
  async function refsOf(id) {
    const T4 = ['invoice_items', 'product_offers', 'import_invoice_items', 'import_inventory'];
    const r = await Promise.all(T4.map(t => rest('GET', t + '?product_id=eq.' + id + '&select=product_id&limit=1').then(j => Array.isArray(j) && j.length ? t : null).catch(() => null)));
    return r.filter(Boolean);
  }
  async function doMerge(r, c) {
    const b = await mergeOne(r.subject_id, c.id, r.id, c);
    await decide(r, 'done', { action: 'merged', into: c.id, snapshot: b });
  }
  /* (المالك seq 244: «جمدت الشاشة») ⇐ عدّادٌ حيّ «دُمج N من M» + المجموعات (أهدافٌ مختلفة) بالتوازي ٤ معاً — داخل المجموعة الواحدة بالتتابع (الهدف نفسه) */
  async function doBulk(r) {
    const byInto = new Map();                                     // مجموعتان على الهدف نفسه ⇒ بالتتابع لا بالتوازي
    const chosen = new Set(el ? [...el.querySelectorAll('[data-bk]:checked')].map(x => x.value) : []), skipped = [];
    (r.cands || []).filter(c => c && c.into && Array.isArray(c.ids)).forEach(c => {
      const ids = c.ids.filter(x => { const ok = !el || chosen.has(String(x)); if (!ok) skipped.push({ id: x, into: c.into }); return ok; });
      const g = byInto.get(String(c.into)); if (g) g.ids = g.ids.concat(ids); else byInto.set(String(c.into), Object.assign({}, c, { ids })); });
    if (![...byInto.values()].some(g => g.ids.length)) throw new Error('لم تحدّد شيئاً للدمج');
    const done = [], fail = [], groups = [...byInto.values()];
    const total = groups.reduce((s, c) => s + c.ids.length, 0); let n = 0;
    const tick = () => setProg('⏳ يدمج… ' + n + ' / ' + total + ' — لا تغلق الصفحة', total ? n / total : 0);
    tick();
    const runGroup = async (c) => {
      for (const id of c.ids) {
        try {
          const [x] = await rest('GET', 'products?id=eq.' + id + '&select=id') || [];
          if (x) { const b = await mergeOne(id, c.into, r.id, c); done.push({ id, name: b.name, into: c.into }); prods.delete(String(id)); }
        } catch (er) { fail.push({ id, err: (er && er.message) || String(er) }); }
        n++; tick();
      }
    };
    const q = groups.slice(); await Promise.all([0, 1, 2, 3].map(async () => { while (q.length) await runGroup(q.shift()); }));
    setProg('');
    if (fail.length) { await rest('PATCH', T + '?id=eq.' + r.id, { result: { done, fail } }, { Prefer: 'return=minimal' }).catch(() => {}); throw new Error('تعذّر ' + fail.length + ': ' + fail[0].err); }
    await decide(r, 'done', { action: 'bulk_merged', done, skipped });
  }
  async function mergeOne(bId, aId, reviewId, c) {
    const [[b], [a]] = await Promise.all([rest('GET', 'products?id=eq.' + bId + '&select=*').then(x => x || []), rest('GET', 'products?id=eq.' + aId + '&select=*').then(x => x || [])]);
    if (!a || !b) throw new Error('أحد المنتجين لم يعد موجوداً');
    if (qtyOf(b) > 0 || (b.in_transit && Object.keys(b.in_transit).length)) throw new Error('«' + b.name + '» له كمية في المخزون — لا يُدمج آلياً. انقل كميته أوّلاً أو ادمجه من الجرد.');
    const refs = await refsOf(b.id);
    if (refs.length) throw new Error('«' + b.name + '» عليه فواتير/عروض (' + refs.join('، ') + ') — لا يُدمج آلياً.');
    const inv = (Array.isArray(a.invoice_names) ? a.invoice_names : []).slice();
    (Array.isArray(b.invoice_names) ? b.invoice_names : []).forEach(x => { if (x && x.n && !inv.some(y => y && nk(y.n) === nk(x.n))) inv.push(x); });
    const alt = String(a.alt_names || ''), add = (c && c.noAlt) ? [] : [b.name].concat(String(b.alt_names || '').split(/[،,]/)).map(s => String(s || '').trim()).filter(s => s && nk(s) !== nk(a.name) && !nk(alt).includes(nk(s)));
    const patch = { invoice_names: inv, updated_at: new Date().toISOString() };
    if (add.length) patch.alt_names = [alt].concat(add).filter(Boolean).join('، ');
    if (!realSpecs(a.specs).length && realSpecs(b.specs).length) patch.specs = b.specs;
    if (!a.compat && b.compat) patch.compat = b.compat;
    if (!imgsOf(a).length && imgsOf(b).length) { patch.image_url = b.image_url || imgsOf(b)[0]; patch.images = imgsOf(b); }
    if (!a.store_url && b.store_url) patch.store_url = b.store_url;
    if (!a.group_name && b.group_name) patch.group_name = b.group_name;
    if (!a.category && b.category) patch.category = b.category;
    const up = await rest('PATCH', 'products?id=eq.' + a.id, patch, { Prefer: 'return=representation' });
    if (!Array.isArray(up) || !up.length) throw new Error('لم يُحفظ التعديل على «' + a.name + '»');
    await audit({ action: 'merge_review', entity_id: String(b.id), entity_name: b.name, old_value: JSON.stringify(b), new_value: a.name, reason: 'قرار المالك في «مشابهات تنتظر قرارك»: نعم هو نفسه', sovereign: false, meta: { review_id: reviewId, merged_into: a.id, patch_keys: Object.keys(patch) } });
    const del = await rest('DELETE', 'products?id=eq.' + b.id, null, { Prefer: 'return=representation' });
    if (!Array.isArray(del) || !del.length) throw new Error('تعذّر حذف «' + b.name + '» بعد الدمج — أُضيفت أسماؤه للمنتج الأصلي');
    return b;
  }
  async function doLink(r, c) {
    const [a] = await rest('GET', 'products?id=eq.' + r.subject_id + '&select=id,name,store_url') || [];
    if (!a) throw new Error('منتج الجرد لم يعد موجوداً');
    const link = (global.GMT_LINKS && GMT_LINKS.store ? GMT_LINKS.store : 'https://general-media-tech.github.io/system__V/store.html') .replace(/[#?].*$/, '') + '#product=' + encodeURIComponent(c.store_id);
    const up = await rest('PATCH', 'products?id=eq.' + a.id, { store_url: link }, { Prefer: 'return=representation' });
    if (!Array.isArray(up) || !up.length) throw new Error('لم يُحفظ الربط');
    await audit({ action: 'store_link', entity_id: String(a.id), entity_name: a.name, field: 'store_url', old_value: a.store_url || null, new_value: link, reason: 'قرار المالك في «مشابهات تنتظر قرارك»', meta: { review_id: r.id } });
    await decide(r, 'done', { action: 'linked', store_id: c.store_id, old: a.store_url || null });
  }
  /* ── متجر ⇐ جرد ── */
  const STORE_PAGE = () => (global.GMT_LINKS && GMT_LINKS.store ? GMT_LINKS.store : 'https://general-media-tech.github.io/system__V/store.html').replace(/[#?].*$/, '');
  async function storeSetInvId(sid, invId) {
    const S = global.GMT_DB && GMT_DB.STORE; const SH = { apikey: S.key, Authorization: 'Bearer ' + S.key };
    for (let i = 0; i < 3; i++) {
      const g = await fetch(S.url + '/rest/v1/gmt_store?id=eq.1&select=id,updated_at,products', { headers: SH }); const rec = ((await g.json()) || [])[0];
      if (!rec) throw new Error('تعذّرت قراءة المتجر');
      const prods0 = Array.isArray(rec.products) ? rec.products : []; if (!prods0.some(x => String(x.id) === String(sid))) throw new Error('منتج المتجر لم يعد موجوداً');
      const next = prods0.map(x => String(x.id) === String(sid) ? Object.assign({}, x, { inv_id: String(invId) }) : x);
      let url = S.url + '/rest/v1/gmt_store?id=eq.1&select=id'; const body = { products: next };
      if ('updated_at' in rec) { url += rec.updated_at ? '&updated_at=eq.' + encodeURIComponent(rec.updated_at) : '&updated_at=is.null'; body.updated_at = new Date().toISOString(); }
      const w = await fetch(url, { method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=representation' }, SH), body: JSON.stringify(body) });
      if (!w.ok) throw new Error('حفظ المتجر HTTP ' + w.status);
      const rows = await w.json().catch(() => null); if (Array.isArray(rows) && rows.length) { store = null; return; }
    }
    throw new Error('المتجر يتغيّر من جهةٍ أخرى — أعد المحاولة');
  }
  async function doSLink(r, c) {
    const sc = (r.cands || []).find(x => x && x.store_id) || {};
    const [p] = await rest('GET', 'products?id=eq.' + c.id + '&select=id,name,store_url') || [];
    if (!p) throw new Error('منتج الجرد لم يعد موجوداً');
    const link = STORE_PAGE() + '#product=' + encodeURIComponent(sc.store_id);
    if (!p.store_url) {
      const up = await rest('PATCH', 'products?id=eq.' + p.id, { store_url: link }, { Prefer: 'return=representation' });
      if (!Array.isArray(up) || !up.length) throw new Error('لم يُحفظ الربط');
    } else if (p.store_url !== link) await storeSetInvId(sc.store_id, p.id);      // مربوطٌ بقائمةٍ أخرى ⇒ هذه قائمةٌ مكرّرة في المتجر: تُربط من جهة المتجر
    await audit({ action: 'store_link', entity_id: String(p.id), entity_name: p.name, field: p.store_url ? 'store.inv_id' : 'store_url', new_value: sc.store_id, reason: 'قرار المالك في «مشابهات تنتظر قرارك»', meta: { review_id: r.id } });
    await decide(r, 'done', { action: 'linked', store_id: sc.store_id, inv_id: p.id, via: p.store_url ? 'store.inv_id' : 'store_url' });
  }
  function ean13() { let s = '62' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0'), c = 0; for (let i = 0; i < 12; i++) c += (+s[i]) * (i % 2 ? 3 : 1); return s + ((10 - c % 10) % 10); }
  async function doSNew(r) {
    const sc = (r.cands || []).find(x => x && x.store_id) || {};
    store = null; await loadStore(); const sp = store && store.get(String(sc.store_id));
    if (!sp) throw new Error('منتج المتجر لم يعد موجوداً');
    const link = STORE_PAGE() + '#product=' + encodeURIComponent(sc.store_id);
    const ex = await rest('GET', 'products?store_url=eq.' + encodeURIComponent(link) + '&select=id') || [];
    if (ex.length) { await decide(r, 'done', { action: 'already_defined', inv_id: ex[0].id }); return; }
    const specs = {}; (Array.isArray(sp.specs) ? sp.specs : []).forEach(x => { if (x && x.label) specs[x.label] = x.value; });
    if (sp.description) specs.__desc = sp.description; specs.__source = 'المتجر (مشابهات تنتظر قرارك)';
    const imgs = (Array.isArray(sp.images) ? sp.images : []).filter(Boolean);
    let bc = ean13(); for (let i = 0; i < 5; i++) { const d = await rest('GET', 'products?barcode=eq.' + bc + '&select=id') || []; if (!d.length) break; bc = ean13(); }
    const row = { name: String(sp.name || '').replace(/\s+/g, ' ').trim(), price: Number(sp.price) || 0, barcode: bc, image_url: imgs[0] || null, images: imgs, specs, specs_source: 'المتجر — منتجٌ كان في المتجر وحده',
      group_name: sc.group || null, category: sc.category || null, store_url: link, haleb: 0, daraa: 0, cost_price: 0, invoice_names: [] };
    const ins = await rest('POST', 'products', [row], { Prefer: 'return=representation' });
    if (!Array.isArray(ins) || !ins.length) throw new Error('لم يُنشأ المنتج');
    await audit({ action: 'define_from_store', entity_id: String(ins[0].id), entity_name: row.name, field: 'store_url', new_value: link, reason: 'قرار المالك: ليس أيّاً من منتجات الجرد ⇐ عُرِّف جديداً بكمية صفر', meta: { review_id: r.id } });
    await decide(r, 'done', { action: 'defined', inv_id: ins[0].id, store_id: sc.store_id });
  }
  async function doPick(r, c) {
    const [p] = await rest('GET', 'products?id=eq.' + r.subject_id + '&select=*') || [];
    if (!p) throw new Error('المنتج لم يعد موجوداً');
    const patch = { updated_at: new Date().toISOString() };
    if (c.name && c.name !== p.name) {
      patch.name = c.name;
      const alt = String(p.alt_names || ''); if (!nk(alt).includes(nk(p.name))) patch.alt_names = [alt, p.name].filter(Boolean).join('، ');
    }
    if (c.compat != null) patch.compat = c.compat;
    if (c.specs && typeof c.specs === 'object' && p.specs && typeof p.specs === 'object' && !Array.isArray(p.specs)) patch.specs = Object.assign({}, p.specs, c.specs);
    const up = await rest('PATCH', 'products?id=eq.' + p.id, patch, { Prefer: 'return=representation' });
    if (!Array.isArray(up) || !up.length) throw new Error('لم يُحفظ التعديل');
    await audit({ action: 'pick_review', entity_id: String(p.id), entity_name: p.name, field: 'name', old_value: JSON.stringify({ name: p.name, compat: p.compat }), new_value: JSON.stringify({ name: patch.name || p.name, compat: patch.compat }), reason: 'قرار المالك في «مشابهات تنتظر قرارك»', meta: { review_id: r.id } });
    await decide(r, 'done', { action: 'picked', choice: c, before: { name: p.name, compat: p.compat, alt_names: p.alt_names } });
  }
  async function onClick(e) {
    const b = e.target.closest('[data-mr]'); if (!b || busy) return;
    const r = rows[idx]; if (!r) return;
    const k = b.getAttribute('data-mr'), c = (r.cands || [])[+b.getAttribute('data-i')];
    if (k === 'later') { idx++; render(); return; }
    if (!isAdm()) { const ok = global.GMTRole && GMTRole.requireAdmin ? await GMTRole.requireAdmin('قرار المشابهات') : false; if (!ok) return; }
    busy = true; el.classList.add('mr-busy'); setErr(''); if (k !== 'bulk') setProg(k === 'no' ? '⏳ يحفظ قرارك…' : '⏳ يدمج ويحفظ…', null);
    try {
      if (k === 'no' && r.kind === 'link' && !r.subject_id) await doSNew(r);
      else if (k === 'no') await decide(r, 'rejected', { action: 'different' });
      else if (k === 'slink') await doSLink(r, c);
      else if (k === 'merge') await doMerge(r, c);
      else if (k === 'bulk') await doBulk(r);
      else if (k === 'link') await doLink(r, c);
      else if (k === 'pick') await doPick(r, c);
      idx++; render();
    } catch (er) { setErr('⚠️ ' + ((er && er.message) || er)); }
    finally { busy = false; if (el) { el.classList.remove('mr-busy'); if (k !== 'bulk') setProg(''); } }
  }

  /* ── النافذة ── */
  const CSS = `.mr-ov{position:fixed;inset:0;z-index:99990;background:rgba(10,14,22,.72);display:flex;align-items:stretch;justify-content:center;direction:rtl;font-family:inherit}
  .mr-win{background:#f6f7fb;width:100%;max-width:1180px;margin:auto;max-height:100vh;display:flex;flex-direction:column;border-radius:16px;overflow:hidden}
  @media(max-width:700px){.mr-win{border-radius:0;height:100vh}}
  .mr-top{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#0f1219;color:#fff}
  .mr-top h3{margin:0;font-size:16px;flex:1}.mr-count{font-size:13px;opacity:.8}
  .mr-x{background:#ffffff22;color:#fff;border:0;border-radius:10px;padding:6px 12px;font-size:15px;cursor:pointer}
  .mr-body{overflow:auto;padding:12px;flex:1}
  .mr-q{background:#fff;border-radius:12px;padding:10px 12px;margin-bottom:10px;border:1px solid #e3e6ee}
  .mr-title{font-weight:900;font-size:15px;color:#0f1219}.mr-note{font-size:13px;color:#3b4250;margin-top:6px;line-height:1.7}.mr-conf{font-size:12px;color:#7a8291;margin-top:4px}
  .mr-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
  .mr-col{background:#fff;border:1px solid #e3e6ee;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px;min-width:0}
  .mr-miss{color:#b42318;align-items:center;justify-content:center}
  .mr-role{font-size:12px;font-weight:800;color:#5b6472}
  .mr-gal{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}.mr-gal img{height:150px;max-width:220px;object-fit:contain;background:#f1f3f7;border-radius:8px;cursor:zoom-in;flex:0 0 auto}
  .mr-noimg{height:150px;display:flex;align-items:center;justify-content:center;color:#9aa1ad;background:#f1f3f7;border-radius:8px;width:100%}
  .mr-name{font-weight:900;font-size:15px;color:#0f1219;word-break:break-word}
  .mr-kv{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px;color:#3b4250}
  .mr-line{font-size:12.5px;color:#2b3240;word-break:break-word}.mr-line code{background:#eef1f6;border-radius:6px;padding:1px 6px;font-size:12px;display:inline-block;margin:2px 0;direction:ltr}
  .mr-dim{color:#7a8291;font-size:12px}
  .mr-sp{width:100%;border-collapse:collapse;font-size:12px}.mr-sp td{border-top:1px solid #eef0f4;padding:3px 4px;vertical-align:top}.mr-sp td:first-child{color:#5b6472;width:38%}
  .mr-yes{margin-top:auto;background:#12a150;color:#fff;border:0;border-radius:10px;padding:10px;font-weight:900;font-size:14px;cursor:pointer}
  .mr-picks{display:flex;flex-direction:column;gap:6px;margin-top:6px}
  .mr-acts{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap}
  .mr-no{background:#fff;color:#b42318;border:2px solid #f0c4bf;border-radius:10px;padding:10px 18px;font-weight:900;cursor:pointer}
  .mr-later{background:#fff;color:#3b4250;border:1px solid #d6dae3;border-radius:10px;padding:10px 18px;cursor:pointer}
  .mr-err{color:#b42318;text-align:center;font-weight:800;margin-top:8px;font-size:13px}
  .mr-done{text-align:center;padding:40px 10px;font-size:16px;font-weight:800;color:#12a150}
  .mr-busy .mr-body{opacity:.55;pointer-events:none}
  .mr-prog{background:#fff7e0;color:#7a4b00;font-weight:900;text-align:center;padding:8px 12px 10px;font-size:15px;border-bottom:1px solid #f1d58a}
  .mr-prog-t{margin-bottom:6px}.mr-bar{height:10px;background:#f6e2a8;border-radius:6px;overflow:hidden}.mr-bar-i{height:100%;background:#12a150;border-radius:6px;transition:width .3s}
  .mr-bar-ind{animation:mrind 1.1s ease-in-out infinite alternate}@keyframes mrind{from{margin-inline-start:0}to{margin-inline-start:65%}}
  .mr-stage{font-size:12px;font-weight:800;color:#7a4b00;background:#fff7e0;border-radius:8px;display:inline-block;padding:2px 8px;margin-bottom:6px}
  .mr-bk input{width:18px;height:18px;vertical-align:middle;accent-color:#12a150}.mr-bk li{list-style:none;margin:3px 0}.mr-bk ul{padding-inline-start:6px}
  .mr-bk{border-top:1px solid #eef0f4;padding:6px 0}.mr-bk-h{font-weight:900;font-size:13.5px;color:#0f1219}.mr-bk ul{margin:4px 0 0;padding-inline-start:18px;font-size:12.5px;color:#3b4250}.mr-warn{color:#b42318}`;
  function close() { if (el) { el.remove(); el = null; } }
  async function open(opts) {
    if (el) return;
    if (!document.getElementById('mr-css')) { const s = document.createElement('style'); s.id = 'mr-css'; s.textContent = CSS; document.head.appendChild(s); }
    el = document.createElement('div'); el.className = 'mr-ov';
    el.innerHTML = `<div class="mr-win" role="dialog" aria-label="مشابهات تنتظر قرارك"><div class="mr-top"><h3>🔎 مشابهات تنتظر قرارك</h3><span class="mr-count"></span><button class="mr-x" type="button">✕ إغلاق</button></div><div class="mr-prog" style="display:none"></div><div class="mr-body"><div class="mr-done" style="color:#5b6472">أحمّل…</div></div></div>`;
    document.body.appendChild(el);
    el.querySelector('.mr-x').onclick = close;
    el.addEventListener('click', onClick);
    el.addEventListener('change', e => { const g = e.target.getAttribute && e.target.getAttribute('data-bkg'); if (g == null) return; el.querySelectorAll('[data-bk="' + g + '"]').forEach(x => { x.checked = e.target.checked; }); });
    try { if (!(opts && opts.preloaded)) await load(); idx = 0; render(); }
    catch (er) { el.querySelector('.mr-body').innerHTML = `<div class="mr-done" style="color:#b42318">⚠️ ${esc((er && er.message) || er)}</div>`; }
  }
  async function pendingCount() {
    try { const r = await fetch(db().url + '/rest/v1/' + T + '?status=eq.pending&select=id', { headers: H({ Prefer: 'count=exact', Range: '0-0' }) }); const m = /\/(\d+)/.exec(r.headers.get('content-range') || ''); return m ? +m[1] : 0; } catch (_) { return 0; }
  }
  /* «فوراً أول ما أدخل»: الأدمن عند الدخول (مرّةً في الجلسة) أو لحظة فتح وضع الأدمن */
  async function autoOpen(force) {
    if (!isAdm() || el) return;
    let seen = false; try { seen = sessionStorage.getItem(SEEN) === '1'; } catch (_) {}
    if (seen && !force) return;
    try { await load(); } catch (_) { return; }
    if (!rows.length) return;
    try { sessionStorage.setItem(SEEN, '1'); } catch (_) {}
    open({ preloaded: true });
  }
  function boot() {
    const want = /[?&]review=merge\b/.test(location.search);
    if (want) { if (isAdm()) open(); else if (global.GMTRole && GMTRole.requireAdmin) GMTRole.requireAdmin('مشابهات تنتظر قرارك').then(ok => ok && open()); }
    else setTimeout(() => autoOpen(false), 1500);
    try {
      let was = isAdm();
      new MutationObserver(() => { const now = isAdm(); if (now && !was) autoOpen(false); was = now; })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    } catch (_) {}
  }
  global.GMTMergeReview = { open, close, load, pendingCount, autoOpen, _state: () => ({ rows, idx }) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
