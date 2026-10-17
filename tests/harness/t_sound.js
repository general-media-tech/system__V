const H = require('./h.js');
const FAKE = `
(function(){
  window.__au = { osc: [], noise: 0 };
  function P(rec){ return { value:0, setValueAtTime(v){ rec && rec.push(v); }, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){}, cancelScheduledValues(){} }; }
  function Node(){ return { connect(){ return this; }, disconnect(){} }; }
  function AC(){ this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = Node(); }
  AC.prototype.resume = function(){ return Promise.resolve(); };
  AC.prototype.createGain = function(){ const n = Node(); n.gain = P(); return n; };
  AC.prototype.createBiquadFilter = function(){ const n = Node(); n.frequency = P(); n.Q = {value:0}; n.type=''; return n; };
  AC.prototype.createOscillator = function(){ const n = Node(); const rec = []; n.frequency = P(rec); n.type=''; n.start = function(){ window.__au.osc.push(rec[0]); }; n.stop = function(){}; return n; };
  AC.prototype.createBuffer = function(c, len){ return { getChannelData(){ return new Float32Array(len); } }; };
  AC.prototype.createBufferSource = function(){ const n = Node(); n.start = function(){ window.__au.noise++; }; n.stop = function(){}; return n; };
  window.AudioContext = AC; window.webkitAudioContext = AC;
})();`;
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('pos.html', { init: FAKE + H.ADMIN_INIT, w: 390, h: 800, wait: 4500 });
  const snap = async () => pg.evaluate(() => { const o = window.__au.osc.slice(); const n = window.__au.noise; window.__au.osc = []; window.__au.noise = 0; return { osc: o.map(x => Math.round(x)), noise: n }; });
  await pg.evaluate(() => { localStorage.setItem('gmt_sound', 'on'); });
  await pg.mouse.click(10, 300);                 // يفتح الصوت (أوّل لمسة)
  await pg.waitForTimeout(400); await snap();
  const has = await pg.evaluate(() => ({ showToast: typeof window.showToast, wrapped: !!(window.showToast && window.showToast.__gmtSnd), list: GMTSound.list.join(',') }));
  console.log('pos:', JSON.stringify(has));
  const t = async (label, js, wait = 450) => { await pg.evaluate(js); await pg.waitForTimeout(wait); console.log(label.padEnd(26), JSON.stringify(await snap())); };
  await t('toast نجاح (659,880)', () => showToast('✅ تم الحفظ بنجاح', 'ok'));
  await t('toast خطأ (330,233)', () => showToast('تعذّر الحفظ — حاول مجدداً', 'err'));
  await t('toast مال (cash 1319…)', () => showToast('💰 تم تحصيل المبلغ في الصندوق', 'ok'));
  await t('toast عميل (420,640)', () => showToast('تمت إضافة عميل جديد', 'ok'));
  await t('toast خروج (880,659)', () => showToast('تمّ تسجيل الخروج', 'inf'));
  await t('info بلا صوت', () => showToast('جارٍ التحميل…', 'inf'));
  await t('truck (415,525 ×2)', () => GMTSound.play('truck'), 600);
  await t('scan (2200,2900)', () => GMTSound.play('scan'));
  // نقرة زرّ
  await pg.evaluate(() => { const b = document.createElement('button'); b.id = 'tb'; b.textContent = 'x'; b.style.cssText = 'position:fixed;top:5px;left:5px;z-index:99999;width:40px;height:30px'; document.body.appendChild(b); });
  await pg.waitForTimeout(150); await snap();
  await pg.click('#tb'); await pg.waitForTimeout(300); console.log('click زرّ (1250)'.padEnd(26), JSON.stringify(await snap()));
  await pg.evaluate(() => { document.getElementById('tb').className = 'btn danger'; }); await pg.waitForTimeout(100); await snap();
  await pg.click('#tb'); await pg.waitForTimeout(300); console.log('click خطِر (300)'.padEnd(26), JSON.stringify(await snap()));
  // كتم
  await pg.evaluate(() => GMTSound.off()); await snap();
  await t('مكتوم ⇒ لا شيء', () => showToast('✅ تم', 'ok'));
  console.log('errors:', errs.slice(0, 3));
  await browser.close();
})();
