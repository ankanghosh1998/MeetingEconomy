import { Router } from "express";
import { prisma } from "@meetingeconomy/db";
import { z } from "zod";
import { hashJson } from "../lib/crypto";
import { AppError, asyncHandler } from "../lib/errors";
import { authMiddleware, type AuthedRequest } from "../middleware/auth";
import { roleMiddleware } from "../middleware/role";
import { validate } from "../middleware/validate";
import { recalculateMeetingCost } from "../services/costEngine";
import { generateMeetingSummary } from "../services/openai";
import { sendEmail, summarySubject } from "../services/email";

export const meetingsRouter = Router();

meetingsRouter.use(authMiddleware);

function numberOrZero(value: unknown) {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

function canAccessAll(role: string) {
  return role === "ADMIN" || role === "MANAGER";
}

function accessibleMeetingWhere(req: AuthedRequest) {
  return {
    orgId: req.user.orgId,
    ...(canAccessAll(req.user.role)
      ? {}
      : {
          attendees: {
            some: {
              userId: req.user.userId
            }
          }
        })
  };
}

function serializeMeetingListItem(meeting: {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  isLarge: boolean;
  isLong: boolean;
  isRecurring: boolean;
  attendees: unknown[];
  cost: { totalCost: unknown; costPerMinute: unknown } | null;
}) {
  return {
    id: meeting.id,
    title: meeting.title,
    start_time: meeting.startTime.toISOString(),
    end_time: meeting.endTime.toISOString(),
    attendee_count: meeting.attendees.length,
    total_cost: numberOrZero(meeting.cost?.totalCost),
    cost_per_minute: numberOrZero(meeting.cost?.costPerMinute),
    is_large: meeting.isLarge,
    is_long: meeting.isLong,
    is_recurring: meeting.isRecurring
  };
}

const listQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  flagged: z.enum(["true", "false"]).optional()
});

meetingsRouter.get(
  "/",
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const meetings = await prisma.meeting.findMany({
      where: {
        ...accessibleMeetingWhere(authed),
        ...(req.query.from || req.query.to
          ? {
              startTime: {
                gte: req.query.from ? new Date(String(req.query.from)) : undefined,
                lte: req.query.to ? new Date(String(req.query.to)) : undefined
              }
            }
          : {}),
        ...(req.query.flagged === "true"
          ? {
              OR: [{ isLarge: true }, { isLong: true }, { isRecurring: true }]
            }
          : {})
      },
      include: {
        attendees: true,
        cost: true
      },
      orderBy: {
        startTime: "desc"
      },
      take: 100
    });

    res.json({ meetings: meetings.map(serializeMeetingListItem) });
  })
);

meetingsRouter.get(
  "/:id",
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const meetingId = String(req.params.id);
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        ...accessibleMeetingWhere(authed)
      },
      include: {
        attendees: true,
        organizer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        cost: true,
        ratings: {
          include: {
            user: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          }
        },
        summaries: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      }
    });

    if (!meeting) throw new AppError(404, "Meeting not found.", "MEETING_NOT_FOUND");

    res.json({
      meeting: {
        ...serializeMeetingListItem(meeting),
        organizer: meeting.organizer,
        attendees: meeting.attendees.map((attendee) => ({
          id: attendee.id,
          name: attendee.name,
          email: attendee.email,
          is_external: attendee.isExternal,
          is_required: attendee.isRequired
        })),
        ratings: meeting.ratings.map((rating) => ({
          id: rating.id,
          rating: rating.rating,
          comment: rating.comment,
          created_at: rating.createdAt.toISOString(),
          user: rating.user
        })),
        summary: meeting.summaries[0]
          ? {
              body: meeting.summaries[0].body,
              created_at: meeting.summaries[0].createdAt.toISOString()
            }
          : null
      }
    });
  })
);

const ratingSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional()
});

meetingsRouter.post(
  "/:id/rating",
  validate({ params: z.object({ id: z.string() }), body: ratingSchema }),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const meetingId = String(req.params.id);
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        ...accessibleMeetingWhere(authed)
      }
    });
    if (!meeting) throw new AppError(404, "Meeting not found.", "MEETING_NOT_FOUND");

    const rating = await prisma.meetingRating.upsert({
      where: {
        meetingId_userId: {
          meetingId: meeting.id,
          userId: authed.user.userId
        }
      },
      update: {
        rating: req.body.rating,
        comment: req.body.comment
      },
      create: {
        meetingId: meeting.id,
        userId: authed.user.userId,
        rating: req.body.rating,
        comment: req.body.comment
      }
    });

    res.status(201).json({
      rating: {
        id: rating.id,
        rating: rating.rating,
        comment: rating.comment,
        created_at: rating.createdAt.toISOString()
      }
    });
  })
);

const summarySchema = z.object({
  key_points: z.array(z.string().min(1)).default([]),
  decisions: z.array(z.string().min(1)).default([]),
  action_items: z
    .array(
      z.object({
        task: z.string().min(1),
        owner: z.string().optional(),
        due_date: z.string().optional()
      })
    )
    .default([]),
  send_email: z.boolean().default(false)
});

meetingsRouter.post(
  "/:id/summary",
  validate({ params: z.object({ id: z.string() }), body: summarySchema }),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const meetingId = String(req.params.id);
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        ...accessibleMeetingWhere(authed)
      },
      include: {
        attendees: true
      }
    });
    if (!meeting) throw new AppError(404, "Meeting not found.", "MEETING_NOT_FOUND");

    const notes = {
      key_points: req.body.key_points,
      decisions: req.body.decisions,
      action_items: req.body.action_items
    };
    const inputHash = hashJson(notes);

    const cached = await prisma.meetingSummary.findUnique({
      where: {
        meetingId_inputHash: {
          meetingId: meeting.id,
          inputHash
        }
      }
    });

    const body =
      cached?.body ??
      (await generateMeetingSummary({
        meeting,
        attendees: meeting.attendees,
        notes
      }));

    const summary =
      cached ??
      (await prisma.meetingSummary.create({
        data: {
          meetingId: meeting.id,
          createdById: authed.user.userId,
          inputHash,
          body
        }
      }));

    const emailResult = req.body.send_email
      ? await sendEmail({
          to: meeting.attendees.map((attendee) => attendee.email),
          subject: summarySubject(meeting.title),
          text: body
        })
      : { sent: false, provider: "none" };

    res.status(201).json({
      summary: {
        id: summary.id,
        body,
        created_at: summary.createdAt.toISOString()
      },
      email: emailResult
    });
  })
);

meetingsRouter.post(
  "/:id/recalculate",
  roleMiddleware("ADMIN", "MANAGER"),
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const meetingId = String(req.params.id);
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        orgId: authed.user.orgId
      }
    });
    if (!meeting) throw new AppError(404, "Meeting not found.", "MEETING_NOT_FOUND");

    const cost = await recalculateMeetingCost(meeting.id);
    res.json({
      cost: {
        total_cost: numberOrZero(cost?.totalCost),
        cost_per_minute: numberOrZero(cost?.costPerMinute),
        duration_minutes: cost?.durationMinutes ?? 0
      }
    });
  })
);
