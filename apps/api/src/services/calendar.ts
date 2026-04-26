import { CalendarProvider, prisma, type Integration } from "@meetingeconomy/db";
import { env } from "../config/env";
import { emailDomain, normalizeEmail } from "../lib/crypto";
import { AppError } from "../lib/errors";
import { decryptSecret } from "../lib/secrets";
import { recalculateMeetingCost } from "./costEngine";

type NormalizedCalendarEvent = {
  externalId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  organizerEmail: string | null;
  attendees: Array<{
    email: string;
    name?: string | null;
    isRequired?: boolean;
  }>;
  isRecurring: boolean;
};

function windowParams() {
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const to = new Date();
  to.setDate(to.getDate() + 60);
  return { from, to };
}

function parseGoogleDate(input: { date?: string; dateTime?: string }) {
  if (input.dateTime) return { date: new Date(input.dateTime), allDay: false };
  if (input.date) return { date: new Date(`${input.date}T00:00:00.000Z`), allDay: true };
  return { date: new Date(), allDay: false };
}

function parseMicrosoftDate(input: { dateTime: string; timeZone?: string }) {
  return new Date(`${input.dateTime.endsWith("Z") ? input.dateTime : `${input.dateTime}Z`}`);
}

async function fetchGoogleEvents(integration: Integration): Promise<NormalizedCalendarEvent[]> {
  const accessToken = decryptSecret(integration.accessToken);
  const { from, to } = windowParams();
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", from.toISOString());
  url.searchParams.set("timeMax", to.toISOString());

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new AppError(502, "Google Calendar sync failed.", "CALENDAR_SYNC_FAILED");
  }

  const payload = (await response.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      start?: { date?: string; dateTime?: string };
      end?: { date?: string; dateTime?: string };
      organizer?: { email?: string; displayName?: string };
      attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string; optional?: boolean }>;
      recurringEventId?: string;
      recurrence?: string[];
    }>;
  };

  return (payload.items ?? [])
    .filter((event) => event.start && event.end)
    .map((event) => {
      const start = parseGoogleDate(event.start!);
      const end = parseGoogleDate(event.end!);
      const organizerEmail = event.organizer?.email ? normalizeEmail(event.organizer.email) : null;
      return {
        externalId: event.id,
        title: event.summary || "Untitled meeting",
        startTime: start.date,
        endTime: end.date,
        isAllDay: start.allDay || end.allDay,
        organizerEmail,
        attendees: (event.attendees ?? [])
          .filter((attendee) => attendee.email)
          .map((attendee) => ({
            email: normalizeEmail(attendee.email!),
            name: attendee.displayName ?? null,
            isRequired: !attendee.optional
          })),
        isRecurring: Boolean(event.recurringEventId || event.recurrence?.length)
      };
    });
}

async function fetchMicrosoftEvents(integration: Integration): Promise<NormalizedCalendarEvent[]> {
  const accessToken = decryptSecret(integration.accessToken);
  const { from, to } = windowParams();
  const url = new URL("https://graph.microsoft.com/v1.0/me/events");
  url.searchParams.set("$select", "id,subject,start,end,organizer,attendees,isAllDay,recurrence");
  url.searchParams.set("$top", "100");
  url.searchParams.set("$filter", `start/dateTime ge '${from.toISOString()}' and start/dateTime le '${to.toISOString()}'`);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new AppError(502, "Microsoft Graph calendar sync failed.", "CALENDAR_SYNC_FAILED");
  }

  const payload = (await response.json()) as {
    value?: Array<{
      id: string;
      subject?: string;
      start: { dateTime: string; timeZone?: string };
      end: { dateTime: string; timeZone?: string };
      isAllDay?: boolean;
      recurrence?: unknown;
      organizer?: { emailAddress?: { address?: string; name?: string } };
      attendees?: Array<{ emailAddress?: { address?: string; name?: string }; type?: string }>;
    }>;
  };

  return (payload.value ?? []).map((event) => {
    const organizerEmail = event.organizer?.emailAddress?.address
      ? normalizeEmail(event.organizer.emailAddress.address)
      : null;
    return {
      externalId: event.id,
      title: event.subject || "Untitled meeting",
      startTime: parseMicrosoftDate(event.start),
      endTime: parseMicrosoftDate(event.end),
      isAllDay: Boolean(event.isAllDay),
      organizerEmail,
      attendees: (event.attendees ?? [])
        .filter((attendee) => attendee.emailAddress?.address)
        .map((attendee) => ({
          email: normalizeEmail(attendee.emailAddress!.address!),
          name: attendee.emailAddress?.name ?? null,
          isRequired: attendee.type !== "optional"
        })),
      isRecurring: Boolean(event.recurrence)
    };
  });
}

