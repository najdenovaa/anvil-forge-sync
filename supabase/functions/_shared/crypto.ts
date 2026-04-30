// Shared AES-GCM symmetric encryption for bot tokens.
//
// On-disk format: base64( iv[12] || ciphertext+tag ).
//   - iv: 12 random bytes per encryption (AES-GCM nonce).
//   - ciphertext+tag: WebCrypto AES-GCM appends the 16-byte auth tag to the
//     ciphertext automatically; we don't slice it out, decrypt() handles it.
//
// Key derivation: BOT_TOKEN_ENCRYPTION_KEY (any string ≥16 chars) → SHA-256
//   → 32-byte AES-256 key. SHA-256 is used as a deterministic 1-way mapping
//   from "any user-provided secret" to a fixed-size raw AES key, NOT as a KDF
//   for password stretching. This is intentional: the secret is high-entropy
//   (random hex/base64, not a password), so PBKDF2/Argon2 would add latency
//   without improving security. The same secret always derives the same key,
//   so deploy-bot encrypts and bot-runtime decrypts with one shared env var.

const enc = new TextEncoder();
const dec = new TextDecoder();

const MIN_KEY_LEN = 16;

async function deriveKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("BOT_TOKEN_ENCRYPTION_KEY");
  if (!raw) throw new Error("BOT_TOKEN_ENCRYPTION_KEY not configured");
  if (raw.length < MIN_KEY_LEN) {
    throw new Error(
      `BOT_TOKEN_ENCRYPTION_KEY must be at least ${MIN_KEY_LEN} characters`,
    );
  }
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  return crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
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
