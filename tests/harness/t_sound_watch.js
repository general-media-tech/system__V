// (TASK-B0406b · OWN-09#53) مراقب DOM: فتح/إغلاق المودالات تلقائياً + حاويات data-snd-watch
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
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
  await pg.mouse.click(5, 400); await pg.waitForTimeout(500);
  const ev = (f, ...a) => pg.evaluate(f, ...a);
  await ev(() => { document.body.insertAdjacentHTML('beforeend', '<div id="tModal" class="hidden" style="position:fixed;inset:0"></div><div id="ov" class="modal-overlay"></div><div id="qq" data-nosound><div id="quietModal" class="hidden"></div></div><ul id="lst" data-snd-watch="order.created"></ul>'); });
  await pg.waitForTimeout(150);
  const last = () => ev(() => GMTSound.last());
  await ev(() => document.getElementById('tModal').classList.remove('hidden')); await pg.waitForTimeout(200);
  ok(await last() === 'open', 'إظهار مودال (#…Modal) ⇒ صوت «open»: ' + await last());
  await ev(() => document.getElementById('tModal').classList.add('hidden')); await pg.waitForTimeout(250);
  ok(await last() === 'close', 'إخفاؤه ⇒ «close»: ' + await last());
  await ev(() => { window.__q = GMTSound.last(); document.getElementById('quietModal').classList.remove('hidden'); }); await pg.waitForTimeout(250);
  ok(await ev(() => GMTSound.last() === window.__q), 'داخل data-nosound ⇒ صمت');
  await ev(() => document.getElementById('ov').classList.add('active')); await pg.waitForTimeout(250);
  ok(await last() === 'open', '.modal-overlay.active ⇒ «open»');
  await ev(() => { document.getElementById('lst').insertAdjacentHTML('beforeend', '<li>فاتورة</li>'); }); await pg.waitForTimeout(300);
  const lst = await last();
  ok(lst !== 'open' && lst !== 'close' && lst, 'إضافة سطرٍ في حاوية data-snd-watch ⇒ صوت الحدث order.created: ' + lst);
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
