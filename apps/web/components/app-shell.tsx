"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, Gauge, LogOut, Settings, Users } from "lucide-react";
import { clearAuth, getStoredUser } from "@/lib/api";
import type { AuthUser } from "@meetingeconomy/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/meetings", label: "Meetings", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-card md:block">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">MeetingEconomy</div>
            <div className="text-xs text-muted-foreground">meetingeconomy.io</div>
          </div>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                  active && "bg-accent text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Users className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">MeetingEconomy</span>
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-medium">{user?.org_name}</div>
            <div className="text-xs text-muted-foreground">{user?.name} · {user?.role}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right text-xs text-muted-foreground sm:block">{user?.email}</div>
            <Button
              variant="ghost"
              size="icon"
              title="Sign out"
              onClick={() => {
                clearAuth();
                router.replace("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}
