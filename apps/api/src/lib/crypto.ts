import { createHash, randomBytes } from "node:crypto";

export function hashJson(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function randomPasswordPlaceholder() {
  return `oauth-${randomBytes(24).toString("hex")}`;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string) {
  return normalizeEmail(email).split("@")[1] ?? null;
}
