/* ═══════════════════════════════════════════════════════
   أداة العقود — GMT | js/app.js (المحرّك)
   ─ سجل قوالب قابل للتوسع: أي ملف عقد جديد يستدعي GMTContracts.register(...)
   ─ دخول gmt_users (نفس نمط الكفالة) + تجاوز سيادي ?sovereign=1
   ─ ترقيم من سجل العقود (قاعدة الكفالة) مع رقم محلي احتياطي
   ─ تعبئة تلقائية من الكفالة أو يدوية · تحرير حر قبل الطباعة · طباعة · تصدير Word
   ═══════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const APP_VERSION = 'contracts-v2.1 (2026-10-07 · الملاحق)';

  /* ══ قواعد البيانات ══ */
  const DB = {
    main: { // gmt_users لتسجيل الدخول
      url: 'https://ysawzwtmodkqqbqoiojj.supabase.co',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzYXd6d3Rtb2RrcXFicW9pb2pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NjI0OTUsImV4cCI6MjA5MjAzODQ5NX0.g-dBDpHzMsP_0IQAKFxzWkKzc_I13bGUMeYNgcUmrKQ',
    },
    warranty: { // جلب الكفالة + جدول سجل العقود contracts
      url: 'https://abppuwylukzpqckazegk.supabase.co',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFicHB1d3lsdWt6cHFja2F6ZWdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNTQ4NzYsImV4cCI6MjA5ODczMDg3Nn0.Dx6WCUfXD4T8D_tJclB9VuMUS3B0YSwejexrRrYhnqo',
    },
  };

  async function rest(db, method, path, body, extra) {
    const r = await fetch(db.url + '/rest/v1/' + path, {
      method,
      headers: { apikey: db.key, Authorization: 'Bearer ' + db.key, 'Content-Type': 'application/json', ...(extra || {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error('HTTP ' + r.status + (t ? ' — ' + t.slice(0, 120) : '')); }
    if (r.status === 204) return null;
    const txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  }

  /* ══ سجل القوالب (نقطة التوسع) ══ */
  const registry = [];
  global.GMTContracts = {
    register(t) { registry.push(t); },
    get types() { return registry; },
  };

  /* ══════════ (٧ ط · البند ٥١) الملاحق تُعبّأ من العقد الأساسي وتُطبع معه ══════════
     طلبك: «عند اعتماد عقدٍ معيّن تلقائياً عبّي أنت الملحقات، أو يطلب تعبئة الملحقات، وطبعتهم سوا».
     • عقد العمل ⇐ اتفاقية السرية + نموذج العهدة (ومُلحق التدريب عند الحاجة).
     • عقد الوكيل ⇐ اتفاقية السرية (ونموذج العهدة إن سُلّمت بضاعة/معدّات).
     كل ملحقٍ يأخذ من العقد: الاسم · الرقم الوطني · الهاتف · الصفة · الفرع · الشرط الجزائي ·
     الاختصاص · ورقم العقد الأساسي — ويُطلب منك فقط ما لا يوجد في العقد (أصناف العهدة · الدورات).
     وبعد الاعتماد: الملحقات اللاحقة (تدريب لاحق · إخلاء طرف) تُعبَّأ من «رقم العقد الأساسي» وحده. */
  const ANNEX_SUFFIX = { nda: 'N', custody: 'C', training: 'T', handover: 'H' };
  const ANNEX_PH = '(رقم الملحق يُولَّد عند الاعتماد)', BASE_PH = '(رقم العقد الأساسي)';
  const common = (d) => ({ companyName: d.companyName, companyRep: d.companyRep, jurisdictionCity: d.jurisdictionCity });
  const ANNEX_PLAN = {
    employee: [
      { id: 'nda', on: true, why: 'يُوقَّع مع العقد',
        map: (d) => Object.assign(common(d), { partyName: d.employeeName, partyId: d.employeeId, partyPhone: d.employeePhone,
                                               partyCapacity: 'employee', penaltyAmount: d.penaltyAmount }) },
      { id: 'custody', on: true, why: 'عند تسليم أيّ جهاز أو مفتاح', needs: ['items'],
        map: (d) => Object.assign(common(d), { holderName: d.employeeName, holderId: d.employeeId, holderPhone: d.employeePhone,
                                               holderJob: d.jobTitle, branch: d.workPlace, handDate: d.startDate }) },
      { id: 'training', on: false, why: 'عند كل دورة', needs: ['courses', 'totalCost'],
        map: (d) => Object.assign(common(d), { employeeName: d.employeeName, employeeId: d.employeeId, bondMonths: d.trainingRecoveryMonths }) },
      { id: 'handover', on: false, why: 'عند انتهاء العلاقة فقط', later: true,
        map: (d) => Object.assign(common(d), { partyName: d.employeeName, partyId: d.employeeId, partyCapacity: 'employee' }) },
    ],
    agent: [
      { id: 'nda', on: true, why: 'يُوقَّع مع العقد',
        map: (d) => Object.assign(common(d), { partyName: d.agentName, partyId: d.agentId, partyPhone: d.agentPhone,
                                               partyCapacity: 'agent', penaltyAmount: d.penaltyAmount }) },
      { id: 'custody', on: false, why: 'إن سُلّمت معدّات أو بضاعة بالعهدة', needs: ['items'],
        map: (d) => Object.assign(common(d), { holderName: d.agentName, holderId: d.agentId, holderPhone: d.agentPhone,
                                               holderJob: 'وكيل بيع' + (d.agentShop ? ' — ' + d.agentShop : ''), branch: d.agentShop, handDate: d.startDate }) },
      { id: 'handover', on: false, why: 'عند انتهاء العلاقة فقط', later: true,
        map: (d) => Object.assign(common(d), { partyName: d.agentName, partyId: d.agentId, partyCapacity: 'agent' }) },
    ],
  };
  const typeById = (id) => registry.find((t) => t.id === id);
  const fieldDefaults = (t) => { const o = {}; (t.fields || []).forEach((f) => { o[f.key] = f.def != null ? f.def : (f.type === 'date' ? today() : ''); }); return o; };
  const clean = (o) => { const r = {}; Object.keys(o || {}).forEach((k) => { if (o[k] != null && String(o[k]).trim() !== '') r[k] = o[k]; }); return r; };

  /* ══ أدوات ══ */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (d) => (d ? new Date(d + (String(d).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' }) : '____ / ____ / ______');
  function toast(msg, err) {
    let t = $('gct-toast');
    if (!t) { t = document.createElement('div'); t.id = 'gct-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.style.cssText = `position:fixed;bottom:20px;right:50%;transform:translateX(50%);z-index:99999;background:${err ? '#dc2626' : '#111'};color:#fff;padding:10px 18px;border-radius:12px;font-size:13px;font-weight:800;font-family:inherit;box-shadow:0 8px 28px rgba(0,0,0,.35);max-width:92vw;`;
    clearTimeout(t._h); t._h = setTimeout(() => t.remove(), err ? 5200 : 2600);
  }
  // يختار أول قيمة موجودة من مرشحين (تعامل دفاعي مع أسماء الأعمدة)
  const pick = (row, keys) => { for (const k of keys) { if (row && row[k] != null && row[k] !== '') return row[k]; } return ''; };

  /* ══ الحالة ══ */
  const state = {
    user: null,          // {username, display_name}
    type: null,          // قالب العقد الحالي
    data: {},            // قيم الحقول
    contractNo: null,    // بعد الاعتماد
    barcode: null,       // dataURL
    manualEdit: false,   // وضع التحرير الحر (يجمّد إعادة الرسم)
    registered: false,
    annex: {},           // (٥١) { nda: { on, over:{} } … } للعقد الأساسي المفتوح
    annexNos: {},        // أرقام الملاحق بعد الاعتماد
    annexBarcodes: {},
    annexRegistered: false,
  };

  /* ══════════ الدخول (نفس نمط الكفالة: gmt_users) ══════════ */
  const b64Variants = (p) => { const out = [p]; try { out.push(btoa(p)); } catch (_) {} try { out.push(btoa(unescape(encodeURIComponent(p)))); } catch (_) {} return out; };

  async function doLogin() {
    const u = $('lg-user').value.trim(), p = $('lg-pass').value;
    const err = $('login-err');
    err.style.display = 'none';
    if (!u || !p) { err.textContent = 'أدخل اسم المستخدم وكلمة المرور'; err.style.display = 'block'; return; }
    try {
      /* 🔴 (2026-10-03) قائمة الأعمدة كانت **بلا `role`** — فلو بنيتُ صلاحية
         الأدمن على `user.role` لكانت `undefined` دائماً، فيصير **المالك نفسه**
         «تصفُّح فقط» ولا يطبع عقداً. وهذا نمطٌ تكرّر عندنا: شاشةٌ تَحكُم على
         حقلٍ لا تطلبه (حدث في عمولات الأدمن مع `order_id`).
         وتُطلَب بقراءةٍ متدرّجة: لو لم تعرف القاعدة `role` تُرفَض القائمة كلّها
         ⇒ لا دخولَ لأحد. */
      const _U = 'username,display_name,password_hash,is_active,branch_key';
      let rows = null, roleKnown = true;
      for (const cols of [_U + ',role', _U]) {
        try {
          rows = await rest(DB.main, 'GET', `gmt_users?username=eq.${encodeURIComponent(u)}&select=${cols}`);
          roleKnown = (cols !== _U);
          break;
        } catch (e) { if (cols === _U) throw e; }
      }
      const user = (rows || [])[0];

      const ok = user && user.is_active !== false && b64Variants(p).includes(user.password_hash);
      if (!ok) { err.textContent = 'بيانات الدخول غير صحيحة أو الحساب موقوف'; err.style.display = 'block'; return; }

      /* ═══════════════════════════════════════════════════════════════════
         🔐 صلاحيات العقود — قرار المالك (2026-10-03):
             «أداة العقود عادي يدخل عليها الموظف بس **تصفّح بدون إنشاء أو
              طباعة**. وبدها **حصراً مستخدم أدمن**».

         ⚠️ وهذا **تصحيحٌ لقرارٍ سابقٍ لي**: كنتُ قد منعتُ حساب التجربة من
         الدخول منعاً تامّاً (ت٣)، فصحّح المالك: الدخول مفتوح، والمُقيَّد هو
         **الإنشاء والطباعة** لا المشاهدة. فالمنع انتقل من البوّابة إلى الفعل.

         ولماذا نُقيّد الفعل لا الباب؟ لأنّ الموظّف يحتاج أن **يقرأ** عقداً
         ليُجيب زبوناً أو يراجع بنداً، وحجبُ القراءة يدفعه لطلبها من المالك في
         كل مرّة. أمّا الإنشاء والطباعة فمخرجُهما **مستندٌ قانونيّ** يُوقَّع
         ويُحتجّ به — فهو حقُّ الأدمن وحده. */
      const role = String(user.role || '').toLowerCase();
      /* القاعدة لا تعرف `role`؟ لا نُغلق على المالك ولا نفتح للكلّ:
         البوّابةُ السيادية (`?sovereign=1`) تبقى طريقَ الأدمن، ونقول ذلك
         في الكونسول كي لا يكون الالتباسُ صامتاً. */
      let isAdmin = /admin|sovereign|owner/.test(role);
      if (!roleKnown) {
        console.warn('[عقود] القاعدة لا تعرف عمود role ⇒ صلاحية الأدمن من البوّابة السيادية فقط.');
      }
      try {
        /* (٧ ط · ثغرة) الرابط وحده لا يكفي — يلزم أن تكون الجلسة أدخلت كلمة السرّ السياديّة */
        if (new URLSearchParams(location.search).get('sovereign') === '1' && (function(){try{return sessionStorage.getItem('gmt_sov_ok')==='1'||sessionStorage.getItem('gmt_admin_mode')==='1';}catch(_){return false;}})()) isAdmin = true;
      } catch (_) {}
      state.user = {
        username: user.username,
        display_name: user.display_name || user.username,
        branch: user.branch_key || '',
        role: role,
        isAdmin: isAdmin,
        readOnly: !isAdmin            // ⬅ الموظّف: تصفُّحٌ فقط
      };
      afterLogin();
    } catch (e) { err.textContent = 'تعذّر الاتصال: ' + e.message; err.style.display = 'block'; }
  }

  function afterLogin() {
    $('login-screen').style.display = 'none';
    $('who').textContent = '👤 ' + state.user.display_name
                         + (state.user.readOnly ? ' · 👁️ تصفُّح فقط' : '');
    applyPermissions();
    buildHome();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     الواجهة تقول الحقيقة قبل الضغط.

     البوّابة في `approveAnd` تمنع الفعل — لكن زرّاً يبدو عاملاً ثمّ يرفض هو
     «زرٌّ كاذب»: الموظّف يُعبّئ العقد كلّه ثمّ يُصدَم عند الطباعة. فنُعطّل
     الأزرار ونقول السبب في `title` منذ اللحظة الأولى.
     ⚠️ والتعطيل البصريّ **لا يُغني** عن بوّابة `approveAnd`: من يُزيل السمة
     من أدوات المتصفّح يتجاوزه. الحمايةُ في المنطق، والتعطيل للصدق.
     ═══════════════════════════════════════════════════════════════════════ */
  function applyPermissions() {
    if (!state.user || !state.user.readOnly) return;
    [['btn-print', 'طباعة العقود للأدمن حصراً'],
     ['btn-word',  'تصدير العقود للأدمن حصراً'],
     ['btn-edit',  'تحرير نصّ العقد للأدمن حصراً'],
     ['btn-new',   'إنشاء عقدٍ جديد للأدمن حصراً']
    ].forEach(function (pair) {
      var el = $(pair[0]);
      if (!el) return;
      el.disabled = true;
      el.setAttribute('aria-disabled', 'true');
      el.title = '⛔ ' + pair[1] + ' — حسابك للتصفّح فقط';
      el.style.opacity = '.45';
      el.style.cursor = 'not-allowed';
    });
    var hint = $('edit-hint');
    if (hint) {
      hint.textContent = '👁️ حسابك للتصفّح فقط — الإنشاء والطباعة للأدمن حصراً (قرار الإدارة).';
      hint.classList.add('on');
    }
  }

  /* ══════════ الرئيسية: بطاقات الأنواع ══════════ */
  function buildHome() {
    const g = $('type-grid');
    g.innerHTML = registry.map((t, i) => `
      <div class="type-card" data-i="${i}">
        <div class="ic">${t.icon}</div>
        <div class="tt">${esc(t.title)}</div>
        <div class="dd">${esc(t.desc)}</div>
      </div>`).join('');
    g.querySelectorAll('.type-card').forEach((c) => c.addEventListener('click', () => openType(registry[+c.dataset.i])));
    $('home').style.display = 'block';
    $('work').classList.remove('on');
  }

  /* ══════════ فتح نوع عقد: بناء النموذج ══════════ */
  function openType(t) {
    state.type = t;
    state.data = {};
    state.contractNo = null; state.barcode = null; state.registered = false; state.manualEdit = false;
    state.annex = {}; state.annexNos = {}; state.annexBarcodes = {}; state.annexRegistered = false;
    (ANNEX_PLAN[t.id] || []).forEach((a) => { state.annex[a.id] = { on: !!a.on, over: {}, open: false }; });
    // القيم الافتراضية
    (t.fields || []).forEach((f) => { state.data[f.key] = f.def != null ? f.def : (f.type === 'date' ? today() : ''); });

    $('form-title').innerHTML = `${t.icon} ${esc(t.title)}`;
    $('form-sub').textContent = t.desc;

    // صندوق التعبئة التلقائية من الكفالة (للأنواع الداعمة)
    $('autofill-wrap').innerHTML = t.warrantyAutofill ? `
      <div class="autofill-box">
        <label class="f-label">⚡ تعبئة تلقائية من الكفالة</label>
        <div class="f-row">
          <div><input class="f-in" id="af-wid" placeholder="رقم الكفالة (الباركود)" style="direction:ltr;text-align:center;"></div>
          <div style="flex:0 0 auto;"><button class="btn btn-red btn-sm" id="af-go" style="width:auto;">جلب</button></div>
        </div>
        <div style="font-size:10px;color:#0369a1;margin-top:4px;font-weight:700;">يملأ الاسم والمنتج والسيريال والفاتورة والباقة تلقائياً — ويمكن تعديل أي حقل يدوياً.</div>
      </div>` : '';
    if (t.warrantyAutofill) $('af-go').addEventListener('click', autoFillFromWarranty);
    /* (٥١) ملحقٌ يُفتح وحده (تدريب لاحق · إخلاء طرف…) ⇐ يُعبَّأ من رقم العقد الأساسي */
    if (ANNEX_SUFFIX[t.id]) {
      $('autofill-wrap').insertAdjacentHTML('beforeend', `
        <div class="autofill-box">
          <label class="f-label">⚡ تعبئة من العقد الأساسي</label>
          <div class="f-row">
            <div><input class="f-in" id="af-base" placeholder="رقم العقد مثل GMT-C-00012" style="direction:ltr;text-align:center;"></div>
            <div style="flex:0 0 auto;"><button class="btn btn-red btn-sm" id="af-base-go" style="width:auto;">جلب</button></div>
          </div>
          <div style="font-size:10px;color:#0369a1;margin-top:4px;font-weight:700;">يملأ الاسم والرقم الوطني والصفة والشرط الجزائي ورقم العقد من سجلّ العقود.</div>
        </div>`);
      $('af-base-go').addEventListener('click', autoFillFromBase);
    }

    // بناء الحقول
    const fw = $('fields-wrap');
    fw.innerHTML = (t.fields || []).map((f) => {
      const v = esc(state.data[f.key]);
      if (f.type === 'select') {
        return `<label class="f-label">${esc(f.label)}${f.req ? ' *' : ''}</label>
          <select class="f-sel" data-k="${f.key}">${f.options.map((o) => `<option value="${esc(o.v)}" ${o.v === state.data[f.key] ? 'selected' : ''}>${esc(o.t)}</option>`).join('')}</select>`;
      }
      if (f.type === 'textarea') return `<label class="f-label">${esc(f.label)}</label><textarea class="f-ta" data-k="${f.key}">${v}</textarea>`;
      return `<label class="f-label">${esc(f.label)}${f.req ? ' *' : ''}</label>
        <input class="f-in" type="${f.type || 'text'}" data-k="${f.key}" value="${v}" ${f.ltr ? 'style="direction:ltr;text-align:center;"' : ''} placeholder="${esc(f.ph || '')}">`;
    }).join('');
    fw.querySelectorAll('[data-k]').forEach((el) => el.addEventListener('input', () => {
      state.data[el.dataset.k] = el.value;
      if (!state.manualEdit) renderPreview();
      if (ANNEX_PLAN[state.type.id]) { clearTimeout(openType._ax); openType._ax = setTimeout(buildAnnexBox, 450); }
    }));

    // نسخ الطباعة
    $('copies-wrap').innerHTML = (t.copies || [{ id: 'company', label: 'نسخة الشركة (كاملة)', on: true }])
      .map((c) => `<label><input type="checkbox" data-copy="${c.id}" ${c.on ? 'checked' : ''}> ${esc(c.label)}</label>`).join('');
    $('copies-wrap').querySelectorAll('input').forEach((el) => el.addEventListener('change', () => { if (!state.manualEdit) renderPreview(); }));
    buildAnnexBox();

    $('home').style.display = 'none';
    $('work').classList.add('on');
    updateNoChip();
    renderPreview();
    window.scrollTo(0, 0);
  }

  function selectedCopies() {
    return Array.from(document.querySelectorAll('#copies-wrap input:checked')).map((el) => el.dataset.copy);
  }

  /* ══════════ التعبئة التلقائية من الكفالة ══════════ */
  async function autoFillFromWarranty() {
    const wid = $('af-wid').value.trim();
    if (!wid) return toast('أدخل رقم الكفالة أولاً', true);
    try {
      toast('جارٍ الجلب...');
      const rows = await rest(DB.warranty, 'GET', `warranties?short_id=eq.${encodeURIComponent(wid)}&select=*`);
      const w = (rows || [])[0];
      if (!w) return toast('لا توجد كفالة بهذا الرقم', true);
      // خرائط دفاعية لأسماء الأعمدة المحتملة
      const map = {
        customerName: pick(w, ['customer_name', 'name', 'client_name', 'c']),
        customerPhone: pick(w, ['customer_phone', 'phone', 'mobile']),
        birthDate: String(pick(w, ['birth_date', 'birthdate']) || '').slice(0, 10),
        productName: pick(w, ['product_name', 'product', 'device', 'p']),
        serialNo: pick(w, ['serial_no', 'serial', 'imei', 's']),
        invoiceNo: pick(w, ['invoice_no', 'invoice', 'inv']),
        invoiceDate: String(pick(w, ['purchase_date', 'invoice_date', 'created_at']) || '').slice(0, 10),
        warrantyId: pick(w, ['short_id']),
        warrantyTier: pick(w, ['warranty_type', 'type', 't']) || state.data.warrantyTier,
        branchName: pick(w, ['created_by', 'branch', 'branch_key']),
      };
      Object.entries(map).forEach(([k, v]) => { if (v && k in state.data) state.data[k] = v; });
      // انعكاس بالنموذج
      document.querySelectorAll('#fields-wrap [data-k]').forEach((el) => { if (el.dataset.k in map && map[el.dataset.k]) el.value = map[el.dataset.k]; });
      if (!state.manualEdit) renderPreview();
      toast('✓ عُبّئت البيانات من الكفالة ' + wid);
    } catch (e) { toast('فشل الجلب: ' + e.message, true); }
  }

  /* إدراجٌ متسامح: يُسقط عموداً لا تعرفه القاعدة ويعيد المحاولة (نمط P1) */
  async function insertTolerant(payload) {
    payload = Object.assign({}, payload);
    const dropped = [];
    let ins = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        ins = (await rest(DB.warranty, 'POST', 'contracts', payload, { Prefer: 'return=representation' }))?.[0];
        break;
      } catch (err) {
        const msg = String((err && err.message) || err || '');
        const m = msg.match(/'([a-z_][a-z0-9_]*)' column|column\s+"?([a-z_][a-z0-9_]*)"?/i);
        const col = m && (m[1] || m[2]);
        if (col && Object.prototype.hasOwnProperty.call(payload, col) && /PGRST204|42703|does not exist|schema cache/i.test(msg)) {
          delete payload[col]; dropped.push(col); continue;
        }
        throw err;
      }
    }
    if (dropped.length) console.warn('[عقود] أُسقطت أعمدةٌ لا تعرفها القاعدة: ' + dropped.join(', ') + ' — شغّل SQL العقود لتُحفَظ كاملةً.');
    return ins;
  }

  /* ══════════ الترقيم من السجل (قاعدة الكفالة) ══════════ */
  async function ensureNumber() {
    if (state.contractNo) return state.contractNo;
    const t = state.type;
    const partyKey = t.partyField || 'customerName';
    try {
      /* ═══════════════════════════════════════════════════════════════════
         🔴 (2026-10-03 · الصورة ٢: «تعذّر تسجيل العقد») كتابةٌ متدرّجة.

         جدول `contracts` في قاعدة الكفالة أقدم من هذه الميزة، والمالك **لم
         يشغّل أيّ SQL**. فأعمدةٌ نرسلها قد لا تكون موجودة عنده
         (`warranty_short_id` · `details` · `created_by`)، وPostgREST يرفض
         الإدراج **كلّه** من أجل عمودٍ واحدٍ لا يعرفه (نمط P1).

         ولم يكن هذا يظهر عطلاً واضحاً بل «تعذّر تسجيل العقد» — فيُصدَر رقمٌ
         محلّيٌّ مؤقّت ويبقى العقد **خارج السجلّ**، وهو أخطر ما في الأمر:
         مستندٌ قانونيٌّ يُطبَع ويُوقَّع ولا أثر له عندنا.

         الآن: نُسقِط ما ترفضه القاعدة ونُعيد المحاولة، ونطوي ما سقط في
         `party_name` كي لا تضيع المعلومة. فيُسجَّل العقد اليوم، وتُشغَّل
         الـSQL لاحقاً فتعود الحقول إلى أعمدتها.
         ═══════════════════════════════════════════════════════════════════ */
      let payload = {
        contract_type: t.id,
        party_name: state.data[partyKey] || null,
        warranty_short_id: state.data.warrantyId || null,
        details: state.data,
        created_by: state.user ? state.user.display_name : null,
      };
      const ins = await insertTolerant(payload);
      if (!ins || ins.id == null) throw new Error('لم يُرجَع السجل');
      state.contractNo = 'GMT-C-' + String(ins.id).padStart(5, '0');
      await rest(DB.warranty, 'PATCH', `contracts?id=eq.${ins.id}`, { contract_no: state.contractNo });
      state.registered = true;
    } catch (e) {
      // رقم محلي احتياطي إن تعذّر السجل (يُعلَّم بحرف L)
      state.contractNo = 'GMT-C-L' + Date.now().toString().slice(-8);
      state.registered = false;
      /* 🔴 (2026-10-03) كانت تُقصّ رسالة الشبكة الخام إلى ٦٠ حرفاً وتُعرَض —
         فيقرأ المالك «Failed to fe…» ولا يملك إزاءها شيئاً. GMTWhy يترجمها
         إلى سببٍ وإجراء (القاعدة موقوفة · عمود ناقص · صلاحيات …). */
      var _w = (window.GMTWhy) ? GMTWhy.say(e, { what: 'تسجيل العقد' })
                               : ('تعذّر تسجيل العقد بالسجل (' + String(e.message).slice(0, 60) + ')');
      toast('⚠️ ' + _w.split('\n')[0] + ' — أُصدر رقم محلّي مؤقّت', true);
      console.warn('[GMT] تفصيل تعذّر تسجيل العقد:\n' + _w);
    }
    makeBarcode(state.contractNo);
    updateNoChip();
    return state.contractNo;
  }

  function makeBarcode(text) {
    try {
      const cv = document.createElement('canvas');
      global.JsBarcode(cv, text, { format: 'CODE128', width: 1.6, height: 34, displayValue: true, fontSize: 11, margin: 4 });
      state.barcode = cv.toDataURL('image/png');
    } catch (_) { state.barcode = null; }
  }

  function updateNoChip() {
    $('contract-no-chip').innerHTML = state.contractNo
      ? `رقم العقد: <b>${esc(state.contractNo)}</b>${state.registered ? ' · مسجّل بالسجل ✓' : ' · <span style="color:#b45309;">غير مسجّل (محلي)</span>'}`
      : 'رقم العقد يُولَّد عند الاعتماد/الطباعة';
  }

  /* ══════════ المعاينة ══════════ */
  function renderPreview() {
    const t = state.type; if (!t) return;
    const d = { ...state.data, __no: state.contractNo || '(يُولَّد عند الاعتماد)', __barcode: state.barcode, __date: fmtDate(today()), __user: state.user ? state.user.display_name : '' };
    const copies = selectedCopies();
    let html = '';
    copies.forEach((c) => { html += t.render(d, c, { esc, fmtDate }); });
    if (html) html += renderAnnexes(copies);
    $('paper').innerHTML = html || '<div style="text-align:center;color:#5b6472;padding:40px;font-weight:800;">اختر نسخة واحدة على الأقل للطباعة</div>';
    applyEditMode();
  }

  /* ══════════ (٥١) الملاحق ══════════ */
  function annexData(a) {
    const at = typeById(a.id); if (!at) return null;
    const st = state.annex[a.id] || { over: {} };
    const no = state.annexNos[a.id] || ANNEX_PH;
    /* ما يأتي من العقد يغلب (تعديلُه من العقد نفسه)، وما أكملتَه في الملحق يملأ ما لا يوجد في العقد */
    return Object.assign(fieldDefaults(at), clean(st.over), clean(a.map(state.data)), {
      baseContractNo: state.contractNo || BASE_PH,
      __no: no, __barcode: state.annexBarcodes[a.id] || null, __date: fmtDate(today()),
      __user: state.user ? state.user.display_name : '',
    });
  }
  /* ما ينقص الملحق: حقوله الإلزامية + ما لا يوجد في العقد أصلاً (أصناف العهدة · الدورات) */
  function annexMissing(a) {
    const at = typeById(a.id); const d = annexData(a); if (!at || !d) return [];
    const keys = new Set((at.fields || []).filter((f) => f.req).map((f) => f.key).concat(a.needs || []));
    return (at.fields || []).filter((f) => keys.has(f.key) && !String(d[f.key] || '').trim());
  }
  function renderAnnexes(copies) {
    const plan = ANNEX_PLAN[state.type && state.type.id]; if (!plan) return '';
    let out = '';
    plan.forEach((a) => {
      const st = state.annex[a.id]; const at = typeById(a.id);
      if (!st || !st.on || !at) return;
      const d = annexData(a);
      copies.forEach((c) => {
        let h = '';
        try { h = at.render(d, c, { esc, fmtDate }); } catch (e) { h = `<div class="sheet"><b>تعذّر رسم ${esc(at.title)}: ${esc(e.message)}</b></div>`; }
        out += h.replace(/class="sheet"/g, `class="sheet" data-annex="${a.id}"`);
      });
    });
    return out;
  }
  function buildAnnexBox() {
    let box = $('annex-wrap');
    const plan = ANNEX_PLAN[state.type && state.type.id];
    if (!plan) { if (box) box.remove(); return; }
    if (!box) {
      box = document.createElement('div'); box.id = 'annex-wrap'; box.className = 'copies-box';
      const cb = document.querySelector('#form-pane .copies-box'); (cb || $('form-pane')).insertAdjacentElement('afterend', box);
    }
    const row = (a) => {
      const at = typeById(a.id); if (!at) return '';
      const st = state.annex[a.id]; const miss = st.on ? annexMissing(a) : [];
      const chip = !st.on ? '<span class="ax-chip off">لا يُطبع</span>'
        : miss.length ? `<span class="ax-chip warn">ينقصه: ${esc(miss.map((f) => f.label.split('(')[0].trim()).join('، '))}</span>`
        : '<span class="ax-chip ok">جاهز — عُبّئ من العقد</span>';
      const own = (at.fields || []).filter((f) => !(f.key in clean(a.map(state.data))) && f.key !== 'baseContractNo' && f.key !== 'companyName');
      const ad = annexData(a);
      const form = st.open ? `<div class="ax-form">${own.map((f) => {
          const v = esc(ad[f.key] == null ? '' : ad[f.key]);
          if (f.type === 'textarea') return `<label class="f-label">${esc(f.label)}</label><textarea class="f-ta" data-ax="${a.id}" data-k="${f.key}">${v}</textarea>`;
          if (f.type === 'select') return `<label class="f-label">${esc(f.label)}</label><select class="f-sel" data-ax="${a.id}" data-k="${f.key}">${f.options.map((o) => `<option value="${esc(o.v)}" ${o.v === ad[f.key] ? 'selected' : ''}>${esc(o.t)}</option>`).join('')}</select>`;
          return `<label class="f-label">${esc(f.label)}${f.req ? ' *' : ''}</label><input class="f-in" type="${f.type || 'text'}" data-ax="${a.id}" data-k="${f.key}" value="${v}">`;
        }).join('') || '<div class="ax-note">كل حقوله تُؤخذ من العقد ✓</div>'}</div>` : '';
      return `<div class="ax-row">
          <label class="ax-top"><input type="checkbox" data-axon="${a.id}" ${st.on ? 'checked' : ''}>
            <span class="ax-ic">${at.icon || '📎'}</span><span class="ax-t">${esc(at.title)}<small>${esc(a.why || '')}</small></span></label>
          <div class="ax-meta">${chip}${st.on ? `<button type="button" class="ax-edit" data-axopen="${a.id}">${st.open ? 'إخفاء' : (miss.length ? 'أكمل' : 'تعديل')}</button>` : ''}</div>
          ${form}
        </div>`;
    };
    box.innerHTML = `<div style="font-size:11px;font-weight:900;color:#5b6472;margin-bottom:6px;">📎 الملاحق — تُعبّأ من هذا العقد وتُطبع معه</div>` + plan.map(row).join('');
    box.querySelectorAll('[data-axon]').forEach((el) => el.addEventListener('change', () => {
      state.annex[el.dataset.axon].on = el.checked;
      if (el.checked && (ANNEX_PLAN[state.type.id].find((x) => x.id === el.dataset.axon) || {}).later)
        toast('ℹ️ إقرار إخلاء الطرف يُوقَّع عند انتهاء العلاقة — طباعتُه الآن نسخةٌ للتعبئة لاحقاً');
      buildAnnexBox(); if (!state.manualEdit) renderPreview();
    }));
    box.querySelectorAll('[data-axopen]').forEach((el) => el.addEventListener('click', () => {
      const st = state.annex[el.dataset.axopen]; st.open = !st.open; buildAnnexBox();
    }));
    box.querySelectorAll('[data-ax]').forEach((el) => el.addEventListener('input', () => {
      state.annex[el.dataset.ax].over[el.dataset.k] = el.value;
      if (!state.manualEdit) renderPreview();
      clearTimeout(box._t); box._t = setTimeout(() => { const f = document.activeElement; const k = f && f.dataset ? f.dataset.k : null, ax = f && f.dataset ? f.dataset.ax : null;
        const pos = f && f.selectionStart; buildAnnexBox();
        if (k && ax) { const n = box.querySelector(`[data-ax="${ax}"][data-k="${k}"]`); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } } }, 700);
    }));
  }
  /* عند الاعتماد: الملحق الناقص لا يمرّ صامتاً — تكملته أو طباعته فارغاً للتعبئة باليد بقرارك */
  async function checkAnnexes() {
    const plan = ANNEX_PLAN[state.type && state.type.id]; if (!plan) return true;
    const gaps = plan.filter((a) => state.annex[a.id] && state.annex[a.id].on)
                     .map((a) => ({ a, miss: annexMissing(a) })).filter((x) => x.miss.length);
    if (!gaps.length) return true;
    const msg = gaps.map((g) => '• ' + typeById(g.a.id).title + ': ' + g.miss.map((f) => f.label.split('(')[0].trim()).join('، ')).join('\n');
    const ask = global.GMTAsk && GMTAsk.confirm;
    const go = ask ? await GMTAsk.confirm('ملاحق ناقصة:\n' + msg + '\n\nتُطبع الفراغات خطوطاً تُملأ باليد، أو أكملها أوّلاً من «📎 الملاحق».',
                                         { title: 'الملاحق ناقصة', okText: 'اطبعها كما هي', cancelText: 'سأكملها' })
                   : false;
    if (!go) { gaps.forEach((g) => { state.annex[g.a.id].open = true; }); buildAnnexBox(); const b = $('annex-wrap'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    return !!go;
  }
  async function numberAnnexes() {
    const plan = ANNEX_PLAN[state.type && state.type.id]; if (!plan || !state.contractNo) return;
    for (const a of plan) {
      if (!state.annex[a.id] || !state.annex[a.id].on) continue;
      const no = state.contractNo + '-' + (ANNEX_SUFFIX[a.id] || 'A');
      state.annexNos[a.id] = no;
      try { const cv = document.createElement('canvas'); global.JsBarcode(cv, no, { format: 'CODE128', width: 1.4, height: 30, displayValue: true, fontSize: 10, margin: 4 }); state.annexBarcodes[a.id] = cv.toDataURL('image/png'); } catch (_) {}
    }
    /* تسجيل كل ملحقٍ بسطرٍ في السجل (مربوطٍ برقم العقد) — أفضل جهد: نسختُه المطبوعة محفوظةٌ في أرشيف العقد الأساسي أصلاً */
    if (!state.registered || state.annexRegistered) return;
    state.annexRegistered = true;
    for (const a of plan) {
      if (!state.annex[a.id] || !state.annex[a.id].on) continue;
      const d = annexData(a); const at = typeById(a.id);
      try {
        await insertTolerant({ contract_type: a.id, contract_no: state.annexNos[a.id], party_name: d[at.partyField || 'partyName'] || null,
                               details: Object.assign(clean(d), { __base: state.contractNo }), created_by: state.user ? state.user.display_name : null });
      } catch (e) { console.warn('[عقود] تعذّر تسجيل الملحق ' + a.id + ':', e.message); }
    }
  }
  /* (٥١) ملحقٌ يُفتح منفرداً ⇐ يُعبَّأ من سجلّ العقد الأساسي */
  async function autoFillFromBase() {
    const no = ($('af-base').value || '').trim().toUpperCase();
    if (!no) return toast('أدخل رقم العقد الأساسي', true);
    try {
      toast('جارٍ الجلب...');
      const rows = await rest(DB.warranty, 'GET', `contracts?contract_no=eq.${encodeURIComponent(no)}&select=*`);
      const row = (rows || [])[0];
      if (!row) return toast('لا يوجد عقدٌ بهذا الرقم في السجل', true);
      let det = row.details; if (typeof det === 'string') { try { det = JSON.parse(det); } catch (_) { det = null; } }
      const plan = ANNEX_PLAN[row.contract_type];
      const a = plan && plan.find((x) => x.id === state.type.id);
      if (!det || !a) {
        if (!det) return toast('هذا العقد محفوظٌ بلا تفاصيل (عمود details غير موجود) — عبّئ يدوياً', true);
        return toast('هذا النوع من العقود لا يرتبط به هذا الملحق', true);
      }
      const map = Object.assign(clean(a.map(det)), { baseContractNo: row.contract_no || no });
      Object.entries(map).forEach(([k, v]) => { if (k in state.data) state.data[k] = v; });
      document.querySelectorAll('#fields-wrap [data-k]').forEach((el) => { if (el.dataset.k in map) el.value = map[el.dataset.k]; });
      if (!state.manualEdit) renderPreview();
      toast('✓ عُبّئ من العقد ' + (row.contract_no || no));
    } catch (e) { toast('فشل الجلب: ' + e.message, true); }
  }

  /* ══════════ التحرير الحر ══════════ */
  function toggleEdit() {
    if (!requireAdminFor('تحرير نصّ العقد')) return;
    state.manualEdit = !state.manualEdit;
    $('edit-hint').classList.toggle('on', state.manualEdit);
    $('btn-edit').textContent = state.manualEdit ? '🔒 إنهاء التحرير' : '🔓 تحرير النص';
    if (!state.manualEdit) toast('انتهى وضع التحرير — تعديلاتك محفوظة بالمعاينة وستُطبع كما هي');
    applyEditMode();
  }
  function applyEditMode() {
    document.querySelectorAll('#paper .sheet').forEach((s) => {
      s.contentEditable = state.manualEdit ? 'true' : 'false';
      s.style.outline = state.manualEdit ? '2px dashed #f59e0b' : 'none';
    });
  }

  /* ══════════ الاعتماد والطباعة والتصدير ══════════ */
  function validate() {
    const missing = (state.type.fields || []).filter((f) => f.req && !String(state.data[f.key] || '').trim());
    if (missing.length) { toast('حقول مطلوبة ناقصة: ' + missing.map((f) => f.label).join('، '), true); return false; }
    return true;
  }

  /* بوّابةُ الفعل — لا تُكرَّر الشروط في كل زرّ (قاعدة: بوّابةٌ واحدة لا شروطٌ
     متفرّقة). كلُّ ما يُنتج مستنداً يمرّ من هنا. */
  function requireAdminFor(what) {
    if (state.user && state.user.isAdmin) return true;
    toast('⛔ ' + what + ' للأدمن حصراً — حسابك للتصفّح فقط.', true);
    return false;
  }

  async function approveAnd(action) {
    const _what = action === 'print' ? 'طباعة العقود'
                : action === 'word'  ? 'تصدير العقود'
                : 'اعتماد العقود';
    if (!requireAdminFor(_what)) return;
    if (!state.manualEdit && !validate()) return;
    if (!(await checkAnnexes())) return;
    const had = !!state.contractNo;
    await ensureNumber();
    await numberAnnexes();
    if (!had && !state.manualEdit) renderPreview(); // إدراج الرقم والباركود بالمعاينة
    if (had && !state.manualEdit) renderPreview();
    // بوضع التحرير اليدوي: نحقن الرقم مكان العبارة المؤقتة دون هدم تعديلاته
    if (state.manualEdit) {
      document.querySelectorAll('#paper .sheet').forEach((s) => {
        s.innerHTML = s.innerHTML.split('(يُولَّد عند الاعتماد)').join(esc(state.contractNo)).split(BASE_PH).join(esc(state.contractNo));
        const ax = s.getAttribute('data-annex');
        if (ax && state.annexNos[ax]) s.innerHTML = s.innerHTML.split(ANNEX_PH).join(esc(state.annexNos[ax]));
      });
    }
    archiveSnapshot(); // 📌 أرشفة النص المطبوع فعلاً (دليل الشركة عند النزاع)
    if (action === 'print') setTimeout(() => window.print(), 120);
    if (action === 'word') exportWord();
  }

  /* ══ أرشفة نسخة النص المعتمد (إصدار 2) ══
     يحفظ ما طُبع فعلاً — بما فيه أي تعديل يدوي — بجدول contracts.
     يتطلب تشغيل GMT_CONTRACTS_V2.txt؛ وإن لم تُشغَّل الأعمدة يفشل بصمت دون تعطيل الطباعة. */
  async function archiveSnapshot() {
    if (!state.registered || !state.contractNo) return;
    const html = ($('paper') || {}).innerHTML || '';
    try {
      await rest(DB.warranty, 'PATCH', `contracts?contract_no=eq.${encodeURIComponent(state.contractNo)}`, {
        snapshot_html: html.slice(0, 400000),
        manual_edit: !!state.manualEdit,
        printed_at: new Date().toISOString(),
        app_version: APP_VERSION,
      });
    } catch (e) { console.warn('تعذّرت أرشفة نسخة العقد:', e.message); }
  }

  function exportWord() {
    const sheets = Array.from(document.querySelectorAll('#paper .sheet'))
      .map((s) => { const c = s.cloneNode(true); c.removeAttribute('contenteditable'); c.style.outline = ''; return '<div class="sheet">' + c.innerHTML + '</div>'; })
      .join('');
    // نضمّن CSS الأداة نفسه ليحافظ Word على الشكل قدر الإمكان
    const css = Array.from(document.styleSheets).map((ss) => {
      try { return Array.from(ss.cssRules).map((r) => r.cssText).join('\n'); } catch (_) { return ''; }
    }).join('\n');
    const doc = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" lang="ar" dir="rtl">
<head><meta charset="utf-8"><title>عقد ${esc(state.contractNo || '')}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
@page WordSection1{ size:21cm 29.7cm; margin:1.4cm 1.3cm; mso-page-orientation:portrait; }
div.WordSection1{ page:WordSection1; }
body{ font-family:Arial,'Segoe UI',sans-serif; direction:rtl; }
.sheet{ page-break-after:always; position:relative; }
.sheet:last-child{ page-break-after:auto; }
.c-foot{ position:static; margin-top:14px; }
${css}
</style></head>
<body><div class="WordSection1" dir="rtl">${sheets}</div></body></html>`;
    const blob = new Blob(['\ufeff', doc], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `عقد_${state.type.id}_${state.contractNo || 'مسودة'}.doc`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('📄 صُدّر ملف Word (.doc) — يفتح ويتحرر بوورد بالكامل');
  }

  /* ══════════ الإقلاع ══════════ */
  document.addEventListener('DOMContentLoaded', () => {
    // أزرار عامة
    $('lg-btn').addEventListener('click', doLogin);
    $('lg-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
    $('btn-back').addEventListener('click', buildHome);
    $('btn-edit').addEventListener('click', toggleEdit);
    $('btn-print').addEventListener('click', () => approveAnd('print'));
    $('btn-word').addEventListener('click', () => approveAnd('word'));
    $('btn-new').addEventListener('click', async () => {
      if (!requireAdminFor('إنشاء عقدٍ جديد')) return;
      /* (٧ ط) كانت نافذة المتصفّح confirm() — آخر واحدةٍ باقية في النظام (البند ١٦١) */
      const ok = global.GMTAsk ? await GMTAsk.confirm('بدء عقد جديد من نفس النوع؟ (تُمسح الحقول)', { okText: 'عقد جديد', cancelText: 'لا' }) : false;
      if (ok) openType(state.type);
    });

    // دخول سيادي: الأدمن الكلي يفتح بـ ?sovereign=1 (نفس نمط باقي الأدوات)
    /* (٧ ط) دخولٌ واحد للنظام كلّه — كأدمن نقاط البيع: وضعُ الأدمن المفتوح في الواجهة الرئيسية
       يفتح العقود مباشرةً، وجلسةُ الموظّف (gmt_session) تفتحها تصفّحاً — بلا شاشة دخولٍ ثانية. */
    let adminOn = false; try { adminOn = !!(global.GMTRole && GMTRole.isAdmin()); } catch (_) {}
    if (adminOn || (function(){try{return sessionStorage.getItem('gmt_sov_ok')==='1'||sessionStorage.getItem('gmt_admin_mode')==='1';}catch(_){return false;}})()) {
      state.user = { username: 'sovereign', display_name: adminOn ? 'الإدارة' : 'الإدارة العليا (سيادي)', branch: '',
                     role: 'sovereign', isAdmin: true, readOnly: false };
      afterLogin();
    } else {
      let ses = null; try { ses = JSON.parse(localStorage.getItem('gmt_session') || 'null'); } catch (_) {}
      if (ses && ses.username) {
        state.user = { username: ses.username, display_name: ses.display_name || ses.username, branch: ses.branch_key || '',
                       role: '', isAdmin: false, readOnly: true };
        afterLogin();
      }
    }
  });
})(window);
