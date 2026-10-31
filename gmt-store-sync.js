/* gmt-store-sync.js — ما يتغيّر في الجرد يتغيّر في المتجر (TASK-0292 · المالك seq 276)
   «المنتجات اللي بحذفها أنا من الجرد خلاص تنحذف لحالها من المتجر …
    في منتجات دمجناها لساتهم يطلعوا في المتجر كمنتج مختلف وهذا غلط — الأشياء التي تتأثّر في الجرد تتأثّر في المتجر».
   مكانٌ واحد لهذا المنطق (لا نسخة في الجرد وأخرى في شاشة المشابهات — نمط «أداة تتطوّر في مكان دون آخر» seq 268).

   GMTStoreSync.removeFor(invId, storeUrl)   ⇐ يحذف من المتجر كلّ قائمة مربوطة بمنتج الجرد المحذوف
                                               (inv_id أو رابطه)، ويخرجه من خيارات المنتجات الأخرى.
   GMTStoreSync.mergeInto(fromInv, fromUrl, toInv, toUrl)
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

  async function removeFor(invId, storeUrl) {
    const sid = sidOf(storeUrl); let removed = [];
    const res = await edit(prods => {
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

  async function mergeInto(fromInv, fromUrl, toInv, toUrl) {
    const fsid = sidOf(fromUrl), tsid = sidOf(toUrl); let removed = [], moved = false;
    const res = await edit(prods => {
      const src = prods.filter(p => linked(p, fromInv, fsid));
      const tgt = prods.find(p => linked(p, toInv, tsid) && !src.includes(p));
      let next = prods, changed = false;
      if (src.length && !tgt) {          /* للباقي لا قائمة ⇒ تنتقل الأولى إليه، والزائد يُدمج فيها */
        const keep = src[0]; removed = src.slice(1); moved = true; changed = true;
        const imgs = [...new Set([].concat(...src.map(p => p.images || [])))];
        next = prods.filter(p => !removed.includes(p)).map(p => p === keep ? Object.assign({}, p, { inv_id: String(toInv), images: imgs }) : p);
      } else if (src.length && tgt) {   /* للاثنين قائمة ⇒ صور المحذوف تُجمع في قائمة الباقي، وقائمته تُحذف */
        removed = src; changed = true;
        const imgs = [...new Set([].concat(tgt.images || [], ...src.map(p => p.images || [])))];
        const price = Number(tgt.price) > 0 ? tgt.price : (Math.max(0, ...src.map(p => Number(p.price) || 0)) || tgt.price);
        next = prods.filter(p => !src.includes(p)).map(p => p === tgt ? Object.assign({}, p, { images: imgs, price, inv_id: String(toInv) }) : p);
      }
      /* الخيارات المربوطة بالمحذوف تنتقل إلى الباقي */
      next = next.map(p => {
        if (!Array.isArray(p.options)) return p; let touched = false;
        const opts = p.options.map(o => Object.assign({}, o, { values: (o.values || []).map(v => { if (v && String(v.inv_id || '') === String(fromInv)) { touched = true; return Object.assign({}, v, { inv_id: String(toInv) }); } return v; }) }));
        if (touched) { changed = true; return Object.assign({}, p, { options: opts }); } return p;
      });
      return { changed, products: next, keepSid: moved && src[0] ? src[0].id : (tgt && tgt.id) };
    });
    for (const r of removed) await audit({ action: 'store_merge', entity_id: String(r.id), entity_name: r.name, old_value: JSON.stringify(r), reason: 'المالك seq 276: المنتجان دُمجا في الجرد ⇒ قائمة واحدة في المتجر', meta: { from: String(fromInv), into: String(toInv) } });
    return { removed: removed.length, moved, keepSid: res && res.keepSid };
  }

  global.GMTStoreSync = { removeFor, mergeInto, sidOf };
})(window);
