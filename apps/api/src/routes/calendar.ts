import { Router } from "express";
import { CalendarProvider, prisma } from "@meetingeconomy/db";
import { z } from "zod";
import { AppError, asyncHandler } from "../lib/errors";
import { authMiddleware, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { googleCalendarUrl, microsoftCalendarUrl } from "../services/oauth";
import { enqueueCalendarSync } from "../jobs/queue";
import { syncCalendarIntegration } from "../services/calendar";

export const calendarRouter = Router();

calendarRouter.use(authMiddleware);

calendarRouter.get(
  "/connect",
  validate({ query: z.object({ provider: z.enum(["google", "microsoft"]) }) }),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const url =
      req.query.provider === "google"
        ? googleCalendarUrl(authed.user.userId, authed.user.orgId)
        : microsoftCalendarUrl(authed.user.userId, authed.user.orgId);
    res.json({ url });
  })
);

calendarRouter.post(
  "/sync",
  validate({ body: z.object({ provider: z.enum(["google", "microsoft"]).optional() }).default({}) }),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const provider = req.body.provider
      ? req.body.provider === "google"
        ? CalendarProvider.GOOGLE
        : CalendarProvider.MICROSOFT
      : undefined;

    const integrations = await prisma.integration.findMany({
      where: {
        orgId: authed.user.orgId,
        provider
      }
    });
    if (!integrations.length) throw new AppError(404, "No calendar integration connected.", "INTEGRATION_NOT_FOUND");

    const results = [];
    for (const integration of integrations) {
      try {
        const job = await enqueueCalendarSync(integration.id, { removeOnComplete: 100, removeOnFail: 200 });
        results.push({ provider: integration.provider, queued: true, job_id: job.id });
      } catch {
        const imported = await syncCalendarIntegration(integration.id);
        results.push({ provider: integration.provider, queued: false, imported });
      }
    }

    res.status(202).json({ results });
  })
);

calendarRouter.get(
  "/events",
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const meetings = await prisma.meeting.findMany({
      where: {
        orgId: authed.user.orgId,
        ...(req.query.from || req.query.to
          ? {
              startTime: {
                gte: req.query.from ? new Date(String(req.query.from)) : undefined,
                lte: req.query.to ? new Date(String(req.query.to)) : undefined
              }
            }
          : {})
      },
      include: {
        attendees: true
      },
      orderBy: { startTime: "desc" },
      take: 100
    });

    res.json({
      events: meetings.map((meeting) => ({
        meeting_id: meeting.id,
        title: meeting.title,
        start: meeting.startTime.toISOString(),
        end: meeting.endTime.toISOString(),
        organizer_email: meeting.organizerEmail,
        attendees: meeting.attendees.map((attendee) => attendee.email)
      }))
    });
  })
);
