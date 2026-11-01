/* gmt-store-sync.js — ما يتغيّر في الجرد يتغيّر في المتجر (TASK-0292 · المالك seq 276)
   «المنتجات اللي بحذفها أنا من الجرد خلاص تنحذف لحالها من المتجر …
    في منتجات دمجناها لساتهم يطلعوا في المتجر كمنتج مختلف وهذا غلط — الأشياء التي تتأثّر في الجرد تتأثّر في المتجر».
   مكانٌ واحد لهذا المنطق (لا نسخة في الجرد وأخرى في شاشة المشابهات — نمط «أداة تتطوّر في مكان دون آخر» seq 268).

   GMTStoreSync.removeFor(invId, storeUrl)   ⇐ يحذف من المتجر كلّ قائمة مربوطة بمنتج الجرد المحذوف
                                               (inv_id أو رابطه)، ويخرجه من خيارات المنتجات الأخرى.
   GMTStoreSync.mergeInto(fromInv, fromUrl, toInv, toUrl, toBarcode)
                                             ⇐ بعد دمج منتجين في الجرد: قائمة المحذوف تُدمج في قائمة الباقي
                                               (الصور تُجمع) ثمّ تُحذف؛ وإن لم يكن للباقي قائمة تنتقل قائمة المحذوف إليه.
   كلّ كتابة بشرط updated_at (حماية التزامن)، وما يُحذف يُسجَّل كاملاً في gmt_audit (قابل للاسترجاع). */
