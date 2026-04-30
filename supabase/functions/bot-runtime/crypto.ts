// AES-GCM symmetric encryption for bot tokens.
// Format stored in DB: base64(iv (12 bytes) || ciphertext || tag).
// Key: BOT_TOKEN_ENCRYPTION_KEY env, any length — derived to 32 bytes via SHA-256.

const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("BOT_TOKEN_ENCRYPTION_KEY");
  if (!raw) throw new Error("BOT_TOKEN_ENCRYPTION_KEY not configured");
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptToken(plain: string): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain)),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return b64encode(out);
}

export async function decryptToken(payload: string): Promise<string> {
  const key = await deriveKey();
  const all = b64decode(payload);
  const iv = all.slice(0, 12);
  const ct = all.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return dec.decode(pt);
}
