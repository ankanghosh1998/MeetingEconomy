import { Router } from "express";
import { CostModel, prisma } from "@meetingeconomy/db";
import { z } from "zod";
import { asyncHandler } from "../lib/errors";
import { authMiddleware, type AuthedRequest } from "../middleware/auth";
import { roleMiddleware } from "../middleware/role";
import { validate } from "../middleware/validate";

export const orgRouter = Router();

orgRouter.use(authMiddleware);

const updateOrgSchema = z.object({
  name: z.string().min(2).optional(),
  domain: z.string().min(2).optional(),
  cost_model: z.nativeEnum(CostModel).optional(),
  default_hourly_rate: z.coerce.number().positive().optional(),
  currency: z.string().min(3).max(3).optional()
});

orgRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: authed.user.orgId },
      select: {
        id: true,
        name: true,
        domain: true,
        costModel: true,
        defaultHourlyRate: true,
        currency: true
      }
    });

    res.json({
      id: org.id,
      name: org.name,
      domain: org.domain,
      cost_model: org.costModel,
      default_hourly_rate: Number(org.defaultHourlyRate),
      currency: org.currency
    });
  })
);

orgRouter.put(
  "/",
  roleMiddleware("ADMIN"),
  validate({ body: updateOrgSchema }),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const org = await prisma.organization.update({
      where: { id: authed.user.orgId },
      data: {
        name: req.body.name,
        domain: req.body.domain,
        costModel: req.body.cost_model,
        defaultHourlyRate: req.body.default_hourly_rate,
        currency: req.body.currency
      }
    });

    await prisma.auditLog.create({
      data: {
        orgId: authed.user.orgId,
        userId: authed.user.userId,
        action: "organization.update",
        metadata: req.body
      }
    });

    res.json({
      id: org.id,
      name: org.name,
      domain: org.domain,
      cost_model: org.costModel,
      default_hourly_rate: Number(org.defaultHourlyRate),
      currency: org.currency
    });
  })
);
