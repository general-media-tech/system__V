const H = require('./h.js');
const OUT = '/tmp/gmt-out/';
(async () => {
  await H.seed();
  const NONE = `try{ localStorage.clear(); sessionStorage.clear(); }catch(e){} window.print=()=>{};`;
  const { browser, pg, errs } = await H.open('home.html', { init: NONE, w: 390, h: 800, wait: 1200 });
  const r = await pg.evaluate(() => ({ text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 500), inputs: [...document.querySelectorAll('input')].map(i => i.placeholder || i.type).slice(0, 8), intro: !!document.getElementById('gmt-intro') }));
  console.log(JSON.stringify(r));
  await pg.screenshot({ path: OUT + 'login_first.png' });
  console.log('errs', errs.filter(e => !/404|400|Failed/.test(e)).slice(0, 3));
  await browser.close();
})();
