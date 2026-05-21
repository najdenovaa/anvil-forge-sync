/**
 * Telegram WebApp initData validator.
 *
 * Telegram appends a signed query string to every Mini App launch
 * (`window.Telegram.WebApp.initData`). The signature is HMAC-SHA256:
 *
 *   secret_key       = HMAC-SHA256(key="WebAppData", message=bot_token)
 *   data_check_str   = sorted("key=value") joined by "\n" of all params except `hash`
 *   computed_hash    = HMAC-SHA256(key=secret_key, message=data_check_str)
 *
 * If computed_hash === hash, the payload genuinely came from Telegram
 * for the bot whose token we know.
 *
 * Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Returns parsed user fields if valid, otherwise null. Callers must
 * NEVER trust user-supplied tg_user_id without going through this.
 */

interface ValidatedInitData {
  /** Telegram user id as a string (e.g. "123456789"). */
  user_id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  /** Unix timestamp from Telegram. Older than ~24h → reject as stale. */
  auth_date: number;
}

async function hmacSha256(keyBytes: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function validateInitData(
  initData: string,
  botToken: string,
): Promise<ValidatedInitData | null> {
  if (!initData || !botToken) return null;

  let parsed: URLSearchParams;
  try {
    parsed = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const receivedHash = parsed.get("hash");
  if (!receivedHash) return null;

  // Build data_check_string: all params except `hash`, sorted by key,
  // joined as "key=value\nkey=value\n..."
  const entries: [string, string][] = [];
  parsed.forEach((value, key) => {
    if (key !== "hash") entries.push([key, value]);
  });
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  // secret_key = HMAC_SHA256(key="WebAppData", message=botToken)
  const webAppDataKey = new TextEncoder().encode("WebAppData");
  const secretKey = await hmacSha256(webAppDataKey, botToken);

  // computed_hash = HMAC_SHA256(key=secret_key, message=data_check_string)
  const computedHashBuf = await hmacSha256(new Uint8Array(secretKey), dataCheckString);
  const computedHash = toHex(computedHashBuf);

  if (computedHash !== receivedHash) return null;

  // Signature valid — extract user data.
  const userJson = parsed.get("user");
  if (!userJson) return null;
  let userObj: any;
  try {
    userObj = JSON.parse(userJson);
  } catch {
    return null;
  }
  const userId = userObj?.id != null ? String(userObj.id) : null;
  if (!userId) return null;

  const authDate = Number(parsed.get("auth_date") ?? "0");
  // Stale check — 24h window. Anything older means initData was cached
  // somewhere and replayed; treat as untrusted.
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (!authDate || ageSeconds > 24 * 60 * 60) return null;

  return {
    user_id: userId,
    first_name: typeof userObj.first_name === "string" ? userObj.first_name : undefined,
    last_name: typeof userObj.last_name === "string" ? userObj.last_name : undefined,
    username: typeof userObj.username === "string" ? userObj.username : undefined,
    language_code: typeof userObj.language_code === "string" ? userObj.language_code : undefined,
    auth_date: authDate,
  };
}
