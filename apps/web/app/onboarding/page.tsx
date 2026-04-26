"use client";

import { useRouter } from "next/navigation";
import { CalendarPlus, CheckCircle2, DollarSign, Settings2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";

type Org = {
  name: string;
  domain: string | null;
  cost_model: string;
  default_hourly_rate: number;
  currency: string;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [org, setOrg] = useState<Org | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    apiFetch<Org>("/org").then(setOrg).catch(() => null);
  }, []);

  async function saveOrg(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const updated = await apiFetch<Org>("/org", {
      method: "PUT",
      body: JSON.stringify({
        name: form.get("name"),
        domain: form.get("domain"),
        cost_model: form.get("cost_model"),
        default_hourly_rate: Number(form.get("default_hourly_rate"))
      })
    });
    setOrg(updated);
    setStatus("Organization saved");
  }

  async function connect(provider: "google" | "microsoft") {
    const { url } = await apiFetch<{ url: string }>(`/calendar/connect?provider=${provider}`);
    window.location.href = url;
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Onboarding</h1>
            <p className="text-sm text-muted-foreground">Configure the workspace baseline</p>
          </div>
          <Button onClick={() => router.replace("/dashboard")}>
            <CheckCircle2 className="h-4 w-4" />
            Finish
          </Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Organization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={saveOrg}>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input name="name" defaultValue={org?.name} required />
                </div>
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Input name="domain" defaultValue={org?.domain ?? ""} />
                </div>
                <Button type="submit">Save</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarPlus className="h-4 w-4" />
                Calendar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="outline" onClick={() => connect("google")}>
                Google Calendar
              </Button>
              <Button className="w-full" variant="outline" onClick={() => connect("microsoft")}>
                Microsoft Graph
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Cost Model
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={saveOrg}>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select name="cost_model" defaultValue={org?.cost_model ?? "AVERAGE_HOURLY"}>
                    <option value="AVERAGE_HOURLY">Average hourly rate</option>
                    <option value="SALARY_BANDS">Salary bands</option>
                    <option value="CSV_UPLOAD">CSV upload</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fallback hourly rate</Label>
                  <Input name="default_hourly_rate" type="number" defaultValue={org?.default_hourly_rate ?? 75} />
                </div>
                <input type="hidden" name="name" value={org?.name ?? ""} />
                <input type="hidden" name="domain" value={org?.domain ?? ""} />
                <Button type="submit">Save model</Button>
              </form>
            </CardContent>
          </Card>
        </div>
        {status ? <p className="mt-4 text-sm text-emerald-700">{status}</p> : null}
      </AppShell>
    </AuthGuard>
  );
}
