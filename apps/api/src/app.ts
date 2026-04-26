import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./lib/errors";
import { httpsOnly } from "./middleware/httpsOnly";
import { authRouter } from "./routes/auth";
import { calendarRouter } from "./routes/calendar";
import { dashboardRouter } from "./routes/dashboard";
import { employeesRouter } from "./routes/employees";
import { healthRouter } from "./routes/health";
import { integrationsRouter } from "./routes/integrations";
import { meetingsRouter } from "./routes/meetings";
import { orgRouter } from "./routes/org";
import { reportsRouter } from "./routes/reports";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  app.use(httpsOnly);
  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
      credentials: true
    })
  );
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: env.NODE_ENV === "production" ? 90 : 120,
      standardHeaders: "draft-7",
      legacyHeaders: false
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(pinoHttp({ enabled: env.NODE_ENV !== "test" }));

  app.use("/health", healthRouter);

  app.use("/auth", authRouter);
  app.use("/org", orgRouter);
  app.use("/employees", employeesRouter);
  app.use("/meetings", meetingsRouter);
  app.use("/dashboard", dashboardRouter);
  app.use("/integrations", integrationsRouter);
  app.use("/calendar", calendarRouter);
  app.use("/reports", reportsRouter);

  app.use("/api/auth", authRouter);
  app.use("/api/org", orgRouter);
  app.use("/api/employees", employeesRouter);
  app.use("/api/meetings", meetingsRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/integrations", integrationsRouter);
  app.use("/api/calendar", calendarRouter);
  app.use("/api/reports", reportsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
