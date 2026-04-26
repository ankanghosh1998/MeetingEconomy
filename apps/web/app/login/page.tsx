"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chrome, LogIn } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { googleLoginUrl, login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get("email")), String(form.get("password")));
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    try {
      const { url } = await googleLoginUrl();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google login is not configured");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Access MeetingEconomy</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button className="w-full" type="submit" disabled={loading}>
              <LogIn className="h-4 w-4" />
              {loading ? "Signing in" : "Sign in"}
            </Button>
          </form>
          <Button className="mt-3 w-full" variant="outline" onClick={onGoogle}>
            <Chrome className="h-4 w-4" />
            Google
          </Button>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            New workspace?{" "}
            <Link className="font-medium text-primary" href="/signup">
              Create account
            </Link>
          </div>
          <div className="mt-3 flex justify-center gap-3 text-xs text-muted-foreground">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
