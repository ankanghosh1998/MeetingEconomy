"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, getToken } from "@/lib/api";
import type { AuthUser } from "@meetingeconomy/types";

export function useAuthGuard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      router.replace("/login");
      return;
    }
    setUser(stored);
    setReady(true);
  }, [router]);

  return { user, ready };
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { ready } = useAuthGuard();
  if (!ready) return <div className="p-6 text-sm text-muted-foreground">Loading MeetingEconomy...</div>;
  return <>{children}</>;
}
