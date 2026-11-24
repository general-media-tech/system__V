// gmt-vision (Supabase Edge Function) — مطابقة المتجر بالجرد «بالعين» (المالك seq 218:
// «ممكن ما تكون الصورة متطابقة ١٠٠٪ ولكن المنتج اللي في الصورة ممكن يكون نفسه»).
// يستقبل لوحةً واحدة (JPEG base64) فيها صورة منتج المتجر ومرشّحو الجرد مرقّمين + سؤالاً ⇒ يُرجع نصّ الجواب (JSON يطلبه السؤال).
// المفاتيح نفسها التي يستعملها gmt-brain (أسرار المشروع): GEMINI_API_KEY[_1..20] ثمّ ANTHROPIC_API_KEY[_1..20].
// الحماية كوسيط العقل: النطاق المسموح وحده · حدّ معدّل لكل عنوان · حجم الصورة ≤ ٢٫٨ م.ب · لا مفتاح يتسرّب في الأخطاء.
// (seq B1029 «HTTP 502: Gemini 503 — This model is currently experiencing high demand» خطأ حرج للموظّف) السبب: ردّ 503/500/502
//   (مزدحم مؤقّتاً) كان يُنهي المحاولة فوراً بلا نموذجٍ آخر ولا Claude. الآن: «مزدحم» ⇒ انتظار قصير ثمّ النموذج التالي ثمّ Claude.

const VERSION = "2026-11-24-vision-2";
const ALLOWED_ORIGINS = ["https://general-media-tech.github.io"];
const PROVIDER_ENV = Deno.env.get("AI_PROVIDER") || "";
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
const GEMINI_MODELS: string[] = (Deno.env.get("GEMINI_MODELS") || Deno.env.get("GEMINI_MODEL") || "gemini-flash-lite-latest,gemini-flash-latest,gemini-3.8-flash")
  .split(",").map((x) => x.trim()).filter(Boolean);

