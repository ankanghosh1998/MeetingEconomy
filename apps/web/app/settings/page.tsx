"use client";

import { CalendarSync, PlugZap, Save, Upload } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { EmployeePublic, RoleBand } from "@meetingeconomy/types";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { preciseMoney } from "@/lib/utils";

type Org = {
  id: string;
  name: string;
  domain: string | null;
  cost_model: string;
  default_hourly_rate: number;
  currency: string;
};

type Integration = {
  id: string;
  provider: string;
  updated_at: string;
};

export default function SettingsPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [employees, setEmployees] = useState<EmployeePublic[]>([]);
  const [roles, setRoles] = useState<RoleBand[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [status, setStatus] = useState("");

  async function load() {
    const [orgData, employeeData, roleData, integrationData] = await Promise.all([
      apiFetch<Org>("/org"),
      apiFetch<{ employees: EmployeePublic[] }>("/employees").catch(() => ({ employees: [] })),
      apiFetch<{ roles: RoleBand[] }>("/employees/roles").catch(() => ({ roles: [] })),
      apiFetch<{ integrations: Integration[] }>("/integrations").catch(() => ({ integrations: [] }))
    ]);
    setOrg(orgData);
    setEmployees(employeeData.employees);
    setRoles(roleData.roles);
    setIntegrations(integrationData.integrations);
  }

  useEffect(() => {
    load().catch((error) => setStatus(error instanceof Error ? error.message : "Unable to load settings"));
  }, []);

  async function saveOrg(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = await apiFetch<Org>("/org", {
      method: "PUT",
      body: JSON.stringify({
        name: form.get("name"),
        domain: form.get("domain"),
        cost_model: form.get("cost_model"),
        default_hourly_rate: Number(form.get("default_hourly_rate")),
        currency: form.get("currency")
      })
    });
    setOrg(data);
    setStatus("Settings saved");
  }

  async function addRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await apiFetch("/employees/roles", {
      method: "POST",
      body: JSON.stringify({
        title: form.get("title"),
        min_salary: form.get("min_salary") ? Number(form.get("min_salary")) : null,
        max_salary: form.get("max_salary") ? Number(form.get("max_salary")) : null,
        hourly_rate: form.get("hourly_rate") ? Number(form.get("hourly_rate")) : null
      })
    });
    setStatus("Role saved");
    await load();
  }

  async function uploadCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = await apiFetch<{ imported: number }>("/employees/upload", {
      method: "POST",
      body: form
    });
    setStatus(`Imported ${data.imported} employees`);
    await load();
  }

  async function connect(provider: "google" | "microsoft") {
    const { url } = await apiFetch<{ url: string }>(`/integrations/${provider}/connect`);
    window.location.href = url;
  }

  async function sync(provider: "google" | "microsoft") {
    await apiFetch(`/integrations/${provider}/sync`, { method: "POST" });
    setStatus(`${provider} sync queued`);
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="mb-5">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">Workspace controls, integrations, and cost inputs</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Organization</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={saveOrg}>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input name="name" defaultValue={org?.name} />
                  </div>
                  <div className="space-y-2">
                    <Label>Domain</Label>
                    <Input name="domain" defaultValue={org?.domain ?? ""} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Cost model</Label>
                      <Select name="cost_model" defaultValue={org?.cost_model ?? "AVERAGE_HOURLY"}>
                        <option value="AVERAGE_HOURLY">Average hourly rate</option>
                        <option value="SALARY_BANDS">Salary bands</option>
                        <option value="CSV_UPLOAD">CSV upload</option>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Input name="currency" defaultValue={org?.currency ?? "USD"} maxLength={3} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Fallback hourly rate</Label>
                    <Input name="default_hourly_rate" type="number" defaultValue={org?.default_hourly_rate ?? 75} />
                  </div>
                  <Button type="submit">
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Integrations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" onClick={() => connect("google")}>
                    <PlugZap className="h-4 w-4" />
                    Google
                  </Button>
                  <Button variant="outline" onClick={() => connect("microsoft")}>
                    <PlugZap className="h-4 w-4" />
                    Microsoft
                  </Button>
                </div>
                <div className="space-y-2">
                  {integrations.map((integration) => (
                    <div key={integration.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <div className="text-sm font-medium">{integration.provider}</div>
                      <Button size="sm" variant="outline" onClick={() => sync(integration.provider.toLowerCase() as "google" | "microsoft")}>
                        <CalendarSync className="h-3.5 w-3.5" />
                        Sync
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Employee CSV</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="flex flex-col gap-3 sm:flex-row" onSubmit={uploadCsv}>
                  <Input accept=".csv" name="file" type="file" required />
                  <Button type="submit">
                    <Upload className="h-4 w-4" />
                    Upload
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Roles</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="mb-4 grid gap-3 md:grid-cols-4" onSubmit={addRole}>
                  <Input name="title" placeholder="Role" required />
                  <Input name="min_salary" type="number" placeholder="Min salary" />
                  <Input name="max_salary" type="number" placeholder="Max salary" />
                  <Button type="submit">Add</Button>
                </form>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role</TableHead>
                        <TableHead>Band</TableHead>
                        <TableHead>Hourly</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roles.map((role) => (
                        <TableRow key={role.id}>
                          <TableCell>{role.title}</TableCell>
                          <TableCell>
                            {role.min_salary || role.max_salary
                              ? `${role.min_salary ? preciseMoney(role.min_salary) : "N/A"} - ${role.max_salary ? preciseMoney(role.max_salary) : "N/A"}`
                              : "Not set"}
                          </TableCell>
                          <TableCell>{role.hourly_rate ? preciseMoney(role.hourly_rate) : "Derived"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Employees</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Cost Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell>{employee.name}</TableCell>
                        <TableCell>{employee.email}</TableCell>
                        <TableCell>{employee.role_title ?? "Unassigned"}</TableCell>
                        <TableCell>{employee.department ?? "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant={employee.has_salary || employee.has_hourly_rate ? "success" : "muted"}>
                            {employee.rate_source}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
        {status ? <p className="mt-4 text-sm text-muted-foreground">{status}</p> : null}
      </AppShell>
    </AuthGuard>
  );
}
