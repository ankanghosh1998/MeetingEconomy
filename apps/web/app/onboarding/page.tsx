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
import { StatusBanner } from "@/components/ui/status-banner";
import { apiFetch, errorMessage } from "@/lib/api";

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
  const [orgForm, setOrgForm] = useState({
    name: "",
    domain: "",
    cost_model: "AVERAGE_HOURLY",
    default_hourly_rate: "75"
  });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ variant: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    async function loadOrg() {
      setLoading(true);
      try {
        const data = await apiFetch<Org>("/org");
        setOrg(data);
        setOrgForm({
          name: data.name,
          domain: data.domain ?? "",
          cost_model: data.cost_model,
          default_hourly_rate: String(data.default_hourly_rate)
        });
      } catch (error) {
        setNotice({
          variant: "error",
          message: errorMessage(error, "Unable to load workspace settings.")
        });
      } finally {
        setLoading(false);
      }
    }

    void loadOrg();
  }, []);

  function updateOrgForm(field: keyof typeof orgForm, value: string) {
    setOrgForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function saveOrg(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const updated = await apiFetch<Org>("/org", {
        method: "PUT",
        body: JSON.stringify({
          name: orgForm.name,
          domain: orgForm.domain.trim() || undefined,
          cost_model: orgForm.cost_model,
          default_hourly_rate: Number(orgForm.default_hourly_rate)
        })
      });
      setOrg(updated);
      setOrgForm({
        name: updated.name,
        domain: updated.domain ?? "",
        cost_model: updated.cost_model,
        default_hourly_rate: String(updated.default_hourly_rate)
      });
      setNotice({
        variant: "success",
        message: "Organization saved"
      });
    } catch (error) {
      setNotice({
        variant: "error",
        message: errorMessage(error, "Unable to save organization settings.")
      });
    }
  }

  async function connect(provider: "google" | "microsoft") {
    try {
      const { url } = await apiFetch<{ url: string }>(`/calendar/connect?provider=${provider}`);
      window.location.href = url;
    } catch (error) {
      setNotice({
        variant: "error",
        message: errorMessage(error, `Unable to start the ${provider} calendar connection.`)
      });
    }
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
        {notice ? (
          <StatusBanner className="mb-4" variant={notice.variant}>
            {notice.message}
          </StatusBanner>
        ) : null}
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
                  <Input
                    name="name"
                    value={orgForm.name}
                    onChange={(event) => updateOrgForm("name", event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Input name="domain" value={orgForm.domain} onChange={(event) => updateOrgForm("domain", event.target.value)} />
                </div>
                <Button disabled={loading} type="submit">
                  Save
                </Button>
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
              <Button className="w-full" disabled={loading} variant="outline" onClick={() => void connect("google")}>
                Google Calendar
              </Button>
              <Button className="w-full" disabled={loading} variant="outline" onClick={() => void connect("microsoft")}>
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
                  <Select
                    name="cost_model"
                    value={orgForm.cost_model}
                    onChange={(event) => updateOrgForm("cost_model", event.target.value)}
                  >
                    <option value="AVERAGE_HOURLY">Average hourly rate</option>
                    <option value="SALARY_BANDS">Salary bands</option>
                    <option value="CSV_UPLOAD">CSV upload</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fallback hourly rate</Label>
                  <Input
                    name="default_hourly_rate"
                    type="number"
                    value={orgForm.default_hourly_rate}
                    onChange={(event) => updateOrgForm("default_hourly_rate", event.target.value)}
                  />
                </div>
                <Button disabled={loading} type="submit">
                  Save model
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
