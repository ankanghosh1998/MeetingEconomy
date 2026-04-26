import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export function httpsOnly(req: Request, _res: Response, next: NextFunction) {
  if (env.NODE_ENV !== "production") return next();
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (forwardedProto === "https") return next();
  return next(new Error("HTTPS is required in production."));
}
