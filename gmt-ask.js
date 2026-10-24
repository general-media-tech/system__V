/* ═══════════════════════════════════════════════════════════════════════════
   gmt-ask.js — نوافذ السؤال بهويّة النظام بدل نوافذ المتصفّح
   أُنشئ: 2026-10-03  ·  طلبك رقم ١٦١

   طلبُك: «منع `prompt()`/`confirm()` المتصفّح نهائياً».

   ما وجدتُه قبل أن أكتب سطراً: ٣٠٦ نداءً لـ`alert` و١٦٢ لـ`confirm` و١٠٢
   لـ`prompt` موزّعةً على ٢٠ ملفّاً. وهنا الحقيقة التي يجب أن تعرفها قبل أن
   أقول «نُفِّذ»، لأنّها تحدّ تقنيٌّ لا كسلٌ منّي:

     • `alert()` **قابلٌ للاستبدال كاملاً**: لا أحد يستعمل قيمته المُعادة.
       فأبدلتُه هنا على مستوى النظام كلّه — ٣٠٦ نافذة متصفّحٍ اختفت بسطرٍ
       واحد، بلا لمس أي موضعٍ من المواضع.

     • `confirm()` و`prompt()` **يوقفان الصفحة ويُعيدان قيمةً فوراً**:
           if (confirm('متأكّد؟')) { احذف(); }
       ولا توجد طريقةٌ في جافاسكربت تجعل نافذةً مصمَّمة «تُوقف» الكود هكذا.
       فلو أبدلتُهما بنافذةٍ جميلة لعادت القيمة `Promise` دائماً — وكل
       `if (confirm(...))` سيصير «نعم» دائماً ⇒ **الحذف يحدث بلا موافقة**.
       هذا عطلٌ أخطر بكثيرٍ من شكل النافذة. ولهذا لا أبدلهما تلقائياً.

   فالطريق الصحيح: هذا الملفّ يوفّر البديل المصمَّم بصيغة انتظار:
       if (await GMTAsk.confirm('متأكّد من الحذف؟')) …
       const v = await GMTAsk.prompt('أدخل الرابط:', { value: old });
   وتُهاجَر المواضع واحداً واحداً مع تحويل دالّتها إلى `async` — وهذا ما
   فعلتُه للمواضع التي تضايقك يومياً (رابط أداة الربط · اسم ملفّ المتجر ·
   إعدادات البوت). والباقي يُهاجَر على دفعاتٍ موثَّقة، لأنّ كل موضعٍ يحتاج
   قراءةَ دالّته كاملةً — لا استبدالاً أعمى.

   📜 القاعدة التي أُسجّلها من هذا: «بديلٌ يُغيّر معنى القيمة المُعادة ليس
      بديلاً — هو عطلٌ مؤجَّل». تطبيقٌ خاصّ لقاعدتك: «مابصير نضيف ميزة
      بتاثر عغير شي وانت ماتعرف».
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTAsk) return;

  var BRAND = '#D5001C';
  /* (١٠ ت١ ٢٠٢٦ — ملاحظات) بلاغُك: «نافذة إدخال رابط الوسيط تظهر خلف نافذة عقل النظام فأضطر لإغلاقها لأراها».
     الجذر: كانت 2147483000 بينما لوحة العقل 2147483400 والانترو 2147483600 ⇒ كل نافذة سؤال تُفتح من فوق
     هذه الطبقات تختفي تحتها. الآن فوقها كلّها (ودون العلامة المائية للطباعة 2147483647 التي لا تلتقط النقر). */
  var Z = 2147483640;          /* أعلى من كل نوافذ النظام بما فيها لوحة العقل والانترو */
  var styled = false;

  function injectStyle() {
    if (styled) return; styled = true;
    var css = [
      '.gmtask-ov{position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(2px);',
      'display:flex;align-items:center;justify-content:center;padding:20px;z-index:' + Z + ';',
      'opacity:0;transition:opacity .16s ease;font-family:Cairo,Tajawal,system-ui,sans-serif;}',
      '.gmtask-ov.in{opacity:1}',
      '.gmtask-bx{background:#fff;border-radius:18px;max-width:420px;width:100%;',
      'box-shadow:0 24px 60px rgba(2,6,23,.32);transform:translateY(10px) scale(.985);',
      'transition:transform .18s cubic-bezier(.2,.9,.3,1);overflow:hidden;direction:rtl;text-align:right}',
      '.gmtask-ov.in .gmtask-bx{transform:none}',
      '.gmtask-hd{padding:16px 20px 0;font-weight:800;font-size:16px;color:#0f172a;display:flex;gap:9px;align-items:center}',
      '.gmtask-ic{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex:0 0 auto}',
      '.gmtask-bd{padding:10px 20px 4px;font-size:14px;line-height:1.75;color:#334155;white-space:pre-wrap;word-break:break-word}',
      '.gmtask-in{margin:12px 20px 4px;width:calc(100% - 40px);box-sizing:border-box;padding:10px 12px;',
      'border:1.5px solid #e2e8f0;border-radius:11px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc}',
      '.gmtask-in:focus{border-color:' + BRAND + ';background:#fff}',
      '.gmtask-lb{margin:12px 20px -6px;font-size:12px;font-weight:800;color:#475569}',
      '.gmtask-er{margin:8px 20px 0;min-height:1.2em;font-size:12.5px;font-weight:700;color:#b91c1c;line-height:1.6}',
      '.gmtask-ft{display:flex;gap:9px;padding:16px 20px 18px;justify-content:flex-start}',
      '.gmtask-b{flex:1;padding:11px 14px;border:0;border-radius:11px;font-size:14px;font-weight:800;',
      'font-family:inherit;cursor:pointer;transition:filter .12s}',
      '.gmtask-b:hover{filter:brightness(.94)}',
      '.gmtask-b.pri{background:' + BRAND + ';color:#fff}',
      '.gmtask-b.sec{background:#f1f5f9;color:#475569}'
      /* (TASK-0143) أُزيلت قاعدة الوضع الداكن: كانت تجعل النوافذ داكنةً فوق صفحاتٍ فاتحة على هاتفٍ بالوضع الليليّ */
    ].join('');
    var st = document.createElement('style');
    st.id = 'gmtask-style'; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  var ICONS = {
    info:    { ch: 'ℹ', bg: '#eff6ff', fg: '#2563eb' },
    ask:     { ch: '؟', bg: '#fff7ed', fg: '#c2410c' },
    danger:  { ch: '!', bg: '#fef2f2', fg: BRAND },
    edit:    { ch: '✎', bg: '#f0fdf4', fg: '#15803d' }
  };

  /* المحرّك: يبني النافذة ويُرجع Promise بقيمةٍ تعتمد على النوع */
  function dialog(opts) {
    injectStyle();
    /* (١١ ت١ — ملاحظات · طلب الأصوات في كل مكان) كل نافذة سؤال تُعلن نفسها بصوت: تحذير للخطِر، خطأ لرسالة فشل، فقاعة لما سواها */
    try {
      if (global.GMTSound) {
        var _m = String(opts.message || '');
        GMTSound.play(opts.danger || opts.icon === 'danger' ? 'warn' : (opts.kind === 'alert' && /^\s*(⚠|❌|⛔|🔴)/.test(_m) ? 'error' : 'pop'));
      }
    } catch (_) {}
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.className = 'gmtask-ov';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');

      var ic = ICONS[opts.icon || 'info'] || ICONS.info;
      var bx = document.createElement('div');
      bx.className = 'gmtask-bx';

      var hd = document.createElement('div');
      hd.className = 'gmtask-hd';
      var icEl = document.createElement('span');
      icEl.className = 'gmtask-ic';
      icEl.style.background = ic.bg; icEl.style.color = ic.fg;
      icEl.textContent = ic.ch;
      var ttl = document.createElement('span');
      ttl.textContent = opts.title || '';
      hd.appendChild(icEl); hd.appendChild(ttl);

      var bd = document.createElement('div');
      bd.className = 'gmtask-bd';
      bd.textContent = String(opts.message == null ? '' : opts.message);

      var input = null;
      if (opts.kind === 'prompt') {
        input = document.createElement('input');
        input.className = 'gmtask-in';
        input.type = opts.inputType || 'text';
        input.value = opts.value == null ? '' : String(opts.value);
        if (opts.placeholder) input.placeholder = opts.placeholder;
        if (opts.dir) input.style.direction = opts.dir;
      }

      /* (١١ ت١) نموذج متعدّد الحقول — لدخول الأدمن (اسم + كلمة سرّ) وإضافة الحسابات.
         opts.submit(values) ⇒ {error:'..'} يُبقي النافذة مفتوحةً ويعرض الخطأ داخلها (كلمة سرّ خاطئة لا تُغلقها)،
         وأيّ شيء آخر يُغلقها ويُرجَع (result إن وُجدت وإلّا القيم). */
      var fields = null, errEl = null;
      if (opts.kind === 'form') {
        fields = [];
        (opts.fields || []).forEach(function (f) {
          var lb = document.createElement('div'); lb.className = 'gmtask-lb'; lb.textContent = f.label || '';
          var el = document.createElement('input'); el.className = 'gmtask-in'; el.type = f.type || 'text';
          el.value = f.value == null ? '' : String(f.value);
          if (f.placeholder) el.placeholder = f.placeholder;
          if (f.dir) el.style.direction = f.dir;
          if (f.autocomplete) el.setAttribute('autocomplete', f.autocomplete);
          fields.push({ k: f.k, el: el, lb: lb });
        });
        errEl = document.createElement('div'); errEl.className = 'gmtask-er'; errEl.setAttribute('aria-live', 'polite');
      }

      var ft = document.createElement('div');
      ft.className = 'gmtask-ft';

      var closed = false;
      function close(val) {
        if (closed) return; closed = true;
        ov.classList.remove('in');
        document.removeEventListener('keydown', onKey, true);
        setTimeout(function () { try { ov.remove(); } catch (_) {} }, 180);
        resolve(val);
      }

      var okBtn = document.createElement('button');
      okBtn.className = 'gmtask-b pri';
      okBtn.textContent = opts.okText || (opts.kind === 'alert' ? 'حسناً' : 'تأكيد');
      var formBusy = false;
      okBtn.onclick = function () {
        if (opts.kind === 'prompt') close(input.value);
        else if (opts.kind === 'confirm') close(true);
        else if (opts.kind === 'form') {
          if (formBusy) return;
          var vals = {}; fields.forEach(function (f) { vals[f.k] = f.el.value; });
          if (!opts.submit) { close(vals); return; }
          formBusy = true; okBtn.disabled = true; errEl.textContent = '';
          Promise.resolve().then(function () { return opts.submit(vals); }).catch(function (e) {
            return { error: (e && e.message) || 'تعذّر الإكمال' };
          }).then(function (r) {
            formBusy = false; okBtn.disabled = false;
            if (r && r.error) {
              errEl.textContent = r.error;
              try { if (global.GMTSound) GMTSound.play('error'); } catch (_) {}
              var bad = fields.filter(function (f) { return r.field ? f.k === r.field : true; })[0];
              try { if (bad) { bad.el.focus(); if (r.clear) bad.el.value = ''; } } catch (_) {}
              return;
            }
            close(r && r.result !== undefined ? r.result : vals);
          });
        }
        else close(undefined);
      };

      if (opts.kind === 'choose') {
        /* (٨ ت) اختيارٌ من عدّة — كل زرٍّ يُرجع مفتاحه، و«إلغاء»/Escape/النقر خارجاً ⇒ null (لا شيء يُنفَّذ) */
        (opts.choices || []).forEach(function (c) {
          var b = document.createElement('button');
          b.className = 'gmtask-b ' + (c.pri ? 'pri' : 'sec');
          b.textContent = c.t;
          b.onclick = function () { close(c.k); };
          ft.appendChild(b);
        });
        var cx = document.createElement('button');
        cx.className = 'gmtask-b sec';
        cx.textContent = opts.cancelText || 'إلغاء';
        cx.onclick = function () { close(null); };
        ft.appendChild(cx);
        ft.style.flexWrap = 'wrap';
        okBtn = ft.querySelector('.gmtask-b') || okBtn;
      } else if (opts.kind !== 'alert') {
        var noBtn = document.createElement('button');
        noBtn.className = 'gmtask-b sec';
        noBtn.textContent = opts.cancelText || 'إلغاء';
        noBtn.onclick = function () { close(opts.kind === 'confirm' ? false : null); };
        ft.appendChild(okBtn); ft.appendChild(noBtn);
      } else {
        ft.appendChild(okBtn);
      }

      function onKey(e) {
        if (e.key === 'Escape') {
          e.preventDefault(); e.stopPropagation();
          close(opts.kind === 'confirm' ? false : ((opts.kind === 'prompt' || opts.kind === 'choose' || opts.kind === 'form') ? null : undefined));
        } else if (e.key === 'Enter' && ((opts.kind !== 'prompt' && opts.kind !== 'form') || e.target === input || (fields && fields.some(function (f) { return f.el === e.target; })))) {
          e.preventDefault(); e.stopPropagation(); okBtn.click();
        }
      }
      document.addEventListener('keydown', onKey, true);

      /* النقر خارج الصندوق = إلغاء (ولا شيء خطِر يُنفَّذ بالخطأ) */
      ov.addEventListener('click', function (e) {
        if (e.target === ov) close(opts.kind === 'confirm' ? false : ((opts.kind === 'prompt' || opts.kind === 'choose' || opts.kind === 'form') ? null : undefined));
      });

      bx.appendChild(hd); bx.appendChild(bd);
      if (input) bx.appendChild(input);
      if (fields) { fields.forEach(function (f) { bx.appendChild(f.lb); bx.appendChild(f.el); }); bx.appendChild(errEl); }
      bx.appendChild(ft);
      ov.appendChild(bx);
      (document.body || document.documentElement).appendChild(ov);
      requestAnimationFrame(function () {
        ov.classList.add('in');
        try { var _f0 = input || (fields && fields[0] && fields[0].el) || okBtn; _f0.focus(); if (input) input.select(); } catch (_) {}
      });
    });
  }

  global.GMTAsk = {
    alert: function (message, opts) {
      opts = opts || {};
      return dialog({ kind: 'alert', message: message,
        title: opts.title || 'تنبيه', icon: opts.icon || 'info', okText: opts.okText });
    },
    confirm: function (message, opts) {
      opts = opts || {};
      return dialog({ kind: 'confirm', message: message,
        title: opts.title || 'تأكيد', icon: opts.icon || (opts.danger ? 'danger' : 'ask'),
        okText: opts.okText, cancelText: opts.cancelText });
    },
    /* GMTAsk.choose('سؤال', { choices: [{k:'a', t:'نصّ الزرّ', pri:1}, …] }) ⇒ k أو null */
    choose: function (message, opts) {
      opts = opts || {};
      return dialog({ kind: 'choose', message: message,
        title: opts.title || 'اختيار', icon: opts.icon || 'ask',
        choices: opts.choices || [], cancelText: opts.cancelText });
    },
    /* GMTAsk.form('رسالة', { title, icon, okText, fields:[{k,label,type,placeholder,value,dir}], submit(vals) }) ⇒ القيم/result أو null */
    form: function (message, opts) {
      opts = opts || {};
      return dialog({ kind: 'form', message: message,
        title: opts.title || 'إدخال', icon: opts.icon || 'edit',
        fields: opts.fields || [], submit: opts.submit,
        okText: opts.okText, cancelText: opts.cancelText });
    },
    prompt: function (message, opts) {
      opts = opts || {};
      return dialog({ kind: 'prompt', message: message,
        title: opts.title || 'إدخال', icon: opts.icon || 'edit',
        value: opts.value, placeholder: opts.placeholder,
        inputType: opts.inputType, dir: opts.dir,
        okText: opts.okText, cancelText: opts.cancelText });
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     استبدال `alert` على مستوى النظام — آمنٌ لأنّ قيمته المُعادة غير مستعملة.
     (و`confirm`/`prompt` لا يُستبدلان: الشرحُ في رأس الملفّ.)

     ⚠️ يبقى `window.alert` الأصلي محفوظاً في `window.__nativeAlert` كي
     يبقى بابٌ للخروج إن احتاجه فحصٌ أو حالةٌ طارئة.
     ═══════════════════════════════════════════════════════════════════════ */
  if (!global.__nativeAlert) {
    global.__nativeAlert = global.alert;
    global.alert = function (msg) {
      try { global.GMTAsk.alert(msg); }
      catch (e) { try { global.__nativeAlert(msg); } catch (_) {} }
      return undefined;
    };
    /* علامةٌ يقرؤها ملفّ الفحص للتأكّد أنّ الاستبدال حصل فعلاً */
    global.__gmtAlertReplaced = true;
  }
})(window);
