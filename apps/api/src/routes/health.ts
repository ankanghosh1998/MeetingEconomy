import { Router } from "express";
import { prisma } from "@meetingeconomy/db";
import { env } from "../config/env";
import { getRedisConnection } from "../jobs/queue";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "meetingeconomy-api",
    timestamp: new Date().toISOString()
  });
});

healthRouter.get("/live", (_req, res) => {
  res.json({
    ok: true,
    service: "meetingeconomy-api",
    timestamp: new Date().toISOString()
  });
});

healthRouter.get("/ready", async (_req, res) => {
  const checks: Record<string, boolean> = {
    database: false,
    redis: !env.READINESS_CHECK_REDIS
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  if (env.READINESS_CHECK_REDIS) {
    try {
      await getRedisConnection().ping();
      checks.redis = true;
    } catch {
      checks.redis = false;
    }
  }

  const ok = Object.values(checks).every(Boolean);
  res.status(ok ? 200 : 503).json({
    ok,
    checks,
    timestamp: new Date().toISOString()
  });
});
