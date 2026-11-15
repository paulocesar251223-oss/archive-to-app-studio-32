// Pure Web Crypto (workerd-safe) validation of Telegram WebApp initData.
const enc = new TextEncoder();

async function hmac(key: BufferSource, data: string) {
  const k = await crypto.subtle.importKey("raw", key as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}
const toHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export type VerifyResult =
  | { ok: true; telegramId: number }
  | { ok: false; code: "INVALID" | "EXPIRED" };

export async function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 86400,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<VerifyResult> {
  const params = new URLSearchParams(initData);
  if ([...new Set(params.keys())].some((key) => params.getAll(key).length !== 1)) return { ok: false, code: 'INVALID' };
  const hash = params.get("hash");
  if (!hash || !/^[a-fA-F0-9]{64}$/.test(hash)) return { ok: false, code: "INVALID" };
  params.delete("hash");
  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = await hmac(enc.encode("WebAppData").buffer as ArrayBuffer, botToken);
  const expected = toHex(await hmac(secret, dataCheck));
  if (!safeEqual(expected, hash.toLowerCase())) return { ok: false, code: "INVALID" };
  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || authDate > nowSec + 60 || nowSec - authDate > maxAgeSec) {
    return { ok: false, code: "EXPIRED" };
  }
  try {
    const user = JSON.parse(params.get("user") ?? "");
    if (!Number.isSafeInteger(user?.id) || user.id <= 0) return { ok: false, code: "INVALID" };
    return { ok: true, telegramId: user.id };
  } catch {
    return { ok: false, code: "INVALID" };
  }
}
