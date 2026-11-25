// gmt-admin — التحقّق من كلمات سرّ الإدارة على الخادم (TASK-B0522 · المالك seq 857 «شغّل الأمان»)
// بصمات كلمات السرّ وتذكّر الأجهزة تُقرأ وتُكتب هنا بمفتاح الخادم فقط — المتصفّح يرسل ما كتبه المستخدم ويستلم «صحيح/خطأ» ورمز جلسةٍ موقَّعاً.
// الصيغ نفسها التي كانت في gmt-auth.js (PBKDF2 للحسابات · SHA-256 بالمِلح لكلمات الأنواع وتذكّر الأجهزة) ⇒ لا تتغيّر أيّ كلمةٍ ولا جهازٍ متذكَّر.
const SB = () => Deno.env.get("SUPABASE_URL") || "";
const SVC = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const H = () => ({ apikey: SVC(), Authorization: "Bearer " + SVC(), "Content-Type": "application/json" });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-gmt-session", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const SALT = "gmt::2026::auth", DEFAULT_PW = "2003", ITERS = 120000, ADMIN_KEY = "admin_accounts", DEV = "admin_device_", TTL = 12 * 3600 * 1000;
const KINDS: Record<string, string> = { sovereign: "pw_sovereign", store: "pw_store", warranty: "pw_warranty", pos: "admin_password", purchase: "pw_purchase", backup: "pw_backup" };
const enc = new TextEncoder();
const hex = (u: Uint8Array) => Array.from(u).map((b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));
async function sha(t: string) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(SALT + "|" + t)))); }
async function pbkdf2(pw: string, salt: string, it: number) {
  const k = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(salt), iterations: it }, k, 256)));
}
function same(a: string, b: string) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const norm = (x: unknown) => String(x ?? "").normalize("NFKC").replace(/[ً-ٟـ]/g, "").replace(/\s+/g, "").toLowerCase();
async function hmac(s: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode("gmt-admin/v1|" + SVC()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(s))));
}
async function mkSess(name: string) {   /* (TASK-B0523) جلسة خادم للأدمن في gmt_sessions (البصمة فقط) — تُرسَل ترويسةً x-gmt-session */
  const t = hex(crypto.getRandomValues(new Uint8Array(32)));
  const th = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(t))));
  const r = await fetch(`${SB()}/rest/v1/gmt_sessions`, { method: "POST", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify([{ th, name, role: "admin", exp: new Date(Date.now() + TTL).toISOString() }]) });
  return r.ok ? t : "";
}
async function mkToken(name: string) { const exp = Date.now() + TTL, b = btoa(unescape(encodeURIComponent(name))) + "." + exp; return b + "." + await hmac(b); }
async function who(tok: unknown): Promise<string | null> {
  const p = String(tok || "").split("."); if (p.length !== 3) return null;
  const b = p[0] + "." + p[1]; if (!same(await hmac(b), p[2]) || +p[1] < Date.now()) return null;
  try { return decodeURIComponent(escape(atob(p[0]))); } catch { return null; }
}
async function get(key: string): Promise<string | null> {
  const r = await fetch(`${SB()}/rest/v1/gmt_settings?key=eq.${encodeURIComponent(key)}&select=value`, { headers: H() });
  if (!r.ok) throw new Error("read " + r.status); const rows = await r.json(); return rows && rows[0] ? rows[0].value : null;
}
async function put(key: string, value: string) {
  const r = await fetch(`${SB()}/rest/v1/gmt_settings?on_conflict=key`, { method: "POST", headers: { ...H(), Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([{ key, value }]) });
  if (!r.ok) throw new Error("write " + r.status);
}
async function del(key: string) { await fetch(`${SB()}/rest/v1/gmt_settings?key=eq.${encodeURIComponent(key)}`, { method: "DELETE", headers: { ...H(), Prefer: "return=minimal" } }); }
// deno-lint-ignore no-explicit-any
async function admins(): Promise<any[]> { const v = await get(ADMIN_KEY); if (!v || !String(v).trim()) return []; const l = JSON.parse(v); if (!Array.isArray(l)) throw new Error("corrupt"); return l; }
// deno-lint-ignore no-explicit-any
async function mkAcc(name: string, pw: string, by: string): Promise<any> { const s = hex(crypto.getRandomValues(new Uint8Array(16))); return { n: String(name).trim(), k: norm(name), s, i: ITERS, h: await pbkdf2(pw, s, ITERS), at: new Date().toISOString(), by }; }
async function checkKind(kind: string, pw: string) {
  const key = KINDS[kind]; if (!key) return { ok: false, isDefault: false };
  const st = await get(key);
  if (st) { const ok = String(st).startsWith("sha256:") ? same("sha256:" + await sha(pw), String(st)) : same(pw, String(st)); return { ok, isDefault: false }; }
  return { ok: pw === DEFAULT_PW, isDefault: true };
}
const slow = () => new Promise((r) => setTimeout(r, 400));
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  try {
    const q = await req.json().catch(() => ({}));
    const a = String(q.a || ""), pw = String(q.pw ?? "").slice(0, 200);
    if (a === "check") { const r = await checkKind(String(q.kind), pw); if (!r.ok) await slow(); return J({ ok: true, valid: r.ok, isDefault: r.isDefault }); }
    if (a === "isdefault") { const key = KINDS[String(q.kind)]; return J({ ok: true, isDefault: !!key && !(await get(key)) }); }
    if (a === "login") {
      const list = await admins();
      if (!list.length) {
        if (!q.bootstrap) return J({ ok: true, none: true });
        if (!(await checkKind("sovereign", pw)).ok) { await slow(); return J({ ok: true, valid: false, none: true }); }
        const first = await mkAcc(String(q.name || "").slice(0, 40), pw, "أوّل حساب"); await put(ADMIN_KEY, JSON.stringify([first]));
        return J({ ok: true, valid: true, created: true, name: first.n, token: await mkToken(first.n), sess: await mkSess(first.n) });
      }
      const k = norm(q.name), acc = list.find((x) => x && x.k === k);
      if (!acc || !same(await pbkdf2(pw, acc.s, acc.i || ITERS), String(acc.h))) { await slow(); return J({ ok: true, valid: false, known: !!acc }); }
      return J({ ok: true, valid: true, name: acc.n, token: await mkToken(acc.n), sess: await mkSess(acc.n) });
    }
    if (a === "dev_restore") {
      const rec = await get(DEV + String(q.id || "").replace(/[^0-9a-f]/gi, "")); const r = rec ? JSON.parse(rec) : null;
      const list = await admins(), acc = list.find((x) => x && r && x.k === r.k && x.k === norm(q.k));
      const good = !!(r && acc && r.s === acc.s && same(String(r.h || ""), await sha("admin-device|" + String(q.t || ""))));
      if (!good) { if (r && (!acc || r.s !== acc.s)) await del(DEV + String(q.id)); return J({ ok: true, valid: false, gone: true }); }
      return J({ ok: true, valid: true, name: acc.n, token: await mkToken(acc.n), sess: await mkSess(acc.n) });
    }
    if (a === "dev_forget") {
      const id = String(q.id || "").replace(/[^0-9a-f]/gi, ""), rec = await get(DEV + id), r = rec ? JSON.parse(rec) : null;
      if (r && same(String(r.h || ""), await sha("admin-device|" + String(q.t || "")))) await del(DEV + id);
      return J({ ok: true });
    }
    /* ما يلي للأدمن الداخل فقط (رمز الجلسة الموقَّع) */
    const me = await who(q.token); if (!me) return J({ ok: false, error: "auth" }, 401);
    const list = await admins(); const mine = list.find((x) => x && x.k === norm(me)); if (!mine) return J({ ok: false, error: "auth" }, 401);
    if (a === "list") return J({ ok: true, list: list.map((x) => ({ name: x.n, at: x.at || "", by: x.by || "" })) });
    if (a === "setkind") { const key = KINDS[String(q.kind)]; if (!key || pw.length < 4) return J({ ok: false, error: "bad" }, 400); await put(key, "sha256:" + await sha(pw)); return J({ ok: true }); }
    if (a === "add") {
      const n = String(q.name || "").trim(); if (n.length < 2 || n.length > 40 || pw.length < 4) return J({ ok: false, error: "bad" }, 400);
      if (list.some((x) => x.k === norm(n))) return J({ ok: false, error: "exists" }); list.push(await mkAcc(n, pw, me)); await put(ADMIN_KEY, JSON.stringify(list)); return J({ ok: true });
    }
    if (a === "setpw") {
      const acc = list.find((x) => x.k === norm(q.name)); if (!acc || pw.length < 4) return J({ ok: false, error: acc ? "bad" : "missing" }, 400);
      const f = await mkAcc(acc.n, pw, acc.by); acc.s = f.s; acc.i = f.i; acc.h = f.h; acc.pw_at = new Date().toISOString(); await put(ADMIN_KEY, JSON.stringify(list)); return J({ ok: true });
    }
    if (a === "remove") {
      const k = norm(q.name); if (!list.some((x) => x.k === k)) return J({ ok: false, error: "missing" }); if (k === norm(me)) return J({ ok: false, error: "self" }); if (list.length <= 1) return J({ ok: false, error: "last" });
      const gone = list.find((x) => x.k === k); await put(ADMIN_KEY, JSON.stringify(list.filter((x) => x.k !== k))); return J({ ok: true, name: gone.n });
    }
    if (a === "dev_remember") {
      const id = hex(crypto.getRandomValues(new Uint8Array(9))), t = hex(crypto.getRandomValues(new Uint8Array(32)));
      const rec = { k: mine.k, n: mine.n, s: mine.s, h: await sha("admin-device|" + t), at: new Date().toISOString(), ua: String(q.ua || "").slice(0, 120) };
      await put(DEV + id, JSON.stringify(rec));
      if (q.old) { const o = String(q.old).replace(/[^0-9a-f]/gi, ""); if (o && o !== id) await del(DEV + o); }
      return J({ ok: true, id, t, k: mine.k, n: mine.n, at: rec.at });
    }
    /* (TASK-B0560 · A1004 P6) أرشيف مستندات المشتريات: الدلو po-docs خاصّ (المتصفّح يرفع فقط) ⇒ رابط موقَّع ٥ دقائق للأدمن الداخل فقط */
    if (a === "doc_url") {
      const p = String(q.path || "");
      if (!/^po\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(p) || p.includes("..")) return J({ ok: false, error: "bad" }, 400);
      const r = await fetch(`${SB()}/storage/v1/object/sign/po-docs/${p}`, { method: "POST", headers: H(), body: JSON.stringify({ expiresIn: 300 }) });
      if (!r.ok) return J({ ok: false, error: "sign " + r.status }, r.status === 404 || r.status === 400 ? 404 : 500);
      const j = await r.json(); const su = String(j.signedURL || j.signedUrl || "");
      if (!su) return J({ ok: false, error: "sign" }, 500);
      return J({ ok: true, url: SB() + "/storage/v1" + (su.startsWith("/") ? su : "/" + su) });
    }
    return J({ ok: false, error: "unknown" }, 400);
  } catch (e) { return J({ ok: false, error: String(e).slice(0, 120) }, 500); }
});
