"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { MeetingListItem } from "@meetingeconomy/types";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { formatDateTime, money, preciseMoney } from "@/lib/utils";

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await apiFetch<{ meetings: MeetingListItem[] }>("/meetings");
    setMeetings(data.meetings);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  return (
    <AuthGuard>
      <AppShell>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Meetings</h1>
            <p className="text-sm text-muted-foreground">Imported calendar events with computed cost</p>
          </div>
          <Button variant="outline" onClick={() => load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>All Meetings</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meeting</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Attendees</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="text-right">Cost/min</TableHead>
                  <TableHead className="text-right">Total</TableHead>
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
                    <TableCell>{meeting.attendee_count}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {meeting.is_large ? <Badge variant="danger">Large</Badge> : null}
                        {meeting.is_long ? <Badge variant="warning">Long</Badge> : null}
                        {meeting.is_recurring ? <Badge>Recurring</Badge> : null}
                        {!meeting.is_large && !meeting.is_long && !meeting.is_recurring ? <Badge variant="muted">Clean</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{preciseMoney(meeting.cost_per_minute)}</TableCell>
                    <TableCell className="text-right font-medium">{money(meeting.total_cost)}</TableCell>
                  </TableRow>
                ))}
                {!loading && !meetings.length ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={6}>
                      No meetings imported yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </AppShell>
    </AuthGuard>
  );
}
