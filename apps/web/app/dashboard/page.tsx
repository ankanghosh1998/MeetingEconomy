"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, DollarSign, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import type { DashboardResponse, MeetingListItem } from "@meetingeconomy/types";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { CostChart } from "@/components/charts/cost-chart";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { formatDateTime, hours, money } from "@/lib/utils";

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);

  useEffect(() => {
    apiFetch<DashboardResponse>("/dashboard/company")
      .catch(() => apiFetch<DashboardResponse>("/dashboard/user"))
      .then(setDashboard)
      .catch(() => null);
    apiFetch<{ meetings: MeetingListItem[] }>("/meetings?flagged=true")
      .then((data) => setMeetings(data.meetings.slice(0, 5)))
      .catch(() => null);
  }, []);

  return (
    <AuthGuard>
      <AppShell>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Company meeting cost and waste signals</p>
          </div>
          <Link className="text-sm font-medium text-primary" href="/meetings">
            View meetings
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total cost" value={money(dashboard?.total_cost ?? 0)} icon={DollarSign} />
          <MetricCard label="Meeting hours" value={hours(dashboard?.total_hours ?? 0)} icon={CalendarClock} />
          <MetricCard label="Average cost" value={money(dashboard?.avg_cost_per_meeting ?? 0)} icon={TrendingUp} tone="success" />
          <MetricCard label="Flagged cost" value={money(dashboard?.flagged_cost ?? 0)} icon={AlertTriangle} tone="warning" />
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Cost Trend</CardTitle>
            </CardHeader>
            <CardContent>{dashboard ? <CostChart data={dashboard.trends} /> : <div className="h-72" />}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Waste Flags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(dashboard?.breakdowns.by_flags ?? []).map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.meeting_count} meetings · {hours(item.total_hours)}</div>
                  </div>
                  <div className="text-sm font-semibold">{money(item.total_cost)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Flagged Meetings</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meeting</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meetings.map((meeting) => (
                  <TableRow key={meeting.id}>
                    <TableCell>
                      <Link className="font-medium text-primary" href={`/meetings/${meeting.id}`}>
                        {meeting.title}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDateTime(meeting.start_time)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {meeting.is_large ? <Badge variant="danger">Large</Badge> : null}
                        {meeting.is_long ? <Badge variant="warning">Long</Badge> : null}
                        {meeting.is_recurring ? <Badge>Recurring</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{money(meeting.total_cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </AppShell>
    </AuthGuard>
  );
}
