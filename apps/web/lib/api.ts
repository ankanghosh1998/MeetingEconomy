"use client";

import type { AuthResponse, AuthUser } from "@meetingeconomy/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_KEY = "meetingeconomy.token";
const USER_KEY = "meetingeconomy.user";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function storeAuth(auth: AuthResponse) {
  window.localStorage.setItem(TOKEN_KEY, auth.token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

export function clearAuth() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || `Request failed with ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function login(email: string, password: string) {
  const auth = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  storeAuth(auth);
  return auth;
}

export async function signup(input: { name: string; email: string; password: string; org_name?: string }) {
  const auth = await apiFetch<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(input)
  });
  storeAuth(auth);
  return auth;
}

export async function googleLoginUrl() {
  return apiFetch<{ url: string }>("/auth/google/url");
}

export async function exchangeOAuthCode(code: string) {
  const auth = await apiFetch<AuthResponse>("/auth/oauth/exchange", {
    method: "POST",
    body: JSON.stringify({ code })
  });
  storeAuth(auth);
  return auth;
}