(function (global) {
  'use strict';
  if (global.GMTStoreSync) return;
  const sidOf = u => { const m = /#product=([^&]+)/.exec(String(u || '')); return m ? decodeURIComponent(m[1]) : ''; };
  function S() { return global.GMT_DB && GMT_DB.STORE; }
  function M() { return global.GMT_DB && GMT_DB.MAIN; }
  async function audit(row) {
    try {
      const d = M(); if (!d) return;
      await fetch(d.url + '/rest/v1/gmt_audit', { method: 'POST', headers: { apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify([Object.assign({ actor: (global.GMTRole && GMTRole.name && GMTRole.name()) || 'النظام', page: (location.pathname.split('/').pop() || ''), entity: 'store_product' }, row)]) });
    } catch (_) {}
  }
  /* يقرأ المتجر، يطبّق fn على القائمة، ويكتب بشرط التزامن (٣ محاولات) */
  async function edit(fn) {
    const s = S(); if (!s) throw new Error('لا مفاتيح المتجر');
    const H = { apikey: s.key, Authorization: 'Bearer ' + s.key };
    for (let i = 0; i < 3; i++) {
      const g = await fetch(s.url + '/rest/v1/gmt_store?id=eq.1&select=id,updated_at,products', { headers: H });
      if (!g.ok) throw new Error('قراءة المتجر HTTP ' + g.status);
      const rec = ((await g.json()) || [])[0]; if (!rec) return { changed: false };   /* لا سجلّ متجر ⇒ لا شيء يُزامَن */
      const prods = Array.isArray(rec.products) ? rec.products : [];
      const res = fn(prods.slice());
      if (!res || !res.changed) return res || { changed: false };
      let url = s.url + '/rest/v1/gmt_store?id=eq.1&select=id'; const body = { products: res.products };
      if ('updated_at' in rec) { url += rec.updated_at ? '&updated_at=eq.' + encodeURIComponent(rec.updated_at) : '&updated_at=is.null'; body.updated_at = new Date().toISOString(); }
      const w = await fetch(url, { method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=representation' }, H), body: JSON.stringify(body) });
      if (!w.ok) throw new Error('حفظ المتجر HTTP ' + w.status);
      const rows = await w.json().catch(() => null); if (Array.isArray(rows) && rows.length) return res;
    }
    throw new Error('المتجر يتغيّر من جهةٍ أخرى — أعد المحاولة');
  }
  const linked = (p, inv, sid) => (inv && String(p.inv_id || '') === String(inv)) || (sid && String(p.id) === String(sid));

  /* منتج جرد آخر ما زال رابطه على القائمة؟ (أُعيد إنشاؤه بعد الحذف) ⇒ تُنقل القائمة إليه بدل حذفها */
  async function otherOwner(sid, invId) {
    try {
      const d = M(); if (!d || !sid) return null;
      const r = await fetch(d.url + '/rest/v1/products?select=id&id=neq.' + encodeURIComponent(invId) + '&store_url=like.' + encodeURIComponent('*#product=' + sid), { headers: { apikey: d.key, Authorization: 'Bearer ' + d.key } });
      const j = r.ok ? await r.json() : []; return (Array.isArray(j) && j[0]) ? String(j[0].id) : null;
    } catch (_) { return null; }
  }
  async function removeFor(invId, storeUrl) {
    const sid = sidOf(storeUrl); let removed = [];
    const owner = await otherOwner(sid, invId);
    const res = await edit(prods => {
      if (owner) {   /* لا حذف: القائمة لمنتجٍ آخر الآن */
        const next = prods.map(p => linked(p, invId, sid) ? Object.assign({}, p, { inv_id: owner }) : p);
        return { changed: true, products: next };
      }
      removed = prods.filter(p => linked(p, invId, sid));
      let changed = removed.length > 0;
      const next = prods.filter(p => !linked(p, invId, sid)).map(p => {
        if (!Array.isArray(p.options)) return p;
        let touched = false;
        const opts = p.options.map(o => { const vals = (o.values || []).filter(v => String(v && v.inv_id || '') !== String(invId)); if (vals.length !== (o.values || []).length) touched = true; return Object.assign({}, o, { values: vals }); });
        if (touched) { changed = true; return Object.assign({}, p, { options: opts }); }
        return p;
      });
      return { changed, products: next };
    });
    for (const r of removed) await audit({ action: 'store_remove', entity_id: String(r.id), entity_name: r.name, old_value: JSON.stringify(r), reason: 'المالك seq 276: حُذف منتجه من الجرد ⇒ يُحذف من المتجر تلقائياً', meta: { inv_id: String(invId) } });
    return { removed: removed.length, changed: !!(res && res.changed) };
  }

  /* (المالك seq 291 «ليش مالهن كود») القائمة الباقية تحمل باركود منتج الجرد الباقي (toBarcode) — لا باركود المحذوف ولا فراغ */
  async function mergeInto(fromInv, fromUrl, toInv, toUrl, toBarcode) {
    const bcOf = () => (toBarcode ? { barcode: String(toBarcode) } : {});
    const fsid = sidOf(fromUrl), tsid = sidOf(toUrl); let removed = [], moved = false;
    const res = await edit(prods => {
      const src = prods.filter(p => linked(p, fromInv, fsid));
      const tgt = prods.find(p => linked(p, toInv, tsid) && !src.includes(p));
      let next = prods, changed = false;
      if (src.length && !tgt) {          /* للباقي لا قائمة ⇒ تنتقل الأولى إليه، والزائد يُدمج فيها */
        const keep = src[0]; removed = src.slice(1); moved = true; changed = true;
        const imgs = [...new Set([].concat(...src.map(p => p.images || [])))];
        next = prods.filter(p => !removed.includes(p)).map(p => p === keep ? Object.assign({}, p, { inv_id: String(toInv), images: imgs }, bcOf(p)) : p);
      } else if (src.length && tgt) {   /* للاثنين قائمة ⇒ صور المحذوف تُجمع في قائمة الباقي، وقائمته تُحذف */
        removed = src; changed = true;
        const imgs = [...new Set([].concat(tgt.images || [], ...src.map(p => p.images || [])))];
        const price = Number(tgt.price) > 0 ? tgt.price : (Math.max(0, ...src.map(p => Number(p.price) || 0)) || tgt.price);
        next = prods.filter(p => !src.includes(p)).map(p => p === tgt ? Object.assign({}, p, { images: imgs, price, inv_id: String(toInv) }, p.barcode ? {} : bcOf(p)) : p);
      }
      /* الخيارات المربوطة بالمحذوف تنتقل إلى الباقي */
      next = next.map(p => {
        if (!Array.isArray(p.options)) return p; let touched = false;
        const opts = p.options.map(o => Object.assign({}, o, { values: (o.values || []).map(v => { if (v && String(v.inv_id || '') === String(fromInv)) { touched = true; return Object.assign({}, v, { inv_id: String(toInv) }, bcOf(v)); } return v; }) }));
        if (touched) { changed = true; return Object.assign({}, p, { options: opts }); } return p;
      });
      return { changed, products: next, keepSid: moved && src[0] ? src[0].id : (tgt && tgt.id) };
    });
    for (const r of removed) await audit({ action: 'store_merge', entity_id: String(r.id), entity_name: r.name, old_value: JSON.stringify(r), reason: 'المالك seq 276: المنتجان دُمجا في الجرد ⇒ قائمة واحدة في المتجر', meta: { from: String(fromInv), into: String(toInv) } });
    return { removed: removed.length, moved, keepSid: res && res.keepSid };
  }

  /* ══ (TASK-0298 · المالك seq 315) «الفلاتر أو المجموعات مثل الفلاتر والأغطية والكفرات: إذا غيّرت فيهم ترتيب أو أضفت عليهم صورة
        تنضاف للكل حتى في الجرد ليس فقط في المتجر · الأغطية والفلاتر حسب الأقطار يختلف السعر — عوامل التصفية بتغيّر السعر لما يحدّد الشخص»
     العائلة = قائمة متجر بخيارات، كلّ قيمة منها مربوطة بمنتج جرد (inv_id): فلتر UV ⇐ 43 · 49 · 58mm … ══ */
  const famIds = sp => { const s = new Set(); (Array.isArray(sp && sp.options) ? sp.options : []).forEach(o => (Array.isArray(o && o.values) ? o.values : []).forEach(v => { if (v && v.inv_id) s.add(String(v.inv_id)); })); return [...s]; };
  const familyOf = (prods, invId) => (prods || []).find(sp => sp && String(sp.inv_id || '') !== String(invId) && famIds(sp).indexOf(String(invId)) !== -1) || null;
  /* صور منتجٍ من العائلة بعد تغيّر صور القائمة: المحذوف يُحذف · الجديد يُضاف · والترتيب ترتيب القائمة · وصوره الخاصّة (ليست في القائمة) تبقى بعدها */
  function imgsAfter(member, oldL, newL) {
    const oldS = new Set(oldL), newS = new Set(newL), own = (member || []).filter(u => !oldS.has(u) && !newS.has(u));
    return newL.filter(u => u).concat(own.filter(u => newL.indexOf(u) === -1));
  }
  const imgsOf = p => { const a = []; [p && p.image_url].concat(Array.isArray(p && p.images) ? p.images : []).forEach(u => { if (u && typeof u === 'string' && a.indexOf(u) === -1) a.push(u); }); return a; };
  /* صور قائمة العائلة تغيّرت (أدمن المتجر · عمود المتجر في صفحة التعديل) ⇒ منتجات الجرد في العائلة تأخذ التغيير — يُرجع عددها */
  async function listingImagesToInv(oldSp, newSp, opt) {
    opt = opt || {};
    const d = M(); if (!d || !newSp) return 0;
    const oldL = (Array.isArray(oldSp && oldSp.images) ? oldSp.images : []).filter(Boolean), newL = (Array.isArray(newSp.images) ? newSp.images : []).filter(Boolean);
    if (!newL.length || JSON.stringify(oldL) === JSON.stringify(newL)) return 0;
    const ids = famIds(newSp).filter(id => !opt.skip || String(id) !== String(opt.skip)); if (!ids.length) return 0;
    const H = { apikey: d.key, Authorization: 'Bearer ' + d.key };
    const r = await fetch(d.url + '/rest/v1/products?select=id,name,image_url,images&id=in.(' + ids.map(encodeURIComponent).join(',') + ')', { headers: H });
    const rows = r.ok ? await r.json() : []; let n = 0;
    for (const p of (Array.isArray(rows) ? rows : [])) {
      const cur = imgsOf(p), nx = imgsAfter(cur, oldL, newL);
      if (!nx.length || JSON.stringify(cur) === JSON.stringify(nx)) continue;
      const w = await fetch(d.url + '/rest/v1/products?id=eq.' + encodeURIComponent(p.id), { method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=representation' }, H), body: JSON.stringify({ image_url: nx[0], images: nx }) });
      const ok = w.ok && ((await w.json().catch(() => [])) || []).length;
      if (ok) { n++; if (typeof opt.onRow === 'function') try { opt.onRow(p.id, { image_url: nx[0], images: nx }); } catch (_) {} }
    }
    if (n) audit({ action: 'family_images', field: 'images', entity: 'products', entity_id: String(newSp.id), entity_name: newSp.name || '', new_value: String(n), reason: 'المالك seq 315: صور العائلة (ترتيب/إضافة/حذف) تصل لكل منتجاتها في الجرد' });
    return n;
  }
  /* سعر منتجٍ من العائلة ⇒ سعر قيمته في القائمة · الخيار يغيّر السعر عند الاختيار (affectsPrice) · سعر القائمة الظاهر = أقلّ سعرٍ موجب («يبدأ من») ·
     ومواصفاته (إن أُعطيت) تصير مواصفات قيمته لا مواصفات العائلة كلّها */
  async function setValueFields(invId, f) {
    f = f || {};
    return edit(prods => {
      const sp = familyOf(prods, invId); if (!sp) return { changed: false };
      let changed = false;
      const options = (sp.options || []).map(o => {
        const hit = (o.values || []).some(v => v && String(v.inv_id || '') === String(invId)); if (!hit) return o;
        const values = (o.values || []).map(v => {
          if (!v || String(v.inv_id || '') !== String(invId)) return v;
          const nv = Object.assign({}, v);
          if (f.price != null && Number(v.price || 0) !== Number(f.price)) { nv.price = Number(f.price) || 0; changed = true; }
          if (Array.isArray(f.specs) && f.specs.length && JSON.stringify(v.specs || []) !== JSON.stringify(f.specs)) { nv.specs = f.specs; changed = true; }
          if (f.compat && v.compat !== f.compat) { nv.compat = f.compat; changed = true; }
          return nv;
        });
        if (f.price != null && !o.affectsPrice) { changed = true; return Object.assign({}, o, { values, affectsPrice: true }); }
        return Object.assign({}, o, { values });
      });
      if (!changed) return { changed: false };
      const ps = []; options.forEach(o => { if (o.affectsPrice) (o.values || []).forEach(v => { const x = Number(v && v.price || 0); if (x > 0) ps.push(x); }); });
      const next = Object.assign({}, sp, { options }); if (f.price != null) next.price = ps.length ? Math.min.apply(null, ps) : 0;
      return { changed: true, sid: sp.id, products: prods.map(x => x === sp ? next : x) };
    });
  }

  /* ══ (TASK-0300 · المالك seq 322) «لازم يحمل له أثناء الانترو، يفتح له الواجهة فوراً … وفي الخلفية تنزل»
     نسخةٌ خفيفة من واجهة المتجر — ملفّ JSON في التخزين العامّ للقاعدة الرئيسية (products-images/store/home.json · يُضغط brotli ⇒ ~عُشر الكتالوج):
     بلا مواصفات/وصف/توافق/أسماء بديلة · أوّل ٣ صور · قيم الخيارات بلا مواصفات. تُعاد كتابتها بعد كلّ حفظٍ للمتجر من صفحات الموظّفين
     (اعتراض fetch هنا + نداءٌ صريح من أدمن المتجر) ومن المتجر نفسه لموظّفٍ يفتحه والنسخة قديمة. لا تغيير على أيّ قاعدة. ══ */
  const HOME_PATH = 'store/home.json';
  function homeUrl() { const d = M(); return d ? d.url + '/storage/v1/object/public/products-images/' + HOME_PATH : ''; }
  function homeBuild(rec) {
    const strip = (o, keys) => { const x = Object.assign({}, o); keys.forEach(k => delete x[k]); return x; };
    const products = (Array.isArray(rec && rec.products) ? rec.products : []).map(p => {
      const x = strip(p, ['specs', 'description', 'compat', 'alt_names', 'video_url', 'search_terms', 'images_hidden']);
      if (Array.isArray(p.images)) x.images = p.images.filter(u => !/^data:/i.test(String(u || ''))).slice(0, 3);   // صورةٌ مضمّنة (base64) لا تُضغط ⇒ تنتظر الكتالوج الكامل
      if (Array.isArray(p.options)) x.options = p.options.map(o => Array.isArray(o && o.values) ? Object.assign({}, o, { values: o.values.map(v => v && typeof v === 'object' ? strip(v, ['specs', 'compat']) : v) }) : o);
      return x;
    });
    return Object.assign(strip(rec || {}, ['products']), { products, __light: true, __src_updated_at: (rec && rec.updated_at) || null, __built_at: new Date().toISOString() });
  }
  async function homeUpload(rec) {
    const d = M(); if (!d || !rec || !Array.isArray(rec.products) || !rec.products.length) return false;
    const body = JSON.stringify(homeBuild(rec));
    const w = await fetch(d.url + '/storage/v1/object/products-images/' + HOME_PATH, { method: 'POST',
      headers: { apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json', 'x-upsert': 'true', 'cache-control': 'max-age=60' }, body });
    return w.ok;
  }
  let _homeT = null, _homeBusy = false;
  /* بعد حفظٍ للمتجر: يُقرأ السجلّ الطازج (بعد ٣ ث — حفظاتٌ متتالية تُجمع) وتُرفع النسخة الخفيفة */
  function homePublish(rec) {
    clearTimeout(_homeT);
    return new Promise(res => {
      _homeT = setTimeout(async () => {
        if (_homeBusy) { res(false); return; } _homeBusy = true;
        try {
          let r = rec;
          if (!r) { const s = S(); const g = await fetch(s.url + '/rest/v1/gmt_store?id=eq.1&select=*', { headers: { apikey: s.key, Authorization: 'Bearer ' + s.key } }); r = g.ok ? ((await g.json()) || [])[0] : null; }
          res(await homeUpload(r));
        } catch (_) { res(false); } finally { _homeBusy = false; }
      }, rec ? 0 : 3000);
    });
  }
  /* النسخة المنشورة أقدم من هذا السجلّ؟ ⇒ تُرفع (يستدعيه المتجر لموظّفٍ يفتحه) */
  async function homeRefreshIfStale(rec) {
    try {
      const g = await fetch(homeUrl(), { cache: 'no-store' });
      const cur = g.ok ? await g.json() : null;
      if (cur && cur.__src_updated_at && rec && cur.__src_updated_at === rec.updated_at) return false;
      return await homeUpload(rec);
    } catch (_) { return false; }
  }
  /* كلّ كتابةٍ ناجحة على سجلّ المتجر من هذه الصفحة (الجرد · المزامنة · صفحة التعديل · المواصفات) ⇒ نشرٌ مؤجَّل */
  try {
    if (global.fetch && !global.__gmtHomeHook) {
      global.__gmtHomeHook = true;
      const _f = global.fetch.bind(global);
      global.fetch = function (input, init) {
        const p = _f(input, init);
        try {
          const url = typeof input === 'string' ? input : (input && input.url) || '', m = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
          const s = S();
          if (s && (m === 'PATCH' || m === 'POST') && url.indexOf(s.url + '/rest/v1/gmt_store') === 0)
            p.then(r => { if (r && r.ok) homePublish(); }).catch(() => {});
        } catch (_) {}
        return p;
      };
    }
  } catch (_) {}

  global.GMTStoreSync = { removeFor, mergeInto, sidOf, famIds, familyOf, imgsAfter, listingImagesToInv, setValueFields, homeBuild, homeUrl, homePublish, homeRefreshIfStale };
})(window);
