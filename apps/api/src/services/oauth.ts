import { env, isConfigured } from "../config/env";
import { AppError } from "../lib/errors";
import { signOAuthState } from "../lib/jwt";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
};

export function googleLoginUrl() {
  if (!isConfigured(env.GOOGLE_CLIENT_ID)) {
    throw new AppError(501, "Google OAuth is not configured.", "INTEGRATION_NOT_CONFIGURED");
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI ?? `${env.API_URL}/auth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", signOAuthState({ purpose: "google-login" }));
  return url.toString();
}

export function googleCalendarUrl(userId: string, orgId: string) {
  if (!isConfigured(env.GOOGLE_CLIENT_ID)) {
    throw new AppError(501, "Google Calendar is not configured.", "INTEGRATION_NOT_CONFIGURED");
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", env.GOOGLE_CALENDAR_REDIRECT_URI ?? `${env.API_URL}/integrations/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.events.readonly openid email profile");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", signOAuthState({ purpose: "google-calendar", userId, orgId }));
  return url.toString();
}

export function microsoftCalendarUrl(userId: string, orgId: string) {
  if (!isConfigured(env.MICROSOFT_CLIENT_ID)) {
    throw new AppError(501, "Microsoft Graph is not configured.", "INTEGRATION_NOT_CONFIGURED");
  }

  const tenant = env.MICROSOFT_TENANT_ID || "common";
  const url = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", env.MICROSOFT_CLIENT_ID!);
  url.searchParams.set("redirect_uri", env.MICROSOFT_REDIRECT_URI ?? `${env.API_URL}/integrations/microsoft/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "offline_access User.Read Calendars.Read");
  url.searchParams.set("state", signOAuthState({ purpose: "microsoft-calendar", userId, orgId }));
  return url.toString();
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<TokenResponse> {
  if (!isConfigured(env.GOOGLE_CLIENT_ID) || !isConfigured(env.GOOGLE_CLIENT_SECRET)) {
    throw new AppError(501, "Google OAuth is not configured.", "INTEGRATION_NOT_CONFIGURED");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    throw new AppError(502, "Google token exchange failed.", "OAUTH_EXCHANGE_FAILED");
  }

  return (await response.json()) as TokenResponse;
}

export async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new AppError(502, "Google profile fetch failed.", "OAUTH_PROFILE_FAILED");
  }

  return (await response.json()) as {
    email: string;
    name: string;
    picture?: string;
  };
}

export async function exchangeMicrosoftCode(code: string): Promise<TokenResponse> {
  if (!isConfigured(env.MICROSOFT_CLIENT_ID) || !isConfigured(env.MICROSOFT_CLIENT_SECRET)) {
    throw new AppError(501, "Microsoft OAuth is not configured.", "INTEGRATION_NOT_CONFIGURED");
  }

  const tenant = env.MICROSOFT_TENANT_ID || "common";
  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.MICROSOFT_CLIENT_ID!,
      client_secret: env.MICROSOFT_CLIENT_SECRET!,
      redirect_uri: env.MICROSOFT_REDIRECT_URI ?? `${env.API_URL}/integrations/microsoft/callback`,
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    throw new AppError(502, "Microsoft token exchange failed.", "OAUTH_EXCHANGE_FAILED");
  }

  return (await response.json()) as TokenResponse;
}
