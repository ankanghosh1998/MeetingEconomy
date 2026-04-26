import { prisma } from "@meetingeconomy/db";
import type { BreakdownPoint, DashboardResponse, TrendPoint } from "@meetingeconomy/types";

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

function meetingHours(meeting: { cost: { durationMinutes: number } | null }) {
  return (meeting.cost?.durationMinutes ?? 0) / 60;
}

function weekKey(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start.toISOString().slice(0, 10);
}

function lastTwelveWeeks() {
  const now = new Date();
  const current = new Date(now);
  current.setHours(0, 0, 0, 0);
  current.setDate(current.getDate() - current.getDay());

  return Array.from({ length: 12 }, (_, index) => {
    const week = new Date(current);
    week.setDate(current.getDate() - (11 - index) * 7);
    return week.toISOString().slice(0, 10);
  });
}

function emptyTrend(label: string): TrendPoint {
  return {
    label,
    total_cost: 0,
    total_hours: 0,
    meeting_count: 0
  };
}

function addBreakdown(map: Map<string, BreakdownPoint>, label: string, cost: number, hours: number) {
  const current = map.get(label) ?? {
    label,
    total_cost: 0,
    total_hours: 0,
    meeting_count: 0
  };
  current.total_cost += cost;
  current.total_hours += hours;
  current.meeting_count += 1;
  map.set(label, current);
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function getDashboardForOrg(orgId: string, userId?: string): Promise<DashboardResponse> {
  const meetings = await prisma.meeting.findMany({
    where: {
      orgId,
      ...(userId
        ? {
            attendees: {
              some: {
                userId
              }
            }
          }
        : {})
    },
    include: {
      cost: true,
      organizer: {
        select: {
          name: true,
          email: true
        }
      }
    },
    orderBy: {
      startTime: "asc"
    }
  });

  const trendLabels = lastTwelveWeeks();
  const trends = new Map<string, TrendPoint>(trendLabels.map((label) => [label, emptyTrend(label)]));
  const byOrganizer = new Map<string, BreakdownPoint>();
  const byFlags = new Map<string, BreakdownPoint>();

  let totalCost = 0;
  let totalHours = 0;
  let flaggedCost = 0;

  for (const meeting of meetings) {
    const cost = toNumber(meeting.cost?.totalCost);
    const hours = meetingHours(meeting);
    totalCost += cost;
    totalHours += hours;

    const trend = trends.get(weekKey(meeting.startTime));
    if (trend) {
      trend.total_cost += cost;
      trend.total_hours += hours;
      trend.meeting_count += 1;
    }

    const organizer = meeting.organizer?.name ?? meeting.organizerEmail ?? "Unknown";
    addBreakdown(byOrganizer, organizer, cost, hours);

    const flags = [
      meeting.isLarge ? "Large" : null,
      meeting.isLong ? "Long" : null,
      meeting.isRecurring ? "Recurring" : null
    ].filter(Boolean) as string[];

    if (flags.length) flaggedCost += cost;
    for (const flag of flags.length ? flags : ["Unflagged"]) {
      addBreakdown(byFlags, flag, cost, hours);
    }
  }

  return {
    total_cost: round(totalCost),
    total_hours: round(totalHours),
    avg_cost_per_meeting: meetings.length ? round(totalCost / meetings.length) : 0,
    flagged_cost: round(flaggedCost),
    trends: Array.from(trends.values()).map((point) => ({
      ...point,
      total_cost: round(point.total_cost),
      total_hours: round(point.total_hours)
    })),
    breakdowns: {
      by_organizer: Array.from(byOrganizer.values())
        .map((point) => ({
          ...point,
          total_cost: round(point.total_cost),
          total_hours: round(point.total_hours)
        }))
        .sort((a, b) => b.total_cost - a.total_cost)
        .slice(0, 8),
      by_flags: Array.from(byFlags.values()).map((point) => ({
        ...point,
        total_cost: round(point.total_cost),
        total_hours: round(point.total_hours)
      }))
    }
  };
}