function keyList(prefix: string): string[] {
  const out: string[] = [];
  const add = (v?: string | null) => { (v || "").split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => { if (!out.includes(x)) out.push(x); }); };
  add(Deno.env.get(prefix)); add(Deno.env.get(prefix + "S"));
  for (let i = 1; i <= 20; i++) add(Deno.env.get(`${prefix}_${i}`));
  return out;
}
async function rotate(keys: string[], make: (k: string) => Promise<Response>): Promise<Response> {
  let last: Response | null = null;
  for (const k of keys) {
    const r = await make(k);
    if (r.ok) return r;
    let exhausted = r.status === 401 || r.status === 403 || r.status === 429 || r.status === 529;
    if (!exhausted && r.status === 400) {
      const t = await r.clone().text().catch(() => "");
      exhausted = /credit|quota|billing|balance|exceeded|insufficient/i.test(t);
    }
    last = r;
    if (!exhausted) return r;
  }
  return last || new Response(JSON.stringify({ error: "لا مفاتيح" }), { status: 500 });
}
async function modelRetired(r: Response): Promise<boolean> {
  if (r.status === 404) return true;
  if (r.status !== 400) return false;
  const t = await r.clone().text().catch(() => "");
  return /no longer available|not found|deprecated|not supported for generateContent/i.test(t);
}
/* مزدحم مؤقّتاً (UNAVAILABLE · high demand · overloaded) ⇒ لا يُعدّ فشلاً نهائياً */
async function busy(r: Response): Promise<boolean> {
  if (r.status === 503 || r.status === 502 || r.status === 500 || r.status === 529) return true;
  const t = await r.clone().text().catch(() => "");
  return /UNAVAILABLE|high demand|overloaded|try again later/i.test(t);
}
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
async function geminiCall(gKeys: string[], build: (model: string, key: string) => Promise<Response>): Promise<Response> {
  let last: Response | null = null;
  for (const model of GEMINI_MODELS) {
    let r = await rotate(gKeys, (gk) => build(model, gk));
    if (!r.ok && await busy(r)) { await sleep(800); r = await rotate(gKeys, (gk) => build(model, gk)); }   // إعادة واحدة بعد مهلة قصيرة
    if (r.ok) return r;
    last = r;
    if (!(await modelRetired(r)) && !(await busy(r))) return r;   // خطأ حقيقيّ ⇒ لا جدوى من نموذجٍ آخر
  }
  return last || new Response(JSON.stringify({ error: "لا نموذج Gemini متاح" }), { status: 502 });
}
const hits = new Map<string, number[]>();
function limited(key: string, max: number, winMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < winMs);
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const k of hits.keys()) { hits.delete(k); if (hits.size < 2500) break; }
  return arr.length > max;
}
const originOk = (o: string | null) => !!o && ALLOWED_ORIGINS.includes(o);
const scrub = (s: string) => String(s || "").replace(/AIza[0-9A-Za-z_-]{20,}/g, "AIza…").replace(/sk-[A-Za-z0-9_-]{20,}/g, "sk-…").replace(/\s+/g, " ").trim().slice(0, 300);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": originOk(origin) ? origin! : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };
  const out = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return out({ error: "POST فقط" }, 405);
  if (!originOk(origin)) return out({ error: "نطاق غير مسموح" }, 403);
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?";
  if (limited("m:" + ip, 30, 60_000) || limited("d:" + ip, 600, 86_400_000) || limited("all", 300, 60_000)) return out({ error: "طلبات كثيرة جداً — انتظر دقيقة" }, 429);
  try {
    const body = await req.json();
    if (body && body.mode === "status") return out({ version: VERSION, gemini: keyList("GEMINI_API_KEY").length, anthropic: keyList("ANTHROPIC_API_KEY").length });
    const question = String(body.question || "").slice(0, 6000);
    const system = String(body.system || "").slice(0, 4000);
    const image = typeof body.image === "string" ? body.image : "";
    const mime = /^image\/(jpeg|png|webp)$/.test(String(body.image_type || "")) ? String(body.image_type) : "image/jpeg";
    if (!question || !image) return out({ error: "أرسل السؤال والصورة" }, 400);
    if (image.length > 2_800_000) return out({ error: "الصورة كبيرة" }, 400);
    const gKeys = keyList("GEMINI_API_KEY"), aKeys = keyList("ANTHROPIC_API_KEY");
    const order = PROVIDER_ENV === "anthropic" ? ["anthropic", "gemini"] : ["gemini", "anthropic"];
    const errs: string[] = [];
    let allBusy = true;
    for (const p of order) {
      if (p === "gemini" && gKeys.length) {
        const r = await geminiCall(gKeys, (model, gk) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": gk },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: system || "أجب بدقّة." }] },
            contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: image } }, { text: question }] }],
            generationConfig: { maxOutputTokens: 700, temperature: 0.1, responseMimeType: "application/json" } }),
        }));
        if (r.ok) {
          const gj = await r.json();
          const text = (((gj.candidates || [])[0] || {}).content || { parts: [] }).parts.map((x: { text?: string }) => x.text || "").join("\n").trim();
          if (text) return out({ answer: text, provider: "gemini", version: VERSION });
          errs.push("Gemini: ردّ فارغ"); allBusy = false;
        } else { if (!(await busy(r))) allBusy = false; errs.push("Gemini " + r.status + ": " + scrub(await r.text().catch(() => ""))); }
      }
      if (p === "anthropic" && aKeys.length) {
        const r = await rotate(aKeys, (ak) => fetch("https://api.anthropic.com/v1/messages", {
          method: "POST", headers: { "content-type": "application/json", "x-api-key": ak, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 700, system: system || "أجب بدقّة.",
            messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mime, data: image } }, { type: "text", text: question }] }] }),
        }));
        if (r.ok) {
          const aj = await r.json();
          const text = (aj.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n").trim();
          if (text) return out({ answer: text, provider: "anthropic", version: VERSION });
          errs.push("Claude: ردّ فارغ"); allBusy = false;
        } else { if (!(await busy(r))) allBusy = false; errs.push("Claude " + r.status + ": " + scrub(await r.text().catch(() => ""))); }
      }
    }
    if (!gKeys.length && !aKeys.length) return out({ error: "لا يوجد مفتاح ذكاء اصطناعي في أسرار المشروع" }, 500);
    /* كلّ المزوّدين مزدحمون مؤقّتاً ⇒ 503 برسالةٍ مفهومة (الواجهة تعرضها للموظّف ولا تُعدّ خطأً في النظام) */
    if (allBusy) return out({ error: "خدمة الذكاء مزدحمة الآن — جرّب بعد دقيقة", busy: true }, 503);
    return out({ error: errs.slice(-1)[0] || "تعذّر الجواب" }, 502);
  } catch (e) {
    return out({ error: scrub(String((e as Error).message || e)) }, 500);
  }
});