function isExternal(email: string, orgDomain?: string | null) {
  if (!orgDomain) return false;
  return emailDomain(email) !== orgDomain;
}

export async function importCalendarEvents(input: {
  orgId: string;
  provider: CalendarProvider;
  events: NormalizedCalendarEvent[];
}) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.orgId }
  });

  let imported = 0;

  for (const event of input.events) {
    const attendeeEmails = Array.from(new Set(event.attendees.map((attendee) => normalizeEmail(attendee.email))));
    const users = await prisma.user.findMany({
      where: {
        orgId: input.orgId,
        email: {
          in: attendeeEmails
        }
      },
      select: {
        id: true,
        email: true
      }
    });
    const usersByEmail = new Map(users.map((user) => [normalizeEmail(user.email), user]));
    const organizer = event.organizerEmail
      ? await prisma.user.findFirst({
          where: {
            orgId: input.orgId,
            email: event.organizerEmail
          },
          select: {
            id: true
          }
        })
      : null;

    const meeting = await prisma.meeting.upsert({
      where: {
        orgId_provider_externalId: {
          orgId: input.orgId,
          provider: input.provider,
          externalId: event.externalId
        }
      },
      update: {
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        isAllDay: event.isAllDay,
        organizerId: organizer?.id ?? null,
        organizerEmail: event.organizerEmail,
        isLarge: event.attendees.length > 8,
        isLong: Math.round((event.endTime.getTime() - event.startTime.getTime()) / 60_000) > 60,
        isRecurring: event.isRecurring
      },
      create: {
        orgId: input.orgId,
        provider: input.provider,
        externalId: event.externalId,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        isAllDay: event.isAllDay,
        organizerId: organizer?.id ?? null,
        organizerEmail: event.organizerEmail,
        isLarge: event.attendees.length > 8,
        isLong: Math.round((event.endTime.getTime() - event.startTime.getTime()) / 60_000) > 60,
        isRecurring: event.isRecurring
      }
    });

    await prisma.meetingAttendee.deleteMany({ where: { meetingId: meeting.id } });
    if (event.attendees.length) {
      await prisma.meetingAttendee.createMany({
        data: event.attendees.map((attendee) => {
          const email = normalizeEmail(attendee.email);
          const user = usersByEmail.get(email);
          return {
            meetingId: meeting.id,
            email,
            name: attendee.name,
            userId: user?.id ?? null,
            isRequired: attendee.isRequired ?? true,
            isExternal: isExternal(email, org.domain)
          };
        }),
        skipDuplicates: true
      });
    }

    await recalculateMeetingCost(meeting.id);
    imported += 1;
  }

  return imported;
}

export async function syncCalendarIntegration(integrationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId }
  });

  if (!integration) {
    throw new AppError(404, "Calendar integration not found.", "INTEGRATION_NOT_FOUND");
  }

  const events =
    integration.provider === CalendarProvider.GOOGLE
      ? await fetchGoogleEvents(integration)
      : await fetchMicrosoftEvents(integration);

  const imported = await importCalendarEvents({
    orgId: integration.orgId,
    provider: integration.provider,
    events
  });

  await prisma.auditLog.create({
    data: {
      orgId: integration.orgId,
      userId: integration.userId,
      action: "calendar.sync",
      metadata: {
        provider: integration.provider,
        imported
      }
    }
  });

  return imported;
}

export async function syncAllCalendarIntegrations() {
  const integrations = await prisma.integration.findMany();
  let imported = 0;
  for (const integration of integrations) {
    imported += await syncCalendarIntegration(integration.id);
  }
  return imported;
}
