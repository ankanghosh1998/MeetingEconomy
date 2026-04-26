"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { exchangeOAuthCode, storeAuth } from "@/lib/api";
import type { AuthUser } from "@meetingeconomy/types";

function decodeBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

function OAuthCallbackContent() {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const token = search.get("token");
    const rawUser = search.get("user");
    const code = search.get("code");
    if (code) {
      exchangeOAuthCode(code)
        .then(() => router.replace("/dashboard"))
        .catch(() => router.replace("/login"));
      return;
    }
    if (token && rawUser) {
      const user = JSON.parse(decodeBase64Url(rawUser)) as AuthUser;
      storeAuth({ token, user });
      router.replace("/dashboard");
      return;
    }
    router.replace("/login");
  }, [router, search]);

  return <div className="p-6 text-sm text-muted-foreground">Completing sign in...</div>;
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Completing sign in...</div>}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
