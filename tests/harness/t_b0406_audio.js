// (TASK-B0406a · طابور الأصوات) واجهة GMTAudio: play/emit/fire/setVolume/mute/unmute/setProfile/toggleCategory + الأصوات الجديدة بنمط PREFIX_ACTION
// + الإلغاء المتبادل للنقرة العامّة · زمن التهدئة · التنويع العشوائي · التأثيرات البصرية · المعرض بفئاته
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
/* سياق صوتٍ وهميّ يُحصي المذبذبات (ويسجّل detune الأخير) */
const FAKE = `
(function(){
  window.__au = { osc: 0, det: [] };
  function P(){ return { value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){}, cancelScheduledValues(){} }; }
  function Node(){ return { connect(){ return this; }, disconnect(){} }; }
  function AC(){ this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = Node(); }
  AC.prototype.resume = function(){ return Promise.resolve(); };
  AC.prototype.createGain = function(){ const n = Node(); n.gain = P(); return n; };
  AC.prototype.createDynamicsCompressor = function(){ const n = Node(); n.threshold={value:0}; n.knee={value:0}; n.ratio={value:0}; n.attack={value:0}; n.release={value:0}; return n; };
  AC.prototype.createBiquadFilter = function(){ const n = Node(); n.frequency = P(); n.Q = {value:0}; n.type=''; return n; };
  AC.prototype.createOscillator = function(){ const n = Node(); n.frequency = P(); n.detune = {value:0}; n.type=''; n.start = function(){ window.__au.osc++; window.__au.det.push(n.detune.value); }; n.stop = function(){}; return n; };
  AC.prototype.createBuffer = function(c, len){ return { getChannelData(){ return new Float32Array(len); } }; };
  AC.prototype.createBufferSource = function(){ const n = Node(); n.start = function(){}; n.stop = function(){}; return n; };
  window.AudioContext = AC; window.webkitAudioContext = AC;
})();`;
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('home.html', { w: 390, h: 844, mobile: true, wait: 4500, init: FAKE + H.ADMIN_INIT + "try{localStorage.setItem('gmt_sound','on');if(!sessionStorage.getItem('__c')){sessionStorage.setItem('__c','1');['gmt_pro_vol','gmt_snd_profile','gmt_snd_cats','gmt_snd_keys_on','gmt_fx_prefs'].forEach(function(k){localStorage.removeItem(k)});}}catch(e){}" });
  await pg.mouse.click(5, 400); await pg.waitForTimeout(300);
  const ev = (f, ...a) => pg.evaluate(f, ...a);
  const osc = async () => { const n = await ev(() => { const v = window.__au.osc; window.__au.osc = 0; return v; }); return n; };
  await osc();

  /* ── الواجهة والأسماء ── */
  ok(await ev(() => GMTAudio === GMTSound && ['play', 'emit', 'setVolume', 'mute', 'unmute', 'setProfile', 'toggleCategory', 'fire', 'fx'].every(k => typeof GMTAudio[k] === 'function')), 'GMTAudio = GMTSound وفيه play/emit/setVolume/mute/unmute/setProfile/toggleCategory/fire/fx');
  const n = await ev(() => GMTSound.list.length);
  ok(n >= 95, 'عدد الأصوات بعد الإضافة: ' + n);
  ok(await ev(() => ['UI_TOGGLE_ON', 'UI_CHECK', 'FORM_INVALID', 'SEARCH_EMPTY', 'WARRANTY_EXPIRED', 'DEBT_PAID', 'CASH_MISMATCH', 'SEC_SUSPICIOUS', 'SYNC_FAIL', 'SYS_THEME'].every(k => GMTSound.list.includes(k))), 'مفاتيح PREFIX_ACTION الجديدة موجودة في list');
  ok(await ev(() => GMTSound.list.every(k => GMTSound.meta[k] && GMTSound.meta[k].cat)), 'لكلّ صوتٍ فئة ونوع (META)');

  /* ── الأسماء المستعارة ── */
  await osc(); await ev(() => GMTSound.play('POS_SALE_SUCCESS')); await pg.waitForTimeout(60);
  ok(await osc() === 3, 'POS_SALE_SUCCESS يعزف cash (٣ نغمات)');
  await pg.waitForTimeout(300); await ev(() => GMTSound.play('click')); await pg.waitForTimeout(60);
  ok(await osc() === 1, 'play("click") القديم ما زال يعمل');

  /* ── زمن التهدئة (OWN-09#47) ── */
  await pg.waitForTimeout(1700);
  await ev(() => { GMTSound.play('notify'); setTimeout(() => GMTSound.play('notify'), 200); }); await pg.waitForTimeout(500);
  ok(await osc() === 2, 'notify مرّتان خلال ثانية ⇒ تُسمع مرّة واحدة (نغمتاها)');
  await ev(() => { GMTSound.play('click'); setTimeout(() => GMTSound.play('click'), 90); }); await pg.waitForTimeout(250);
  ok(await osc() === 2, 'click بفاصل 90ms ⇒ مرّتان');

  /* ── التنويع العشوائي (OWN-09#40) ── */
  await ev(() => { window.__au.det = []; });
  for (let i = 0; i < 10; i++) { await ev(() => GMTSound.play('click')); await pg.waitForTimeout(75); }
  const dets = await ev(() => window.__au.det.slice());
  const mags = dets.map(Math.abs);
  ok(dets.length >= 8 && new Set(dets.map(d => Math.round(d))).size > 3 && mags.every(m => m >= 10 && m <= 40), 'تنويع click ±10..40 سنتاً: ' + dets.slice(0, 4).map(d => d.toFixed(0)).join(','));
  await ev(() => { window.__au.det = []; }); await pg.waitForTimeout(300); await ev(() => GMTSound.play('success')); await pg.waitForTimeout(60);
  ok((await ev(() => window.__au.det)).every(d => d === 0), 'success لا يتنوّع');

  /* ── مستوى الصوت (OWN-12#7) ── */
  await ev(() => GMTAudio.setVolume(.3));
  ok(await ev(() => localStorage.getItem('gmt_pro_vol')) === '0.3' && await ev(() => GMTAudio.getVolume()) === 0.3, 'setVolume(.3) يُحفظ في gmt_pro_vol');
  await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2500);
  ok(await ev(() => GMTAudio.getVolume()) === 0.3, 'المستوى باقٍ بعد إعادة التحميل');

  /* ── البروفايلات والفئات (OWN-09#50) ── */
  await pg.mouse.click(5, 400); await pg.waitForTimeout(300); await osc();
  await ev(() => GMTAudio.setProfile('silent')); await ev(() => GMTAudio.play('success')); await pg.waitForTimeout(80);
  ok(await osc() === 0, 'بروفايل silent ⇒ لا صوت');
  await ev(() => GMTAudio.setProfile('security')); await pg.waitForTimeout(300);
  await ev(() => GMTAudio.play('SEC_BAD_PASSWORD')); await pg.waitForTimeout(80); const sec = await osc();
  await ev(() => GMTAudio.play('success')); await pg.waitForTimeout(80); const non = await osc();
  ok(sec === 1 && non === 0, 'بروفايل «أمنية فقط» ⇒ SEC_* تُسمع وغيرها لا');
  await ev(() => GMTAudio.setProfile('full')); await ev(() => GMTAudio.toggleCategory('UI', false)); await pg.waitForTimeout(300);
  await ev(() => GMTAudio.play('click')); await pg.waitForTimeout(80); const ui = await osc();
  await ev(() => GMTAudio.play('cash')); await pg.waitForTimeout(80); const cash = await osc();
  ok(ui === 0 && cash === 3, 'toggleCategory("UI", false) ⇒ لا نقرات والبقية تعمل');
  await ev(() => GMTAudio.toggleCategory('UI', true));

  /* ── الأصوات المطفأة افتراضياً ── */
  await pg.waitForTimeout(300); await ev(() => GMTAudio.play('FORM_KEY')); await pg.waitForTimeout(80);
  ok(await osc() === 0, 'FORM_KEY مطفأ افتراضياً');
  await ev(() => GMTAudio.enableKey('FORM_KEY', true)); await ev(() => GMTAudio.play('FORM_KEY')); await pg.waitForTimeout(80);
  ok(await osc() === 1, 'enableKey("FORM_KEY") يفعّله');
  await ev(() => GMTAudio.enableKey('FORM_KEY', false));

  /* ── emit وجدول الربط (OWN-09#51) ── */
  await pg.waitForTimeout(300);
  ok(await ev(() => GMTAudio.emit('order.created')) && await ev(() => GMTSound.last()) === 'order', 'emit("order.created") ⇒ order (من GMT_EVENT_MAP)');
  await ev(() => { window.GMT_EVENT_MAP['custom.evt'] = { key: 'WARRANTY_EXTEND' }; });
  ok(await ev(() => GMTAudio.emit('custom.evt')) && await ev(() => GMTSound.last()) === 'WARRANTY_EXTEND', 'سطرٌ جديد في GMT_EVENT_MAP يعمل بلا لمس المحرّك');
  ok(await ev(() => GMTAudio.emit('no.such.event')) === false, 'حدثٌ مجهول ⇒ false بلا خطأ');
  ok(await ev(() => { const j = JSON.parse(GMTAudio.exportMap()); return j.events['order.created'] && j.sounds.length === GMTSound.list.length && j.alias.UI_CLICK === 'click'; }), 'exportMap يُخرج JSON بالأحداث والأصوات والأسماء المستعارة');

  /* ── التصنيف الجديد ── */
  ok(await ev(() => GMTSound.classify('⚠ عجز في الصندوق 5000') === 'CASH_MISMATCH' && GMTSound.classify('تم تسديد الدين') === 'DEBT_PAID' && GMTSound.classify('تطابق الصندوق') === 'CASH_MATCH' && GMTSound.classify('تم دمج العملاء') === 'CUST_MERGE' && GMTSound.classify('نسخة احتياطية جاهزة') === 'SYS_BACKUP_DONE' && GMTSound.classify('تعذّر تسديد الدين') === 'error'), 'classifyToast: عجز/تسديد/تطابق/دمج/نسخة احتياطية (والفشل يبقى error)');

  /* ── أحداث المزامنة والأخطاء والنماذج والحافظة ── */
  const fire = async (js) => { await pg.waitForTimeout(320); await pg.evaluate(js); await pg.waitForTimeout(80); return pg.evaluate(() => GMTSound.last()); };
  ok(await fire(() => dispatchEvent(new CustomEvent('gmt-sync-pending'))) === 'SYNC_PENDING', 'gmt-sync-pending ⇒ SYNC_PENDING');
  ok(await fire(() => dispatchEvent(new CustomEvent('gmt-sync-retry'))) === 'SYNC_RETRY', 'gmt-sync-retry ⇒ SYNC_RETRY');
  ok(await fire(() => dispatchEvent(new CustomEvent('gmt-sync-fail'))) === 'SYNC_FAIL', 'gmt-sync-fail ⇒ SYNC_FAIL');
  ok(await fire(() => dispatchEvent(new CustomEvent('gmt-sync-conflict'))) === 'SYNC_CONFLICT', 'gmt-sync-conflict ⇒ SYNC_CONFLICT');
  await ev(() => { window.__t = 0; });
  ok(await fire(() => { setTimeout(() => { throw new Error('x'); }, 0); }).then(async () => { await pg.waitForTimeout(100); return pg.evaluate(() => GMTSound.last()); }) === 'error', 'خطأ JS غير ملتقَط ⇒ صوت error');
  ok(await fire(() => dispatchEvent(new ClipboardEvent('paste', { bubbles: true }))) !== 'UI_PASTE' || true, 'paste على window لا يكسر');
  ok(await fire(() => document.body.dispatchEvent(new ClipboardEvent('paste', { bubbles: true }))) === 'UI_PASTE', 'paste ⇒ UI_PASTE');
  ok(await fire(() => document.body.dispatchEvent(new ClipboardEvent('cut', { bubbles: true }))) === 'UI_CUT', 'cut ⇒ UI_CUT');
  ok(await fire(() => document.body.dispatchEvent(new Event('dragstart', { bubbles: true }))) === 'UI_DRAG', 'dragstart ⇒ UI_DRAG');
  ok(await fire(() => document.body.dispatchEvent(new Event('drop', { bubbles: true }))) === 'UI_DROP', 'drop ⇒ UI_DROP');
  /* نموذجٌ بحقلٍ مطلوبٍ فارغ ⇒ invalid */
  await ev(() => { const f = document.createElement('form'); f.id = 'tf'; f.innerHTML = '<input id="ti" required><button id="tb" type="submit">x</button>'; f.style.cssText = 'position:fixed;top:60px;left:10px;z-index:99999;background:#fff'; document.body.appendChild(f); });
  await pg.waitForTimeout(320); await pg.click('#tb'); await pg.waitForTimeout(150);
  ok(await ev(() => GMTSound.last()) === 'FORM_INVALID', 'إرسال نموذجٍ بحقلٍ مطلوبٍ فارغ ⇒ FORM_INVALID');
  await ev(() => { document.getElementById('ti').value = 'a'; document.getElementById('tf').addEventListener('submit', e => e.preventDefault()); });
  await pg.waitForTimeout(320); await pg.click('#tb'); await pg.waitForTimeout(150);
  ok(await ev(() => GMTSound.last()) === 'FORM_SUBMIT_OK', 'إرسال نموذجٍ سليم ⇒ FORM_SUBMIT_OK');
  await ev(() => { const i = document.getElementById('ti'); i.value = ''; i.focus(); });
  await pg.waitForTimeout(320); await pg.keyboard.press('Enter'); await pg.waitForTimeout(120);
  ok(await ev(() => GMTSound.last()) === 'FORM_ENTER', 'Enter داخل حقل ⇒ FORM_ENTER');
  await pg.waitForTimeout(320); await osc(); await pg.keyboard.type('ab'); await pg.waitForTimeout(100);
  ok(await osc() === 0, 'الكتابة لا تُصدر صوتاً افتراضياً');
  await ev(() => { document.getElementById('tf').remove(); });

  /* ── النقر: مربّع اختيار · تبويب · data-sound ── */
  await ev(() => { const d = document.createElement('div'); d.id = 'td'; d.style.cssText = 'position:fixed;top:100px;left:10px;z-index:99999;background:#fff;padding:6px'; d.innerHTML = '<input type="checkbox" id="tc"><button role="tab" id="tt">t</button><button id="ts" data-sound="DEBT_PAID">s</button><button id="tn" data-sound="none">n</button><button id="tg">g</button>'; document.body.appendChild(d); });
  for (const [id, want] of [['tc', 'UI_CHECK'], ['tt', 'UI_TAB'], ['ts', 'DEBT_PAID'], ['tg', 'click']]) {
    await pg.waitForTimeout(320); await pg.click('#' + id); await pg.waitForTimeout(120);
    ok(await ev(() => GMTSound.last()) === want, 'نقر #' + id + ' ⇒ ' + want);
  }
  await pg.waitForTimeout(320); await ev(() => { window.__au.osc = 0; }); await pg.click('#tn'); await pg.waitForTimeout(150);
  ok(await osc() === 0, 'data-sound="none" ⇒ صمت');
  /* إلغاء النقرة العامّة إن طُلب صوتٌ محدّد في الحدث نفسه (OWN-12#29) */
  await pg.waitForTimeout(320); await ev(() => { document.getElementById('tg').onclick = () => GMTSound.play('success'); window.__au.osc = 0; });
  await pg.click('#tg'); await pg.waitForTimeout(200);
  ok(await osc() === 2, 'زرّ «حفظ» ⇒ success (نغمتان) بلا click قبله');

  /* ── التأثيرات البصرية (OWN-09#44) ── */
  await pg.waitForTimeout(320);
  const fxr = await ev(() => { const b = document.getElementById('tg'); const r = GMTSound.fx('shake', b); return { r, has: b.classList.contains('gfx-shake'), css: !!document.getElementById('gmt-fx-css') }; });
  ok(fxr.r && fxr.has && fxr.css, 'fx("shake", زرّ) يضيف الصنف ويحقن CSS');
  await pg.waitForTimeout(1500);
  ok(await ev(() => !document.getElementById('tg').classList.contains('gfx-shake')), 'الصنف يزول بعد الانتهاء');
  await ev(() => GMTAudio.setFx(false));
  ok(await ev(() => GMTSound.fx('pop', document.getElementById('tg'))) === false, 'setFx(false) ⇒ لا تأثير');
  await ev(() => GMTAudio.setFx(true));
  ok(await ev(() => { let n = 0; Object.defineProperty(navigator, 'vibrate', { value: () => { n++; return true; }, configurable: true }); GMTSound.buzz('error'); GMTAudio.setHaptics(false); GMTSound.buzz('error'); GMTAudio.setHaptics(true); return n === 1; }), 'buzz يهتزّ مرّةً ويحترم setHaptics(false)');
  await pg.waitForTimeout(320);
  ok(await ev(() => { GMTAudio.fire('error', { target: document.getElementById('tg'), force: true }); return document.getElementById('tg').classList.contains('gfx-shake'); }), 'fire("error") ⇒ صوت + اهتزاز + shake على العنصر');

  /* ── المعرض ── */
  await ev(() => { document.getElementById('td').remove(); GMTSound.gallery(); }); await pg.waitForSelector('#gmt-snd-gal');
  const g = await ev(() => { const o = document.getElementById('gmt-snd-gal'); const c = o.querySelector('.g-card'); return { cards: o.querySelectorAll('.g-card').length, heads: o.querySelectorAll('h4').length, chips: o.querySelectorAll('[data-snd-cat]').length, badge: !!c.querySelector('.g-badge'), code: !!c.querySelector('code'), fxb: o.querySelectorAll('[data-snd-fx]').length, vol: o.querySelector('[data-snd-vol]').value, fit: o.querySelector('.g-win').getBoundingClientRect().width <= innerWidth }; });
  ok(g.cards >= 95 && g.heads >= 8 && g.chips === g.heads + 1 && g.badge && g.code && g.fxb === g.cards, 'المعرض: ' + g.cards + ' بطاقة تحت ' + g.heads + ' فئات · شارة نوع · مفتاح · «جرّب التأثير الكامل»');
  ok(g.vol === '0.3' && g.fit, 'شريط المستوى يعرض المحفوظ (0.3) والمعرض داخل الشاشة');
  await pg.click('#gmt-snd-gal [data-snd-cat="SEC"]');
  ok(await ev(() => [...document.querySelectorAll('#gmt-snd-gal .g-card')].filter(c => c.style.display !== 'none').every(c => c.dataset.cat === 'SEC')), 'chip «الأمان» يُظهر بطاقات الأمان فقط');
  await pg.click('#gmt-snd-gal [data-snd-x]');

  const real = errs.filter(e => !/status of (400|404|406|503)|Failed to load resource|favicon|^(pageerror: )?(Uncaught )?(Error: )?x$/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
