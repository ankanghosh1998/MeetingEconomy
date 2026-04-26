import type { NextFunction, Request, Response } from "express";
import { isProduction } from "../config/env";

export function httpsOnly(req: Request, res: Response, next: NextFunction) {
  if (!isProduction) return next();
  const proto = req.header("x-forwarded-proto");
  if (proto && proto !== "https") {
    return res.redirect(308, `https://${req.header("host")}${req.originalUrl}`);
  }
  next();
}
