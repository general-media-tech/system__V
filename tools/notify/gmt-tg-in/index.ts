// gmt-tg-in — بوت تيليغرام الوارد: صورة أو رابط منتج ⇒ «ما يجب شراؤه» (TASK-B0508 ٣ · المالك seq 824 «نعم» لبوت ما يجب شراؤه)
//
// الأمان (البوت اختُرق مرّةً من قبل — انظر gmt-tg):
//   • Telegram يرسل لهذه الدالّة فقط مع ترويسة X-Telegram-Bot-Api-Secret-Token — قيمتها مشتقّة من مفتاح البوت (HMAC) فلا سرّ جديد ولا يعرفها غيرنا.
//   • من يُقبل منه: رسالة خاصّة من عضوٍ في مجموعة الإدارة (يُفحص getChatMember عند كلّ رسالة) أو رسالة في مجموعة الإدارة نفسها تبدأ بـ /buy أو تذكر البوت.
//   • لا أوامر أخرى: لا حذف ولا قراءة بيانات ولا ردّ بمعلومات من القاعدة — فقط «أُضيف».
//   • الصورة تُرفع إلى products-images/tg/ بمفتاح الخادم · القائمة نفسها (gmt_settings.buy_wishlist) التي تقرؤها صفحة «ما يجب أن نشتريه».
//   • /setup يضبط الـwebhook على هذه الدالّة نفسها فقط (لا عنوان آخر) — إعادته لا تضرّ.
const ADMIN_CHAT = "-1003870992994";
const WKEY = "buy_wishlist";
const BOT_USER = "General_media_tech_bot";
const TOKEN = () => Deno.env.get("TG_BOT_TOKEN") || "";
const SB_URL = () => Deno.env.get("SUPABASE_URL") || "";
const SB_SVC = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const sbH = () => ({ apikey: SB_SVC(), Authorization: "Bearer " + SB_SVC() });

