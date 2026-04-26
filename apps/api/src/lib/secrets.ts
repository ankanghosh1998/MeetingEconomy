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

export function encryptSecret(value?: string | null) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, tag, encrypted]).toString("base64")}`;
}

export function decryptSecret(value?: string | null) {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value;
  const payload = Buffer.from(value.slice(PREFIX.length), "base64");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
