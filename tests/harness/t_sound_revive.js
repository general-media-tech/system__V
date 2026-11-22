// (TASK-A0565 · المالك seq 959/963 «ركّزلي على الإشعارات والأصوات» · «كمل اصلاحات»)
// الجذر: فتح الصوت كان «مرّة واحدة». قفل الهاتف/الخلفية ⇒ المتصفّح يعلّق السياق ⇒ resume() خارج لمسة يُرفض
// ⇒ صوت الأوردر/الإشعار التالي صامت حتى إعادة التحميل. سياقٌ وهميّ صارم: resume ينجح داخل لمسةٍ حقيقيّة فقط.
//  ① أوّل لمسة تفتح الصوت   ② بعد التعليق: إشعارٌ بلا لمسة صامت (واقع المتصفّح)
//  ③ لمسة على مكانٍ فارغ توقظ الصوت ⇒ الإشعار التالي مسموع   ④ العودة للصفحة توقظه (حيث يسمح المتصفّح)
//  ⑤ «interrupted» (سفاري) تُعامَل كالتعليق   ⑥ سياقٌ عالق بعد لمسة ⇒ سياقٌ جديد في اللمسة التالية
//  ⑦ نقطة البيع: صوت «تمت الموافقة على عمولتك» عبر المنظومة (لا سياق جديد · يحترم الكتم)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const FAKE = `
(function(){
  window.__au = { osc: 0, made: 0, all: [], freeResume: false, stuck: false };
  function P(){ return { value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){}, cancelScheduledValues(){} }; }
  function Node(){ return { connect(){ return this; }, disconnect(){} }; }
  function gesture(){ const e = window.event; return !!(e && e.isTrusted && /^(pointerdown|pointerup|mousedown|mouseup|click|keydown|keyup|touchstart|touchend)$/.test(e.type)); }
  function AC(){ this.currentTime = 0; this.sampleRate = 8000; this._st = gesture() ? 'running' : 'suspended'; this.destination = Node(); this._stuck = window.__au.stuck; window.__au.made++; window.__au.all.push(this); }
  Object.defineProperty(AC.prototype, 'state', { get(){ return this._st; } });
  AC.prototype.resume = function(){ if (!this._stuck && this._st !== 'closed' && (gesture() || window.__au.freeResume)) this._st = 'running'; return Promise.resolve(); };
  AC.prototype.suspend = function(){ this._st = 'suspended'; return Promise.resolve(); };
  AC.prototype.close = function(){ this._st = 'closed'; return Promise.resolve(); };
  AC.prototype.createGain = function(){ const n = Node(); n.gain = P(); return n; };
  AC.prototype.createDynamicsCompressor = function(){ const n = Node(); ['threshold','knee','ratio','attack','release'].forEach(k => n[k] = P()); return n; };
  AC.prototype.createBiquadFilter = function(){ const n = Node(); n.frequency = P(); n.Q = {value:0}; n.type=''; return n; };
  AC.prototype.createOscillator = function(){ const n = Node(); const self = this; n.frequency = P(); n.detune = P(); n.type=''; n.start = function(){ if (self._st === 'running') window.__au.osc++; }; n.stop = function(){}; return n; };
  AC.prototype.createBuffer = function(c, len){ return { getChannelData(){ return new Float32Array(len); } }; };
  AC.prototype.createBufferSource = function(){ const n = Node(); n.start = function(){}; n.stop = function(){}; return n; };
  window.AudioContext = AC; window.webkitAudioContext = AC;
})();`;
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('pos.html', { init: FAKE + H.ADMIN_INIT + `;try{localStorage.setItem('gmt_sound','on')}catch(_){}`, w: 390, h: 800, wait: 4500 });
  const cur = () => pg.evaluate(() => { const a = window.__au.all; const c = a[a.length - 1]; return { st: c ? c.state : 'none', made: window.__au.made }; });
  const heard = async (fn) => { await pg.evaluate(() => { window.__au.osc = 0; }); await pg.evaluate(fn); await pg.waitForTimeout(250); return pg.evaluate(() => window.__au.osc); };
  // مكانٌ فارغ بلا زرّ (لا صوت نقرة) — نُضيف طبقةً شفّافة صامتة
  await pg.evaluate(() => { const d = document.createElement('div'); d.id = 'blank'; d.style.cssText = 'position:fixed;left:0;top:0;width:60px;height:60px;z-index:2147483647'; document.body.appendChild(d); });
  const tap = async () => { await pg.mouse.click(20, 20); await pg.waitForTimeout(120); };

  // ①
  await tap();
  const s1 = await cur();
  ok(s1.st === 'running', '① أوّل لمسة تفتح الصوت (' + s1.st + ')');
  ok(await heard(() => GMTSound.play('notify', { force: true })) > 0, '① صوت الإشعار مسموع');
  // ②
  await pg.evaluate(() => window.__au.all[window.__au.all.length - 1].suspend());   // قفل الهاتف / الخلفية
  ok(await heard(() => GMTSound.play('notify', { force: true })) === 0, '② بعد التعليق: إشعارٌ بلا لمسة صامت (واقع المتصفّح)');
  // ③
  await tap();
  const s3 = await cur();
  ok(s3.st === 'running', '③ لمسة على مكانٍ فارغ أيقظت الصوت (' + s3.st + ')');
  ok(await heard(() => GMTSound.play('notify', { force: true })) > 0, '③ الإشعار التالي مسموع');
  // ④
  await pg.evaluate(() => { window.__au.all[window.__au.all.length - 1].suspend(); window.__au.freeResume = true; document.dispatchEvent(new Event('visibilitychange')); });
  await pg.waitForTimeout(100);
  const s4 = await cur();
  ok(s4.st === 'running', '④ العودة للصفحة أيقظت الصوت (' + s4.st + ')');
  // ⑤
  await pg.evaluate(() => { window.__au.all[window.__au.all.length - 1]._st = 'interrupted'; });
  const n5 = await heard(() => GMTSound.play('notify', { force: true }));
  const s5 = await cur();
  ok(s5.st === 'running', '⑤ «interrupted» (سفاري) يُستأنف عند التشغيل (' + s5.st + ' · ' + n5 + ')');
  await pg.evaluate(() => { window.__au.freeResume = false; });
  // ⑥
  await pg.evaluate(() => { const c = window.__au.all[window.__au.all.length - 1]; c._st = 'suspended'; c._stuck = true; });
  await tap(); await pg.waitForTimeout(500);
  const s6a = await cur();
  await tap();
  const s6 = await cur();
  ok(s6a.st !== 'running' && s6.made === s6a.made + 1 && s6.st === 'running', '⑥ سياقٌ عالق ⇒ سياقٌ جديد يعمل في اللمسة التالية (' + s6a.made + '⇐' + s6.made + ' · ' + s6.st + ')');
  ok(await heard(() => GMTSound.play('notify', { force: true })) > 0, '⑥ الصوت مسموع على السياق الجديد');
  // ⑦
  const m0 = (await cur()).made;
  const n7 = await heard(() => { showCommissionNotif(5, ''); });
  const m7 = (await cur()).made;
  ok(n7 > 0 && m7 === m0, '⑦ نقطة البيع: صوت العمولة مسموع بلا سياقٍ جديد (' + n7 + ' · ' + m0 + '⇐' + m7 + ')');
  await pg.evaluate(() => localStorage.setItem('gmt_sound', 'off'));
  const n7b = await heard(() => { showCommissionNotif(5, ''); });
  ok(n7b === 0 && (await cur()).made === m0, '⑦ والكتم 🔇 محترم (' + n7b + ')');
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