async function hookSecret(): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(TOKEN()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode("gmt-tg-in/v1")));
  return Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
}
// deno-lint-ignore no-explicit-any
async function tg(method: string, body: Record<string, unknown>): Promise<any> {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN()}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) }).catch(() => null);
  return r ? await r.json().catch(() => ({})) : {};
}
async function isAdminMember(userId: number): Promise<boolean> {
  const d = await tg("getChatMember", { chat_id: ADMIN_CHAT, user_id: userId });
  const st = d && d.ok && d.result ? d.result.status : "";
  return ["creator", "administrator", "member"].includes(st);
}
const URL_RX = /\bhttps?:\/\/[^\s<>"']+/gi;
const VIDEO_RX = /(youtube\.com|youtu\.be|tiktok\.com|instagram\.com\/(reel|p)\/|facebook\.com\/.*\/videos|vimeo\.com)/i;

// deno-lint-ignore no-explicit-any
async function uploadPhoto(photo: any[]): Promise<string> {
  if (!Array.isArray(photo) || !photo.length || !SB_URL() || !SB_SVC()) return "";
  const best = photo.slice().sort((a, b) => (b.file_size || 0) - (a.file_size || 0))[0];
  const f = await tg("getFile", { file_id: best.file_id });
  const fp = f && f.ok && f.result && f.result.file_path; if (!fp) return "";
  const img = await fetch(`https://api.telegram.org/file/bot${TOKEN()}/${fp}`, { signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!img || !img.ok) return "";
  const buf = new Uint8Array(await img.arrayBuffer());
  if (buf.length > 10 * 1024 * 1024) return "";
  const path = `tg/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const up = await fetch(`${SB_URL()}/storage/v1/object/products-images/${path}`, { method: "POST", headers: { ...sbH(), "Content-Type": "image/jpeg", "x-upsert": "true" }, body: buf, signal: AbortSignal.timeout(20000) }).catch(() => null);
  return up && up.ok ? `${SB_URL()}/storage/v1/object/public/products-images/${path}` : "";
}
// deno-lint-ignore no-explicit-any
async function addItem(item: Record<string, any>): Promise<boolean> {
  const r = await fetch(`${SB_URL()}/rest/v1/gmt_settings?key=eq.${WKEY}&select=value`, { headers: sbH(), signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!r || !r.ok) return false;
  const rows = await r.json().catch(() => []);
  // deno-lint-ignore no-explicit-any
  let list: any[] = [];
  try { const v = rows && rows[0] ? rows[0].value : "[]"; list = typeof v === "string" ? JSON.parse(v || "[]") : (v || []); } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  list.unshift(item);
  if (list.length > 500) list = list.slice(0, 500);
  const w = await fetch(`${SB_URL()}/rest/v1/gmt_settings?on_conflict=key`, { method: "POST", headers: { ...sbH(), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: WKEY, value: JSON.stringify(list) }), signal: AbortSignal.timeout(10000) }).catch(() => null);
  return !!(w && w.ok);
}

Deno.serve(async (req) => {
  const route = new URL(req.url).pathname.split("/").filter(Boolean).pop() || "";
  if (!TOKEN()) return new Response(JSON.stringify({ ok: false, relay: "not_configured" }), { status: 503 });
  if (route === "setup") {
    const url = `${SB_URL()}/functions/v1/gmt-tg-in`;
    const d = await tg("setWebhook", { url, secret_token: await hookSecret(), allowed_updates: ["message"], drop_pending_updates: true });
    return new Response(JSON.stringify({ ok: !!(d && d.ok), description: d && d.description }), { headers: { "Content-Type": "application/json" } });
  }
  if (req.method !== "POST") return new Response("ok");
  if (req.headers.get("x-telegram-bot-api-secret-token") !== await hookSecret()) return new Response("forbidden", { status: 401 });
  try {
    const up = await req.json().catch(() => ({}));
    const m = up && up.message; if (!m || !m.chat || !m.from) return new Response("ok");
    const chatId = String(m.chat.id), priv = m.chat.type === "private";
    const text = String(m.text || m.caption || "");
    const reply = (t: string) => tg("sendMessage", { chat_id: m.chat.id, text: t, reply_to_message_id: m.message_id, link_preview_options: { is_disabled: true } });
    if (priv) {
      if (!(await isAdminMember(m.from.id))) { await reply("هذا البوت لفريق General Media Tech فقط."); return new Response("ok"); }
      if (/^\/start/.test(text)) { await reply("أرسل صورة منتج (والاسم في التعليق) أو رابط منتج — يُضاف فوراً إلى «ما يجب أن نشتريه» في النظام."); return new Response("ok"); }
    } else {
      if (chatId !== ADMIN_CHAT) return new Response("ok");
      const addressed = /^\/buy\b/i.test(text) || text.includes("@" + BOT_USER);
      if (!addressed) return new Response("ok");
    }
    const urls = (text.match(URL_RX) || []).slice(0, 3);
    const hasPhoto = Array.isArray(m.photo) && m.photo.length;
    if (!hasPhoto && !urls.length) { await reply("أرسل صورة المنتج أو رابطه — لم أجد صورة ولا رابطاً."); return new Response("ok"); }
    let name = text.replace(URL_RX, " ").replace(/^\/buy(@\w+)?/i, " ").replace("@" + BOT_USER, " ").replace(/\s+/g, " ").trim();
    let qty = 1; const qm = name.match(/(?:×|x|\*|عدد|كمية|كميه)\s*(\d{1,4})/i); if (qm) { qty = Math.max(1, +qm[1]); name = name.replace(qm[0], " ").trim(); }
    name = name.slice(0, 160) || (urls[0] ? "منتج من رابط" : "منتج من صورة");
    const image = hasPhoto ? await uploadPhoto(m.photo) : "";
    const video = urls.find((u) => VIDEO_RX.test(u)) || "";
    const link = urls.find((u) => u !== video) || "";
    const who = [m.from.first_name, m.from.last_name].filter(Boolean).join(" ") || m.from.username || "تيليغرام";
    const ok = await addItem({ name, qty, link, video, image, note: "من تيليغرام", on: true, by: who, at: new Date().toISOString() });
    await reply(ok ? `✅ أُضيف إلى «ما يجب أن نشتريه»: ${name}${qty > 1 ? " × " + qty : ""}${image ? " · بصورته" : ""}` : "⚠️ تعذّر الحفظ الآن — أعد الإرسال بعد قليل.");
  } catch { /* لا نُفشل الـwebhook — تيليغرام يعيد المحاولة */ }
  return new Response("ok");
});
