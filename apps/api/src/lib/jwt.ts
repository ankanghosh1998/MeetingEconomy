import jwt from "jsonwebtoken";
import type { UserRole } from "@meetingeconomy/types";
import { env } from "../config/env";

export type AuthTokenPayload = {
  userId: string;
  orgId: string;
  role: UserRole;
};

export type OAuthStatePayload = {
  purpose: "google-login" | "google-calendar" | "microsoft-calendar";
  userId?: string;
  orgId?: string;
  redirectTo?: string;
};

export function signAuthToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: "7d",
    issuer: "meetingeconomy-api",
    audience: "meetingeconomy-web"
  });
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: "meetingeconomy-api",
    audience: "meetingeconomy-web"
  }) as AuthTokenPayload;
}

export function signOAuthState(payload: OAuthStatePayload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: "15m",
    issuer: "meetingeconomy-api",
    audience: "oauth-state"
  });
}

export function verifyOAuthState(token: string) {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: "meetingeconomy-api",
    audience: "oauth-state"
  }) as OAuthStatePayload;
}
