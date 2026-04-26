import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env, isConfigured, isProduction } from "../config/env";

const PREFIX = "enc:v1:";

function encryptionKey() {
  if (!isConfigured(env.ENCRYPTION_KEY)) {
    if (isProduction) throw new Error("ENCRYPTION_KEY must be configured in production.");
    return createHash("sha256").update("meetingeconomy-dev-encryption-key").digest();
  }

  const raw = env.ENCRYPTION_KEY!.trim();
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) return decoded;
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(value: string | null | undefined) {
  if (!value) return value ?? null;
  if (value.startsWith(PREFIX)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString("base64url")}`;
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return value ?? null;
  if (!value.startsWith(PREFIX)) return value;

  const payload = Buffer.from(value.slice(PREFIX.length), "base64url");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
