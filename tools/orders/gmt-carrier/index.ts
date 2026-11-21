/* gmt-carrier — قراءة حالة الشحنة الحيّة من مواقع شركات الشحن غير المفتي (TASK-A0527 · المالك seq 883)
   «كلّ شركة إلها موقع حيّ بياخد رقم التتبّع (سات · بابل) لازم تعطيهم نفس آلية المفتي».
   المفتي له دالّته gmt-mufti. هنا: سات (sat-cargo.com/track?q=) · بابل (babel-express.com/track?awb=).
   قراءة فقط، بلا تخزين — نفس شكل ردّ gmt-mufti: { ok, out:[{ n, ok, found, level 1..4, status, status_at, steps, receiver }] }
   level: 1 استُلمت · 2 في الطريق · 3 وصلت مدينة الوجهة/خرجت للتسليم · 4 سُلِّمت للمستلم.
   القدموس (بوت تيليغرام فقط) ومسارات (رسائل نصّية فقط) لا موقع تتبّع لهما ⇒ غير مدعومتين. */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

const dec = (t: string) => t.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const txt = (h: string) => dec(String(h || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const mkSteps = (labels: string[], level: number) => labels.map((label, i) => ({ label, active: i + 1 === level }));

/* ── سات: الصفحة تُبنى على الخادم — «حالة الشحنة» في <h1 class="status"> ومراحلها: استلمناه ⇐ في الطريق ⇐ وصل مدينتك ⇐ مع المندوب ⇐ وصلك ── */
export const SAT_STEPS = ['استلمناه', 'في الطريق', 'وصل مدينتك · مع المندوب', 'وصلك'];
export function parseSat(n: string, h: string) {
  const st = txt((/<h1 class="status"[^>]*>([\s\S]*?)<\/h1>/.exec(h) || [])[1] || '');
  if (!st) return { n, ok: false, error: 'page_changed' };
  if (/لم نجد/.test(st)) return { n, ok: true, found: false, level: 0, steps: [], status: st };
  const eta = txt((/<span class="eta"[^>]*>([\s\S]*?)<\/span>\s*(?:<\/header>|<span|<div)/.exec(h) || [])[1] || '');
  let level = 2;
  if (/وصلك|تم التسليم|سُلِّم|سلّمنا|استلمته/.test(st)) level = 4;
  else if (/المندوب|في طريقه إليك|وصل طردك|وصل مدينتك|وصل إلى|في مدينتك/.test(st)) level = 3;
  else if (/في الطريق|انطلق/.test(st)) level = 2;
  else if (/استلمنا|استلمناه|بانتظار/.test(st)) level = 1;
  return { n, ok: true, found: true, level, steps: mkSteps(SAT_STEPS, level), status: st + (eta ? ' — ' + eta : ''), status_at: '', receiver: null };
}

/* ── بابل: Next.js — نتيجة التتبّع داخل بيانات الصفحة (self.__next_f): step 0..3 · shipmentStatus.text · updates[].time · to ── */
export const BABEL_STEPS = ['تكوين الشحنة', 'ضمن النقل', 'خرجت للتسليم', 'تم التسليم'];
export function parseBabel(n: string, h: string) {
  let flight = '';
  for (const m of h.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) { try { flight += JSON.parse(m[1]); } catch (_) { /* جزءٌ لا يُقرأ */ } }
  const all = flight + ' ' + h;
  if (/لم يتم العثور على شحنة/.test(all)) return { n, ok: true, found: false, level: 0, steps: [], status: 'لم يتم العثور على شحنة بهذا الرقم' };
  const step = /"step":"?(\d)"?/.exec(flight);
  const ss = /"shipmentStatus":\{([^{}]*)\}/.exec(flight);
  const stText = ss ? ((/"text":"((?:[^"\\]|\\.)*)"/.exec(ss[1]) || [])[1] || '') : '';
  if (!step && !stText) return { n, ok: false, error: 'page_changed' };
  const level = step ? Math.min(4, Number(step[1]) + 1) : 2;
  const up = /"updates":\[\{"time":"?(\d{9,13})"?(?:,"text":"((?:[^"\\]|\\.)*)")?/.exec(flight);
  let at = '';
  if (up) { const t = Number(up[1]); const d = new Date(t > 1e12 ? t : t * 1000); at = d.toISOString().slice(0, 16).replace('T', ' '); }
  const to = /"to":\{[^{}]*"name":"((?:[^"\\]|\\.)*)"/.exec(flight);
  let status = ''; try { status = JSON.parse('"' + stText + '"'); } catch (_) { status = stText; }
  if (!status && up && up[2]) { try { status = JSON.parse('"' + up[2] + '"'); } catch (_) { status = up[2]; } }
  let rc = ''; if (to) { try { rc = JSON.parse('"' + to[1] + '"'); } catch (_) { rc = to[1]; } }
  return { n, ok: true, found: true, level, steps: mkSteps(BABEL_STEPS, level), status: status || BABEL_STEPS[level - 1], status_at: at, receiver: rc ? { desc: rc } : null };
}

async function get(url: string) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 20000);
  try { const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, 'Accept-Language': 'ar,en;q=0.8' } }); return { status: r.status, body: await r.text() }; }
  finally { clearTimeout(tm); }
}
const READERS: Record<string, (n: string) => Promise<unknown>> = {
  sat: async (n) => { const r = await get('https://sat-cargo.com/track?q=' + encodeURIComponent(n)); return (r.status === 200 || r.status === 404) ? parseSat(n, r.body) : { n, ok: false, error: 'http_' + r.status }; },   /* سات تردّ 404 مع نصّ «لم نجد شحنة» */
  babel: async (n) => { const r = await get('https://www.babel-express.com/track?awb=' + encodeURIComponent(n)); return r.status === 200 ? parseBabel(n, r.body) : { n, ok: false, error: 'http_' + r.status }; },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const t0 = Date.now();
  const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  try {
    const q = await req.json().catch(() => ({}));
    const co = String(q.company || '').toLowerCase(), rd = READERS[co];
    if (!rd) return J({ ok: false, error: 'unknown_company', supported: Object.keys(READERS) }, 400);
    const nums: string[] = [...new Set((Array.isArray(q.nums) ? q.nums : []).map((x: unknown) => String(x).replace(/[^0-9A-Za-z-]/g, '').slice(0, 30)).filter(Boolean))].slice(0, 10) as string[];
    if (!nums.length) return J({ ok: false, error: 'no_nums' }, 400);
    const out = await Promise.all(nums.map(async (n) => { try { return await rd(n); } catch (e) { return { n, ok: false, error: String(e).slice(0, 120) }; } }));
    return J({ ok: true, company: co, ms: Date.now() - t0, at: new Date().toISOString(), out });
  } catch (e) { return J({ ok: false, ms: Date.now() - t0, error: String(e).slice(0, 200) }); }
});
