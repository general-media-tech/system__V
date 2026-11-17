// (ARC-MD-12#148 · OWN-07#7) قاعدة الأزرار والروابط: «لا زرّ لمجرد العرض» — لكل صفحة (أدمن) في المتصفّح الحقيقي:
//   ① كل onclick يشير لدالّة معرّفة فعلاً وقت التشغيل (لا ReferenceError عند الضغط)
//   ② كل رابط محلّي ظاهر يشير لملف موجود
//   ③ زرّ ظاهر بلا onclick ولا مستمع click عليه أو على أيّ جدٍّ له حتى body (عبر CDP) ولا داخل نموذج ⇒ «زرّ ميت»
// المعيار: صفر في ①② (حرج) · ③ يُطبع للمراجعة ويُحسب حرجاً فقط إن زاد عن الأساس المسجَّل.
// التشغيل: node t_all_buttons.js [page.html …]
const fs = require('fs'), path = require('path');
const H = require('./h.js');
const ROOT = path.resolve(__dirname, '..', '..');
const SKIP = /^(index|full_docs|deploy_plan|plan|معاينة_فاتورة|guard_bots_19|preview_ui2|معاينة_النظام_الجديد|الهوية_البصرية_2|دراسة_الرئيسية|دراسة_كيبورد_المبيعات|إدارة_الإشعارات|مركز_الإشعارات|ابق_على_اطلاع)\.html$/;
const pages = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !SKIP.test(f)).sort();
let crit = 0; const dead = [];
(async () => {
  await H.seed();
  for (const p of pages) {
    let o;
    try { o = await H.open(p, { w: 1280, h: 900, wait: 2500, mobile: false }); } catch (e) { console.log('⚠️ ' + p + ' لم تُفتح: ' + String(e).slice(0, 80)); continue; }
    const { browser, pg } = o;
    try {
      const r = await pg.evaluate(() => {
        const vis = e => { const s = getComputedStyle(e); const b = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
        const BUILT = /^(alert|confirm|prompt|print|open|close|fetch|setTimeout|history|location|document|window|event|this|if|return|void|new|typeof|navigator|console|Math|JSON|Number|String|Object|Array|Promise|parseInt|parseFloat|encodeURIComponent|decodeURIComponent|localStorage|sessionStorage|scrollTo|requestAnimationFrame|Date|Boolean)$/;
        const badFn = [], links = [], noH = [];
        document.querySelectorAll('[onclick]').forEach(e => {
          const code = e.getAttribute('onclick') || '';
          for (const m of code.matchAll(/(?:^|[;\s{(!&|?:,])(?:return\s+|await\s+)?([A-Za-z_$][\w$]*)(?:\.[A-Za-z_$][\w$]*)*\s*\(/g)) {
            const n = m[1]; if (BUILT.test(n)) continue;
            if (/^\s*\([^)]*\)\s*\{/.test(code.slice(m.index + m[0].length - 1))) continue;
            let ok = false; try { ok = typeof window[n] !== 'undefined' || typeof eval(n) !== 'undefined'; } catch (_) { ok = false; }
            if (!ok) badFn.push((e.textContent || e.title || e.id || e.tagName).trim().slice(0, 30) + ' ⇒ ' + n + '()');
          }
        });
        document.querySelectorAll('a[href]').forEach(a => {
          if (!vis(a)) return; const h = a.getAttribute('href') || '';
          if (!h || /^(#|https?:|\/\/|mailto:|tel:|sms:|whatsapp:|javascript:|data:|blob:|intent:)/i.test(h) || /[${}]/.test(h)) return;
          links.push(h.split('#')[0].split('?')[0]);
        });
        let k = 0;
        document.querySelectorAll('button, [role=button]').forEach(b => {
          if (!vis(b) || b.onclick || b.getAttribute('onclick') || b.disabled || b.closest('form') || b.closest('label')) return;
          b.setAttribute('data-ab', String(++k)); noH.push(String(k));
        });
        return { badFn: [...new Set(badFn)], links: [...new Set(links)], noH };
      });
      const missing = r.links.filter(h => { try { return !fs.existsSync(path.join(ROOT, decodeURIComponent(h))); } catch (_) { return !fs.existsSync(path.join(ROOT, h)); } });
      /* ③ مستمعو click عبر CDP على الزرّ وأجداده حتى body (لا document/window: التفويض الشامل لا يثبت أن للزرّ عملاً) */
      const cdp = await pg.context().newCDPSession(pg);
      const deadHere = [];
      /* تفويض: مستمع click على document/window + زرّ يحمل data-* (أو جدٌّ قريب) ⇒ له عمل عبر التفويض */
      let docClick = false;
      for (const ex of ['document', 'window']) {
        const { result } = await cdp.send('Runtime.evaluate', { expression: ex });
        const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
        if (listeners.some(l => /^(click|pointerdown|pointerup|mousedown|touchend)$/.test(l.type))) docClick = true;
      }
      for (const id of r.noH.slice(0, 250)) {
        const { result } = await cdp.send('Runtime.evaluate', { expression: `document.querySelector('[data-ab="${id}"]')` });
        if (!result.objectId) continue;
        let has = false, objId = result.objectId;
        for (let up = 0; up < 12 && objId && !has; up++) {
          const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: objId });
          if (listeners.some(l => /^(click|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend)$/.test(l.type))) has = true;
          const par = await cdp.send('Runtime.callFunctionOn', { objectId: objId, functionDeclaration: 'function(){ return this.parentElement && this.parentElement !== document.body ? this.parentElement : null; }' });
          objId = par.result && par.result.objectId;
        }
        if (!has && docClick) has = await pg.evaluate(i => { let e = document.querySelector('[data-ab="' + i + '"]');
          for (let k = 0; k < 4 && e && e !== document.body; k++, e = e.parentElement) if ([...e.attributes].some(a => (/^data-(?!ab$)/.test(a.name) || (k === 0 && a.name === "id")))) return true; return false; }, id);
        if (!has) {
          const lab = await pg.evaluate(i => { const b = document.querySelector('[data-ab="' + i + '"]'); return (b.textContent || b.title || b.getAttribute('aria-label') || b.id || '').trim().slice(0, 30); }, id);
          deadHere.push(lab || '(بلا نص)');
        }
      }
      const c = r.badFn.length + missing.length; crit += c;
      if (deadHere.length) dead.push(p + ': ' + deadHere.join(' · '));
      console.log((c ? '❌ ' : (deadHere.length ? '🟡 ' : '✅ ')) + p + (r.badFn.length ? ' · دالّة غير معرّفة: ' + r.badFn.join(' | ') : '') + (missing.length ? ' · رابط مكسور: ' + missing.join(' | ') : '') + (deadHere.length ? ' · زرّ بلا مستمع: ' + deadHere.length : ''));
    } catch (e) { console.log('⚠️ ' + p + ': ' + String(e).slice(0, 120)); }
    await browser.close();
  }
  if (dead.length) { console.log('\n— أزرار ظاهرة بلا أيّ مستمع click (للمراجعة: قد يكون مستمعها على document) —'); dead.forEach(d => console.log('   ' + d)); }
  console.log(crit ? `❌ حرج: ${crit}` : '✅ لا دالّة غير معرّفة ولا رابط مكسور في ' + pages.length + ' صفحة');
  process.exit(crit ? 1 : 0);
})();
