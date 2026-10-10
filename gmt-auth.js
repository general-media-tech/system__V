/* ═══════════════════════════════════════════════════════════════════════════
   gmt-auth.js — مصدرٌ واحد لكل كلمات سرّ النظام
   ───────────────────────────────────────────────────────────────────────────
   طلب المالك (2026-09-27):
     «في الواجهة الرئيسية اعمل لي شيء… فيه كل كلمات السرّ بحسن بغيّرها **كلّها
      بدون استثناء**… مبدئياً كلمات السرّ السيادية وكلمة سرّ كل شيء خطّها 0000،
      بعدين أنا من هي الأداة بحسن بغيّرها».

   🔴 العطل الذي كشفه بناء هذه الوحدة — وهو أخطر ممّا طُلب إصلاحه:
      كان في النظام **مساران منفصلان** لكلمة السرّ السيادية:
        · `admin_sovereign.html` يحفظ `localStorage['gmt_pw_sovereign']`
        · و`inventory.html` و`purchase.html` و`gmt-staff.js` تقارن بـ
          `window.GMT_SOVEREIGN_PW || 'gmt-sovereign'`
      و`GMT_SOVEREIGN_PW` **لا يضبطها أي سطر في المشروع كلّه**.
      ⇒ فمن يغيّر كلمة السرّ من أداة السيادة يظنّ أنّه غيّرها، بينما فكّ ختم
        الجرد وفكّ ختم المشتريات يقبلان `gmt-sovereign` كما هي — وهي مكتوبة
        نصّاً في ملفّات منشورة على الإنترنت. أي أنّ أخطر الأزرار كان محروساً
        بكلمة يعرفها كل من فتح الشيفرة، **وتغييرها لا يفعل شيئاً**.
      هذه الوحدة تُلغي المسار الثاني: كل فحص يمرّ من هنا.

   أين تُحفَظ؟
     · **القاعدة** (`gmt_settings`) ⇒ تسري على كل الأجهزة. هي الافتراضي.
     · **الجهاز** (`localStorage`) ⇒ تسري على هذا الجهاز وحده، وتتقدّم على
       القاعدة. تبقى للتوافق مع ما هو محفوظ عندك الآن فلا ينكسر شيء اليوم.

   ⚠️ صراحةً في حدود الحماية — لأنّ الوهم أخطر من الضعف المعروف:
     هذه كلمات **واجهة** لا حراسة قاعدة. الصفحات تتّصل بمفتاح `anon` العام،
     ومن يفتح أدوات المطوّر يستطيع تجاوز أي فحص في المتصفّح. الحماية الحقيقية
     الوحيدة هي سياسات RLS في Supabase. فهذه تمنع الخطأ العابر وسوء الاستعمال
     اليومي — لا مهاجماً يعرف ما يفعل.
     ولذلك نحفظ **بصمة** (SHA-256 مع مِلح ثابت) لا النصّ الصريح حيثما أمكن:
     فمن يقرأ الجدول لا يقرأ كلمة السرّ جاهزة.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
    'use strict';

    var SALT = 'gmt::2026::auth';
    var CACHE_KEY = 'gmt_auth_cache_v1';
    var TTL = 5 * 60 * 1000;

    /* الأنواع المعروفة. `local` = مفتاح localStorage القديم (توافق)،
       `db` = مفتاح gmt_settings، `legacy` = ما كان مكتوباً في الشيفرة. */
    /* ═══════════════════════════════════════════════════════════════════════
       🔑 الكلمة الافتراضية — مصدرُ حقيقةٍ واحد (قرار المالك ت٤ · 2026-10-03)

       نصُّه: «أداة واحدة تحكم الكل — والقيمة قرارك» ثمّ «وخلّيها الكلمة **2003**».
       وقبله كان قد قال «مبدئياً كلمات السر… خطّها 0000»، وقال أيضاً «أدمن واحد
       … وكلمة المرور هي 2003». فحَسَم التضارب بنفسه: **2003**.

       ولماذا ثابتٌ واحد لا رقمٌ مكتوبٌ في كل موضع؟ لأنّ `0000` كانت مكتوبةً
       نصّاً في **ستّة** مواضع على الأقلّ (هذا الملفّ · أدمن الكفالات · الأدمن
       السيادي · gmt-staff · صفحة الأمان …)، فتغييرُها كان يعني تتبّعَ ستّة
       ملفّات ونسيانَ أحدها — ونسيانُ موضعٍ واحد في كلمة سرٍّ يعني بقاءَ بابٍ
       مفتوح. الآن الرقم في مكانٍ واحد، وكلُّ موضعٍ يقرؤه من `GMTAuth.DEFAULT`.

       ⚠️ و`0000` **لم تبقَ مقبولة**: لو أبقيتُها «للتوافق» لكان القرار بلا معنى —
       من يعرف 0000 يدخل كما كان. ومن ضبط كلمةً خاصّةً له (محلّياً أو في
       `gmt_settings`) فكلمتُه تعمل كما هي؛ المتغيّر هو **الافتراضيّ** وحده.
       ═══════════════════════════════════════════════════════════════════════ */
    var DEFAULT_PW = '2003';

    /* الأنواع المعروفة. `local` = مفتاح localStorage القديم (توافق)،
       `db` = مفتاح gmt_settings، `legacy` = الافتراضيّ حتى يضبطه المالك. */
    var KINDS = {
        /* ⚠️ `gmt-sovereign` أُزيلت من المقبول (2026-09-27): كانت مكتوبة نصّاً في
           ملفّات منشورة على الإنترنت ⇒ فكُّ الأختام مفتوحٌ لمن قرأ الشيفرة.
           و`0000` أُزيلت بدورها (2026-10-03 · ت٤) للسبب نفسه: صارت معروفة. */
        sovereign: { label: 'السيادية (فكّ الأختام · العمليات الخطرة)', local: 'gmt_pw_sovereign', db: 'pw_sovereign', legacy: [DEFAULT_PW] },
        store:     { label: 'إدارة المتجر الإلكتروني',                  local: 'gmt_pw_store',     db: 'pw_store',     legacy: [DEFAULT_PW] },
        warranty:  { label: 'إدارة الكفالات',                           local: 'gmt_pw_warranty',  db: 'pw_warranty',  legacy: [DEFAULT_PW] },
        pos:       { label: 'أدمن نقاط البيع',                          local: 'gmt_pw_pos',       db: 'admin_password', legacy: [DEFAULT_PW] },
        purchase:  { label: 'المشتريات — فكّ ختم فاتورة',               local: 'gmt_pw_purchase',  db: 'pw_purchase',  legacy: [DEFAULT_PW] },
        backup:    { label: 'النسخ الاحتياطي والاستعادة',               local: 'gmt_pw_backup',    db: 'pw_backup',    legacy: [DEFAULT_PW] }
    };

    var _mem = null;         // { key: value } من القاعدة
    var _loadedAt = 0;

    function db() {
        try {
            if (global.GMT_DB && global.GMT_DB.MAIN) return global.GMT_DB.MAIN;
        } catch (e) {}
        return null;
    }

    async function sha(text) {
        try {
            if (!global.crypto || !global.crypto.subtle) return null;
            var buf = new TextEncoder().encode(SALT + '|' + text);
            var h = await global.crypto.subtle.digest('SHA-256', buf);
            return Array.prototype.map.call(new Uint8Array(h), function (b) {
                return ('0' + b.toString(16)).slice(-2);
            }).join('');
        } catch (e) { return null; }
    }

    /* قراءة جدول الإعدادات — بصمت عند الفشل: صفحةٌ بلا شبكة يجب أن تبقى
       قابلة للاستعمال بكلمة الجهاز، لا أن تتعطّل. */
    async function load(force) {
        if (!force && _mem && (Date.now() - _loadedAt) < TTL) return _mem;
        try {
            var raw = localStorage.getItem(CACHE_KEY);
            if (!force && raw) {
                var c = JSON.parse(raw);
                if (c && (Date.now() - c.at) < TTL) { _mem = c.v; _loadedAt = c.at; return _mem; }
            }
        } catch (e) {}
        var d = db();
        if (!d) { _mem = _mem || {}; return _mem; }
        try {
            var r = await fetch(d.url + '/rest/v1/gmt_settings?select=key,value', {
                headers: { apikey: d.key, Authorization: 'Bearer ' + d.key }
            });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            var rows = await r.json();
            var map = {};
            (rows || []).forEach(function (x) { map[x.key] = x.value; });
            _mem = map; _loadedAt = Date.now();
            try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: _loadedAt, v: map })); } catch (e) {}
        } catch (e) {
            /* ⚠️ نُسجّل وقت المحاولة **حتى عند الفشل**. بلا ذلك يبقى _loadedAt
               صفراً فيُعاد النداء على الشبكة في كل فحص — ومع ستّ كلمات سرّ صار
               عرض الأداة يأخذ ثوانيَ بلا إنترنت، ويُغرق الصفحة بطلبات فاشلة.
               نُقصّر مهلة إعادة المحاولة إلى 20 ثانية بدل التعطيل الكامل. */
            _mem = _mem || {};
            _loadedAt = Date.now() - TTL + 20000;
        }
        return _mem;
    }

    /* هل يطابق ما كتبه المستخدم؟ نقبل ثلاث صيغ للتخزين:
         ① بصمة  sha256:<hex>      ② نصّ صريح (قديم)     ③ مفتاح الجهاز
       والقديمة (legacy) تبقى مقبولة **حتى تُضبط كلمة فعلية**، وإلّا انقلب
       النظام كلّه مقفولاً في وجه صاحبه لحظة نشر هذا الملفّ. */
    async function check(kind, input) {
        var k = KINDS[kind];
        if (!k) return false;
        var pw = String(input === null || input === undefined ? '' : input);

        var loc = null;
        try { loc = localStorage.getItem(k.local); } catch (e) {}
        if (loc) return pw === loc;

        var map = await load(false);
        var stored = map && map[k.db];
        if (stored) {
            if (String(stored).indexOf('sha256:') === 0) {
                var h = await sha(pw);
                return !!h && ('sha256:' + h) === String(stored);
            }
            return pw === String(stored);
        }
        /* لا شيء مضبوط ⇒ الافتراضية الواحدة (ت٤: 2003) */
        return (k.legacy || [DEFAULT_PW]).indexOf(pw) !== -1;
    }

    /* هل ما زالت الكلمة هي الافتراضية؟ — لتنبيهه في الأداة */
    async function isDefault(kind) {
        var k = KINDS[kind];
        if (!k) return false;
        try { if (localStorage.getItem(k.local)) return false; } catch (e) {}
        var map = await load(false);
        return !(map && map[k.db]);
    }

    async function setDb(kind, value) {
        var k = KINDS[kind];
        if (!k) throw new Error('نوع غير معروف: ' + kind);
        var d = db();
        if (!d) throw new Error('إعدادات القاعدة غير متاحة (gmt-core.js)');
        var h = await sha(value);
        var payload = [{ key: k.db, value: h ? ('sha256:' + h) : String(value) }];
        /* ⚠️ on_conflict في **المسار** لا في الترويسة: PostgREST يتجاهله بصمت
           في الترويسة فيفشل التعديل بـ409 ويبدو أنّه «لم يُحفَظ». */
        var r = await fetch(d.url + '/rest/v1/gmt_settings?on_conflict=key', {
            method: 'POST',
            headers: {
                apikey: d.key, Authorization: 'Bearer ' + d.key,
                'Content-Type': 'application/json',
                Prefer: 'resolution=merge-duplicates,return=minimal'
            },
            body: JSON.stringify(payload)
        });
        if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + (await r.text()).slice(0, 140));
        /* كلمةٌ على الجهاز تتقدّم على القاعدة، فلو بقيت قديمةً لظنّ أنّ الحفظ
           لم يُجدِ. نُزيلها كي تسري الجديدة فعلاً. */
        try { localStorage.removeItem(k.local); } catch (e) {}
        await load(true);
        return true;
    }

    function setLocal(kind, value) {
        var k = KINDS[kind];
        if (!k) return false;
        try {
            if (value) localStorage.setItem(k.local, value);
            else localStorage.removeItem(k.local);
            return true;
        } catch (e) { return false; }
    }

    /* نافذة سؤال موحّدة — كي لا تبقى كل صفحة تكتب prompt برسالتها الخاصّة */
    async function ask(kind, title) {
        var k = KINDS[kind] || { label: kind };
        /* 🎨 (2026-10-03 · طلبك ١٦١) كانت `prompt()` و`alert()` من المتصفّح —
           وهي **أكثرُ نافذةٍ يراها الموظّف يومياً** لأنّ كل عمليةٍ محميّة تمرّ
           بها. صارت نافذةَ النظام بحقل كلمة سرّ مُقنَّع (`type=password`)
           بدل نصٍّ مكشوفٍ أمام من يقف بجانب الكاشير. */
        var pw;
        if (global.GMTAsk) {
            pw = await global.GMTAsk.prompt(k.label, {
                title: title || '🔒 مطلوب كلمة السرّ',
                inputType: 'password', placeholder: '••••',
                icon: 'danger', okText: 'دخول'
            });
        } else {
            pw = global.prompt((title || '🔒 مطلوب كلمة السرّ') + '\n(' + k.label + ')');
        }
        if (pw === null) return false;
        var ok = await check(kind, pw);
        if (!ok) {
            if (global.GMTAsk) await global.GMTAsk.alert('كلمة السرّ غير صحيحة.', { title: '⛔ رُفض', icon: 'danger' });
            else { try { global.alert('⛔ كلمة سر غير صحيحة.'); } catch (e) {} }
        }
        return ok;
    }


    /* ═══════════════════════════════════════════════════════════════════════
       👤 حسابات الأدمن بأسماء (قرار المالك ١٠ ت١: «حسابات» — الحساب الحالي «محمد خير»)

       الجذر: «دخول الإدارة» كان كلمةً سرّيةً مشتركة (السيادية) ⇒ لا يُعرف من دخل، ولا يمكن أكثر من أدمن،
       ولا «تمّ بواسطة الأدمن الفلاني». ملاحظاتك (٨ ت١): «اسم المستخدم محمد خير وكلمة السر … فيدخل لصلاحيات
       إدارية، والباقي ينشئ حساباً ويخضع للمراجعة».

       التصميم (بلا SQL جديد):
         · الحسابات في `gmt_settings` بالمفتاح `admin_accounts` — مصفوفة JSON: {n الاسم · k اسمٌ مطبَّع ·
           s مِلح عشوائي لكل حساب · i عدد الدورات · h بصمة PBKDF2-SHA256}. لا نصَّ صريحاً ولا كلمة في الكود.
         · أوّل مرّة (لا حسابات): الكلمة **السيادية الحالية** تُنشئ أوّل حساب بالاسم الذي يكتبه صاحبها —
           لا نبذر كلمةً في الشيفرة المنشورة. وبعدها لا تفتح السيادية وضع الإدارة (تبقى لعمليات الأختام فقط).
         · الشبكة: إن تعذّرت قراءة الحسابات **لا** نُنشئ ولا نُدخل (الفشل مغلق) — خلاف «لا حسابات» الحقيقي.
         · الجلسة: `GMTRole.grant(name)` ⇒ sessionStorage؛ والاسم يُكتب على الفواتير/الإجراءات.

       ⚠️ صراحةً: هذه حمايةُ واجهة. الجدول مقروءٌ بالمفتاح العام، وكلمةٌ من ٤ أرقام تُكسَر بالتخمين في ثوانٍ
          مهما كانت الخوارزمية (١٠٠٠٠ احتمال فقط). كلمةٌ من ٨ أحرف+ تغيّر الحساب كلّياً. الحماية الحقيقية RLS.
       ═══════════════════════════════════════════════════════════════════════ */
    var ADMIN_KEY = 'admin_accounts';
    var ADMIN_ITERS = 120000;
    var FAIL_KEY = 'gmt_admin_fails';

    function normName(x) {
        return String(x == null ? '' : x).normalize('NFKC').replace(/[ً-ٟـ]/g, '')
            .replace(/\s+/g, '').toLowerCase();       /* بلا مسافات كلّها: نموذج الدخول العادي يحذفها من اسم المستخدم (cleanUser) فيجب أن يتطابقا */
    }
    function toHex(u8) { return Array.prototype.map.call(u8, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
    function fromHex(h) { var a = new Uint8Array(h.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
    async function pbkdf2(pw, saltHex, iters) {
        if (!global.crypto || !global.crypto.subtle) throw new Error('المتصفّح لا يدعم التشفير — افتح النظام عبر https');
        var key = await global.crypto.subtle.importKey('raw', new TextEncoder().encode(String(pw)), 'PBKDF2', false, ['deriveBits']);
        var bits = await global.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: iters }, key, 256);
        return toHex(new Uint8Array(bits));
    }
    async function makeAccount(name, pw, by) {
        var salt = toHex(global.crypto.getRandomValues(new Uint8Array(16)));
        return { n: String(name).trim(), k: normName(name), s: salt, i: ADMIN_ITERS, h: await pbkdf2(pw, salt, ADMIN_ITERS), at: new Date().toISOString(), by: by || '' };
    }
    /* ثابتُ الزمن قدر الإمكان */
    function same(a, b) { if (a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

    function restHeaders(d, extra) {
        return Object.assign({ apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json' }, extra || {});
    }
    /* قراءة طازجة (لا كاش): {list} أو يرمي عند تعذّر القراءة/فساد البيانات — لا نخلط «فشل» بـ«لا حسابات» */
    async function readAdmins() {
        var d = db(); if (!d) throw new Error('إعدادات القاعدة غير متاحة');
        var r = await fetch(d.url + '/rest/v1/gmt_settings?key=eq.' + ADMIN_KEY + '&select=value', { headers: restHeaders(d), cache: 'no-store' });
        if (!r.ok) throw new Error('تعذّر قراءة حسابات الإدارة (HTTP ' + r.status + ')');
        var rows = await r.json();
        if (!Array.isArray(rows) || !rows.length || rows[0].value == null || String(rows[0].value).trim() === '') return { list: [], raw: '' };
        var list;
        try { list = JSON.parse(rows[0].value); } catch (e) { throw new Error('بيانات حسابات الإدارة تالفة — لا أُكمل'); }
        if (!Array.isArray(list)) throw new Error('بيانات حسابات الإدارة تالفة — لا أُكمل');
        return { list: list, raw: String(rows[0].value) };
    }
    async function writeAdmins(list) {
        var d = db(); if (!d) throw new Error('إعدادات القاعدة غير متاحة');
        var v = JSON.stringify(list);
        var r = await fetch(d.url + '/rest/v1/gmt_settings?on_conflict=key', {
            method: 'POST', headers: restHeaders(d, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
            body: JSON.stringify([{ key: ADMIN_KEY, value: v }])
        });
        if (!r.ok) throw new Error('تعذّر حفظ الحسابات (HTTP ' + r.status + ')');
        var back = await readAdmins();                          /* لا نصدّق الكتابة قبل أن نقرأها */
        if (back.raw !== v) throw new Error('الحفظ لم يثبت في القاعدة — لم يتغيّر شيء');
        return true;
    }
    async function verify(acc, pw) {
        try { return same(await pbkdf2(pw, acc.s, acc.i || ADMIN_ITERS), String(acc.h)); } catch (e) { return false; }
    }

    /* تأخيرٌ تصاعديّ على التخمين — على الواجهة فقط (سقفٌ للاستعمال العاديّ لا للمهاجم) */
    function lockLeft() {
        try { var o = JSON.parse(sessionStorage.getItem(FAIL_KEY) || 'null'); if (o && o.until > Date.now()) return Math.ceil((o.until - Date.now()) / 1000); } catch (e) {}
        return 0;
    }
    function failed() {
        try {
            var o = JSON.parse(sessionStorage.getItem(FAIL_KEY) || 'null') || { n: 0, until: 0 };
            o.n++; if (o.n >= 4) o.until = Date.now() + Math.min(60000, 2000 * Math.pow(2, o.n - 4));
            sessionStorage.setItem(FAIL_KEY, JSON.stringify(o));
        } catch (e) {}
    }
    function okReset() { try { sessionStorage.removeItem(FAIL_KEY); } catch (e) {} }

    function badName(n) {
        n = String(n || '').trim();
        if (n.length < 2) return 'اكتب اسم المستخدم (حرفان على الأقل)';
        if (n.length > 40) return 'اسم المستخدم طويل (٤٠ حرفاً كحدّ أقصى)';
        return '';
    }

    /* حدثٌ في سجلّ العمليات (إن كانت الوحدة محمَّلة، وإلّا ننتظر جاهزيّتها) — لا يعطّل الدخول أبداً */
    function auditEvent(action, name, throttled) {
        var e = { action: action, entity: 'admin_accounts', entityName: name };
        if (action === 'admin_login' || (action === 'admin_add' && /أوّل حساب/.test(name))) e.actor = 'الأدمن ' + String(name).replace(/ \(أوّل حساب\)$/, '');
        function go() { try { if (throttled) global.GMTOpLog.logThrottled('adminfail', e, 30000); else global.GMTOpLog.log(e); } catch (x) {} }
        try {
            if (global.GMTOpLog) go();
            else global.addEventListener('gmt:oplog-ready', go, { once: true });
        } catch (x) {}
    }

    /* الدخول: bootstrap=true فقط من نافذة «دخول الإدارة» (لا من نموذج الدخول العادي) */
    async function adminCheck(name, pw, bootstrap) {
        var e0 = badName(name); if (e0) return { error: e0 };
        pw = String(pw == null ? '' : pw); if (!pw) return { error: 'اكتب كلمة السرّ' };
        var wait = lockLeft(); if (wait) return { error: 'محاولات كثيرة — انتظر ' + wait + ' ثانية ثمّ أعد المحاولة', field: 'pw' };
        var r;
        try { r = await readAdmins(); } catch (e) { return { error: (e && e.message) || 'تعذّر الاتصال بالقاعدة' }; }
        if (!r.list.length) {
            if (!bootstrap) return { ok: false, none: true };
            var okSov = false; try { okSov = await check('sovereign', pw); } catch (e) {}
            if (!okSov) { failed(); return { error: 'لا يوجد حساب أدمن بعد. أوّل حساب يُنشأ بكلمة السرّ السيادية الحالية — وهي غير صحيحة.', field: 'pw', clear: true }; }
            var first = await makeAccount(name, pw, 'أوّل حساب');
            try { await writeAdmins([first]); } catch (e) { return { error: (e && e.message) || 'تعذّر إنشاء الحساب' }; }
            okReset();
            auditEvent('admin_add', first.n + ' (أوّل حساب)');
            return { ok: true, name: first.n, created: true };
        }
        var k = normName(name), acc = null;
        for (var i = 0; i < r.list.length; i++) if (r.list[i] && r.list[i].k === k) { acc = r.list[i]; break; }
        if (!acc || !(await verify(acc, pw))) {
            failed();
            if (acc || bootstrap) auditEvent('admin_login_fail', name, true);
            return { ok: false, known: !!acc, error: 'اسم المستخدم أو كلمة السرّ غير صحيحة', field: 'pw', clear: true };
        }
        okReset();
        return { ok: true, name: acc.n };
    }

    /* نافذة «دخول الإدارة»: اسم + كلمة سرّ. تمنح الجلسة بنفسها وتُرجع الاسم أو null */
    async function adminLogin(whatFor) {
        var msg = (whatFor ? whatFor + ' — ' : '') + 'للأدمن فقط. اكتب اسم المستخدم وكلمة السرّ.';
        if (!global.GMTAsk || !global.GMTAsk.form) {
            var n = global.prompt(msg + '\n(اسم المستخدم)'); if (n === null) return null;
            var p = global.prompt('كلمة السرّ'); if (p === null) return null;
            var rr = await adminCheck(n, p, true);
            if (rr.ok) { try { global.GMTRole && global.GMTRole.grant(rr.name); } catch (e) {} return rr.name; }
            try { global.alert(rr.error || 'رُفض'); } catch (e) {}
            return null;
        }
        var last = '';
        try { last = localStorage.getItem('gmt_admin_last') || ''; } catch (e) {}
        var res = await global.GMTAsk.form(msg, {
            title: 'دخول الإدارة', icon: 'danger', okText: 'دخول',
            fields: [
                { k: 'name', label: 'اسم المستخدم', value: last, placeholder: 'اسمك كما سُجّل', autocomplete: 'username' },
                { k: 'pw', label: 'كلمة السرّ', type: 'password', placeholder: '••••', dir: 'ltr', autocomplete: 'current-password' }
            ],
            submit: async function (v) {
                var r = await adminCheck(v.name, v.pw, true);
                if (r.ok) return { result: r };
                return { error: r.error || 'رُفض', field: r.field || 'name', clear: r.clear };
            }
        });
        if (!res || !res.ok) return null;
        auditEvent('admin_login', res.name);
        try { localStorage.setItem('gmt_admin_last', res.name); } catch (e) {}
        try { if (global.GMTRole && global.GMTRole.grant) global.GMTRole.grant(res.name); else sessionStorage.setItem('gmt_admin_mode', '1'); } catch (e) {}
        if (res.created) {
            try {
                if (global.GMTAsk) global.GMTAsk.alert('أُنشئ حساب الأدمن «' + res.name + '». من الآن تدخل الإدارة باسمك وكلمة سرّك (من نموذج الدخول العادي أو «دخول الإدارة»).' +
                    '\n\nكلمة السرّ السيادية لم تعد تفتح وضع الإدارة — تبقى لفكّ الأختام وما شابه.', { title: 'تمّ', icon: 'info' });
            } catch (e) {}
        }
        return res.name;
    }

    async function listAdmins() { var r = await readAdmins(); return r.list.map(function (a) { return { name: a.n, at: a.at || '', by: a.by || '' }; }); }
    function needAdmin() {
        if (!global.GMTRole || !global.GMTRole.isAdmin || !global.GMTRole.isAdmin()) throw new Error('إدارة الحسابات للأدمن وحده — ادخل بحسابك أوّلاً');
    }
    function pwProblem(pw) {
        pw = String(pw || '');
        if (pw.length < 4) return 'كلمة السرّ قصيرة جداً (٤ أحرف على الأقلّ)';
        return '';
    }
    async function addAdmin(name, pw) {
        needAdmin();
        var e0 = badName(name) || pwProblem(pw); if (e0) throw new Error(e0);
        var r = await readAdmins(), k = normName(name);
        if (r.list.some(function (a) { return a.k === k; })) throw new Error('هذا الاسم موجود');
        var me = ''; try { me = global.GMTRole.name ? global.GMTRole.name() : ''; } catch (e) {}
        r.list.push(await makeAccount(name, pw, me));
        await writeAdmins(r.list); auditEvent('admin_add', String(name).trim()); return true;
    }
    async function setAdminPassword(name, pw) {
        needAdmin();
        var e0 = pwProblem(pw); if (e0) throw new Error(e0);
        var r = await readAdmins(), k = normName(name), acc = null;
        r.list.forEach(function (a) { if (a.k === k) acc = a; });
        if (!acc) throw new Error('الحساب غير موجود');
        var fresh = await makeAccount(acc.n, pw, acc.by);
        acc.s = fresh.s; acc.i = fresh.i; acc.h = fresh.h; acc.pw_at = new Date().toISOString();
        await writeAdmins(r.list); auditEvent('admin_pw', acc.n); return true;
    }
    async function removeAdmin(name) {
        needAdmin();
        var r = await readAdmins(), k = normName(name);
        if (!r.list.some(function (a) { return a.k === k; })) throw new Error('الحساب غير موجود');
        var me = ''; try { me = global.GMTRole.name ? global.GMTRole.name() : ''; } catch (e) {}
        if (normName(me) === k) throw new Error('لا تحذف حسابك أنت — اطلب من أدمنٍ آخر');
        if (r.list.length <= 1) throw new Error('هذا آخر حساب أدمن — لا يُحذف');
        var gone = ''; r.list.forEach(function (a) { if (a.k === k) gone = a.n; });
        await writeAdmins(r.list.filter(function (a) { return a.k !== k; })); auditEvent('admin_remove', gone); return true;
    }

    global.GMTAuth = {
        DEFAULT: DEFAULT_PW,          /* ⬅ تقرؤه كل صفحة بدل كتابة الرقم */
        KINDS: KINDS, check: check, ask: ask, isDefault: isDefault,
        setDb: setDb, setLocal: setLocal, load: load, sha: sha,
        admin: {
            login: adminLogin,                                   /* نافذة اسم+كلمة سرّ ⇒ الاسم أو null */
            tryLogin: function (name, pw) { return adminCheck(name, pw, false); },   /* من نموذج الدخول العادي: بلا إنشاء */
            list: listAdmins, add: addAdmin, setPassword: setAdminPassword, remove: removeAdmin,
            normalize: normName, _audit: auditEvent
        }
    };
}(typeof window !== 'undefined' ? window : this));
