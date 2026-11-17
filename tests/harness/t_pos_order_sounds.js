// (OWN-12#11 · #12) أصوات الكاشير والطلبات: مفاتيح مسجّلة + أحداث في الجدول المركزي + الأعلى جهارةً للمستعجل
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
  const keys = ['POS_HOLD','POS_RESUME','POS_ITEM_REMOVE','POS_CART_CLEAR','POS_PRICE_EDIT','POS_CUSTOMER','POS_PAY_METHOD','POS_PAY_SPLIT','POS_CHANGE','POS_BARCODE_MANUAL','POS_INVOICE_SEND','ORDER_PREPARING','ORDER_READY','ORDER_WITH_COURIER','ORDER_DELIVERED','ORDER_CANCEL','ORDER_RETURN','ORDER_ASSIGN','ORDER_NOTE','ORDER_URGENT'];
  ok(await ev(k => k.every(x => GMTSound.list.indexOf(x) >= 0), keys), 'كل مفاتيح الكاشير والطلبات (20) مسجّلة');
  const evs = ['pos.hold','pos.resume','pos.item.remove','pos.cart.clear','pos.customer','pos.pay.method','pos.change','order.status.pending','order.status.prepared','order.status.shipped','order.status.delivered','order.cancel','order.return','order.assign','order.note','order.urgent'];
  ok(await ev(e => e.every(x => GMT_EVENT_MAP[x]), evs), 'أحداثها كلّها في GMT_EVENT_MAP');
  for (const e of ['pos.cart.clear', 'order.status.prepared', 'order.urgent']) {
    await ev(() => { try { localStorage.setItem('gmt_sound', 'on'); } catch (_) {} });
    await pg.waitForTimeout(450);
    const r = await ev(e => { const b = window.__au.osc; GMTSound.emit(e); return [GMTSound.last(), window.__au.osc - b]; }, e);
    ok(r[1] > 0, 'emit(' + e + ') ⇒ يعزف (' + r[0] + ', أوسيلاتورات ' + r[1] + ')');
  }
  ok(await ev(() => GMTSound.meta.ORDER_URGENT.sev === 'critical' && GMTSound.meta.ORDER_READY.sev !== 'critical'), 'المستعجل أقوى فئةً من بقيّة حالات الطلب');
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|vibrate/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(pass + ' ✔ / ' + fails + ' ✘'); process.exit(fails ? 1 : 0);
})();
