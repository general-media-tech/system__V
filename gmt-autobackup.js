/* ═══════════════════════════════════════════════════════════════════════════
   gmt-autobackup.js — نسخٌ احتياطيّ تلقائيّ على الجهاز (البند ١٤٩) · ٦ تشرين الأول ٢٠٢٦
   «نسخ احتياطي دوري + نسخة محلية لكل جهاز + استرجاع ذكي».
   • على أجهزة الإدارة فقط: مرّةً كل ٢٤ ساعة، وبعد ١٥ ثانية من فتح الصفحة (لا يبطئ الإقلاع)،
     تُنسخ الجداول المهمّة من القاعدة الرئيسيّة إلى IndexedDB على هذا الجهاز. تُحفظ آخر ٧ نسخ.
   • «النسخ الاحتياطي» تعرضها: تنزيل JSON · واسترجاع جدولٍ بعينه بنفس دمج الاستعادة الموجود
     (الموجود يُحدَّث والناقص يُضاف — لا حذف).
   • لا يكتب في القاعدة شيئاً بنفسه — قراءةٌ فقط.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var DBN = 'gmt_autobackup', ST = 'snaps', KEEP = 7, EVERY = 24 * 3600 * 1000, LS = 'gmt_autobk_last';
  var since = function (d) { return new Date(Date.now() - d * 864e5).toISOString(); };
  var TABLES = [
    ['products', ''], ['inv_columns', ''], ['gmt_customers', ''], ['gmt_settings', ''], ['gmt_offers', ''], ['gmt_coupons', ''],
    ['gmt_expenses', '&created_at=gte.' + since(180)], ['invoices', '&created_at=gte.' + since(90)],
    ['gmt_orders', '&created_at=gte.' + since(150)], ['branch_stock_transfers', '&created_at=gte.' + since(150)],
    ['branch_transfers', '&created_at=gte.' + since(120)]
  ];
  function isAdmin() { try { return !!(global.GMTRole && GMTRole.isAdmin()); } catch (_) { return false; } }
  function db() { var D = global.GMT_DB && global.GMT_DB.MAIN; return D && D.url && D.key ? D : null; }
  function idb() {
    return new Promise(function (res, rej) {
      if (!global.indexedDB) return rej(new Error('IndexedDB غير متاح'));
      var r = indexedDB.open(DBN, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST, { keyPath: 'id' }); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  function tx(mode, fn) { return idb().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction(ST, mode); var s = t.objectStore(ST); var out = fn(s); t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); }; t.onerror = function () { rej(t.error); }; }); }); }
  function list() { return idb().then(function (d) { return new Promise(function (res) { var r = d.transaction(ST).objectStore(ST).getAll(); r.onsuccess = function () { res((r.result || []).sort(function (a, b) { return a.id < b.id ? 1 : -1; })); }; r.onerror = function () { res([]); }; }); }); }
  async function fetchAll(D, t, q) {
    var out = [], from = 0, step = 1000;
    for (;;) {
      var r = await fetch(D.url + '/rest/v1/' + t + '?select=*' + q + '&limit=' + step + '&offset=' + from, { headers: { apikey: D.key, Authorization: 'Bearer ' + D.key } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var rows = await r.json(); out = out.concat(rows);
      if (rows.length < step || out.length > 60000) break; from += step;
    }
    return out;
  }
  async function snapshot(manual) {
    var D = db(); if (!D) throw new Error('إعدادات القاعدة غير محمّلة');
    var tables = {}, counts = {}, errs = [];
    for (var i = 0; i < TABLES.length; i++) {
      try { var rows = await fetchAll(D, TABLES[i][0], TABLES[i][1]); tables[TABLES[i][0]] = rows; counts[TABLES[i][0]] = rows.length; }
      catch (e) { errs.push(TABLES[i][0] + ': ' + (e && e.message)); }
    }
    var snap = { id: new Date().toISOString(), manual: !!manual, tables: tables, counts: counts, errors: errs, bytes: JSON.stringify(tables).length };
    await tx('readwrite', function (s) { return s.put(snap); });
    var all = await list();
    for (var k = KEEP; k < all.length; k++) await tx('readwrite', function (s) { return s.delete(all[k].id); });
    try { localStorage.setItem(LS, String(Date.now())); } catch (_) {}
    return snap;
  }
  function due() { try { return Date.now() - Number(localStorage.getItem(LS) || 0) > EVERY; } catch (_) { return true; } }
  function auto() {
    if (!isAdmin() || !due() || !db()) return;
    var run = function () { snapshot(false).then(function (s) { try { console.info('[GMT] نسخةٌ احتياطيّة تلقائيّة على هذا الجهاز:', s.counts); } catch (_) {} }).catch(function (e) { try { console.warn('[GMT] تعذّرت النسخة التلقائيّة:', e && e.message); } catch (_) {} }); };
    setTimeout(function () { (global.requestIdleCallback || setTimeout)(run, 2000); }, 15000);
  }
  global.GMTAutoBackup = { snapshot: snapshot, list: list, remove: function (id) { return tx('readwrite', function (s) { return s.delete(id); }); }, due: due };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})(window);
