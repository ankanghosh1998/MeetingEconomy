"use client";

import { useParams } from "next/navigation";
import { Mail, RefreshCw, Send, Star } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { MeetingDetail } from "@meetingeconomy/types";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { formatDateTime, money, preciseMoney } from "@/lib/utils";

function lines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function MeetingDetailPage() {
  const params = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    const data = await apiFetch<{ meeting: MeetingDetail }>(`/meetings/${params.id}`);
    setMeeting(data.meeting);
    setSummary(data.meeting.summary?.body ?? "");
  }

  useEffect(() => {
    load().catch((error) => setStatus(error instanceof Error ? error.message : "Unable to load meeting"));
  }, [params.id]);

  const averageRating = useMemo(() => {
    if (!meeting?.ratings.length) return null;
    return meeting.ratings.reduce((sum, item) => sum + item.rating, 0) / meeting.ratings.length;
  }, [meeting]);

  async function rate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await apiFetch(`/meetings/${params.id}/rating`, {
      method: "POST",
      body: JSON.stringify({
        rating: Number(form.get("rating")),
        comment: form.get("comment")
      })
    });
    setStatus("Rating saved");
    await load();
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const actionItems = lines(form.get("action_items")).map((task) => ({ task }));
    const data = await apiFetch<{ summary: { body: string }; email: { sent: boolean; provider: string } }>(
      `/meetings/${params.id}/summary`,
      {
        method: "POST",
        body: JSON.stringify({
          key_points: lines(form.get("key_points")),
          decisions: lines(form.get("decisions")),
          action_items: actionItems,
          send_email: form.get("send_email") === "on"
        })
      }
    );
    setSummary(data.summary.body);
    setStatus(data.email.sent ? `Summary sent via ${data.email.provider}` : "Summary generated");
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{meeting?.title ?? "Meeting"}</h1>
            <p className="text-sm text-muted-foreground">{meeting ? `${formatDateTime(meeting.start_time)} · ${meeting.attendee_count} attendees` : ""}</p>
          </div>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Economics</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs uppercase text-muted-foreground">Total cost</div>
                  <div className="mt-1 text-xl font-semibold">{money(meeting?.total_cost ?? 0)}</div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs uppercase text-muted-foreground">Cost per minute</div>
                  <div className="mt-1 text-xl font-semibold">{preciseMoney(meeting?.cost_per_minute ?? 0)}</div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs uppercase text-muted-foreground">Rating</div>
                  <div className="mt-1 flex items-center gap-1 text-xl font-semibold">
                    {averageRating ? averageRating.toFixed(1) : "N/A"} <Star className="h-4 w-4 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Attendees</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(meeting?.attendees ?? []).map((attendee) => (
                      <TableRow key={attendee.id}>
                        <TableCell>{attendee.name ?? "Unknown"}</TableCell>
                        <TableCell>{attendee.email}</TableCell>
                        <TableCell>
                          <Badge variant={attendee.is_external ? "muted" : "success"}>
                            {attendee.is_external ? "External" : "Internal"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  MOM Generator
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4" onSubmit={generate}>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Key points</Label>
                      <Textarea name="key_points" placeholder="One point per line" />
                    </div>
                    <div className="space-y-2">
                      <Label>Decisions</Label>
                      <Textarea name="decisions" placeholder="One decision per line" />
                    </div>
                    <div className="space-y-2">
                      <Label>Action items</Label>
                      <Textarea name="action_items" placeholder="One action item per line" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input className="h-4 w-4" name="send_email" type="checkbox" />
                    Send email to attendees
                  </label>
                  <Button className="w-fit" type="submit">
                    <Send className="h-4 w-4" />
                    Generate
                  </Button>
                </form>
                {summary ? <pre className="mt-4 whitespace-pre-wrap rounded-md border border-border bg-muted p-3 text-sm">{summary}</pre> : null}
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Flags</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {meeting?.is_large ? <Badge variant="danger">Large</Badge> : null}
                {meeting?.is_long ? <Badge variant="warning">Long</Badge> : null}
                {meeting?.is_recurring ? <Badge>Recurring</Badge> : null}
                {meeting && !meeting.is_large && !meeting.is_long && !meeting.is_recurring ? <Badge variant="muted">Clean</Badge> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={rate}>
                  <div className="space-y-2">
                    <Label>Rating</Label>
                    <Input name="rating" type="number" min={1} max={5} defaultValue={4} />
                  </div>
                  <div className="space-y-2">
                    <Label>Comment</Label>
                    <Textarea name="comment" />
                  </div>
                  <Button type="submit">
                    <Star className="h-4 w-4" />
                    Save rating
                  </Button>
                </form>
              </CardContent>
            </Card>
            {status ? <div className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">{status}</div> : null}
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
