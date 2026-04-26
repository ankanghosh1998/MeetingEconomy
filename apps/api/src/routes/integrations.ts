import { Router } from "express";
import { CalendarProvider, prisma } from "@meetingeconomy/db";
import { z } from "zod";
import { env } from "../config/env";
import { AppError, asyncHandler } from "../lib/errors";
import { verifyOAuthState } from "../lib/jwt";
import { encryptSecret } from "../lib/secrets";
import { authMiddleware, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { exchangeGoogleCode, exchangeMicrosoftCode, googleCalendarUrl, microsoftCalendarUrl } from "../services/oauth";
import { enqueueCalendarSync } from "../jobs/queue";
import { syncCalendarIntegration } from "../services/calendar";

export const integrationsRouter = Router();

integrationsRouter.get(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const integrations = await prisma.integration.findMany({
      where: { orgId: authed.user.orgId },
      select: {
        id: true,
        provider: true,
        scope: true,
        expiresAt: true,
        updatedAt: true
      },
      orderBy: { updatedAt: "desc" }
    });
    res.json({
      integrations: integrations.map((integration) => ({
        id: integration.id,
        provider: integration.provider,
        scope: integration.scope,
        expires_at: integration.expiresAt?.toISOString() ?? null,
        updated_at: integration.updatedAt.toISOString()
      }))
    });
  })
);

integrationsRouter.get(
  "/google/connect",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    res.json({ url: googleCalendarUrl(authed.user.userId, authed.user.orgId) });
  })
);

integrationsRouter.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const code = z.string().parse(req.query.code);
    const state = z.string().parse(req.query.state);
    const parsed = verifyOAuthState(state);
    if (parsed.purpose !== "google-calendar" || !parsed.userId || !parsed.orgId) {
      throw new AppError(400, "Invalid Google Calendar OAuth state.", "INVALID_OAUTH_STATE");
    }

    const tokens = await exchangeGoogleCode(
      code,
      env.GOOGLE_CALENDAR_REDIRECT_URI ?? `${env.API_URL}/integrations/google/callback`
    );
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

    const integration = await prisma.integration.upsert({
      where: {
        userId_provider: {
          userId: parsed.userId,
          provider: CalendarProvider.GOOGLE
        }
      },
      update: {
        accessToken: encryptSecret(tokens.access_token)!,
        refreshToken: encryptSecret(tokens.refresh_token),
        expiresAt,
        scope: tokens.scope
      },
      create: {
        orgId: parsed.orgId,
        userId: parsed.userId,
        provider: CalendarProvider.GOOGLE,
        accessToken: encryptSecret(tokens.access_token)!,
        refreshToken: encryptSecret(tokens.refresh_token),
        expiresAt,
        scope: tokens.scope
      }
    });

    try {
      await enqueueCalendarSync(integration.id, { removeOnComplete: 100, removeOnFail: 200 });
    } catch {
      await syncCalendarIntegration(integration.id);
    }

    res.redirect(`${env.WEB_URL}/settings?connected=google`);
  })
);

integrationsRouter.get(
  "/microsoft/connect",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    res.json({ url: microsoftCalendarUrl(authed.user.userId, authed.user.orgId) });
  })
);

integrationsRouter.get(
  "/microsoft/callback",
  asyncHandler(async (req, res) => {
    const code = z.string().parse(req.query.code);
    const state = z.string().parse(req.query.state);
    const parsed = verifyOAuthState(state);
    if (parsed.purpose !== "microsoft-calendar" || !parsed.userId || !parsed.orgId) {
      throw new AppError(400, "Invalid Microsoft OAuth state.", "INVALID_OAUTH_STATE");
    }

    const tokens = await exchangeMicrosoftCode(code);
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

    const integration = await prisma.integration.upsert({
      where: {
        userId_provider: {
          userId: parsed.userId,
          provider: CalendarProvider.MICROSOFT
        }
      },
      update: {
        accessToken: encryptSecret(tokens.access_token)!,
        refreshToken: encryptSecret(tokens.refresh_token),
        expiresAt,
        scope: tokens.scope
      },
      create: {
        orgId: parsed.orgId,
        userId: parsed.userId,
        provider: CalendarProvider.MICROSOFT,
        accessToken: encryptSecret(tokens.access_token)!,
        refreshToken: encryptSecret(tokens.refresh_token),
        expiresAt,
        scope: tokens.scope
      }
    });

    try {
      await enqueueCalendarSync(integration.id, { removeOnComplete: 100, removeOnFail: 200 });
    } catch {
      await syncCalendarIntegration(integration.id);
    }

    res.redirect(`${env.WEB_URL}/settings?connected=microsoft`);
  })
);

integrationsRouter.post(
  "/:provider/sync",
  authMiddleware,
  validate({ params: z.object({ provider: z.enum(["google", "microsoft"]) }) }),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const provider = req.params.provider === "google" ? CalendarProvider.GOOGLE : CalendarProvider.MICROSOFT;
    const integration = await prisma.integration.findFirst({
      where: {
        orgId: authed.user.orgId,
        provider
      }
    });
    if (!integration) throw new AppError(404, "Integration not connected.", "INTEGRATION_NOT_FOUND");

    try {
      const job = await enqueueCalendarSync(integration.id, { removeOnComplete: 100, removeOnFail: 200 });
      res.status(202).json({ queued: true, job_id: job.id });
    } catch {
      const imported = await syncCalendarIntegration(integration.id);
      res.json({ queued: false, imported });
    }
  })
);

integrationsRouter.get(
  "/calendar/events",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const meetings = await prisma.meeting.findMany({
      where: { orgId: authed.user.orgId },
      include: { attendees: true },
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
