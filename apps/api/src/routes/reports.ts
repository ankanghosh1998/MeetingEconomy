import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { authMiddleware, type AuthedRequest } from "../middleware/auth";
import { roleMiddleware } from "../middleware/role";
import { getDashboardForOrg } from "../services/dashboard";

export const reportsRouter = Router();

reportsRouter.use(authMiddleware);

reportsRouter.get(
  "/weekly",
  roleMiddleware("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const dashboard = await getDashboardForOrg(authed.user.orgId);
    if (req.query.format === "csv") {
      const rows = [
        ["metric", "value"],
        ["total_cost", dashboard.total_cost],
        ["total_hours", dashboard.total_hours],
        ["avg_cost_per_meeting", dashboard.avg_cost_per_meeting],
        ["flagged_cost", dashboard.flagged_cost]
      ];
      res.header("content-type", "text/csv");
      res.attachment("meetingeconomy-weekly-report.csv");
      return res.send(rows.map((row) => row.join(",")).join("\n"));
    }
    res.json(dashboard);
  })
);
