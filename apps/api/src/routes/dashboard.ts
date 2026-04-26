import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { authMiddleware, type AuthedRequest } from "../middleware/auth";
import { roleMiddleware } from "../middleware/role";
import { getDashboardForOrg } from "../services/dashboard";

export const dashboardRouter = Router();

dashboardRouter.use(authMiddleware);

dashboardRouter.get(
  "/company",
  roleMiddleware("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    res.json(await getDashboardForOrg(authed.user.orgId));
  })
);

dashboardRouter.get(
  "/user",
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    res.json(await getDashboardForOrg(authed.user.orgId, authed.user.userId));
  })
);

dashboardRouter.get(
  "/team",
  roleMiddleware("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    res.json(await getDashboardForOrg(authed.user.orgId));
  })
);
