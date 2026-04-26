import type { NextFunction, Response } from "express";
import type { AuthedRequest } from "./auth";
import { AppError } from "../lib/errors";

export function roleMiddleware(...roles: Array<"ADMIN" | "MANAGER" | "MEMBER">) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "Authentication required.", "AUTH_REQUIRED"));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "Insufficient role.", "FORBIDDEN"));
    }
    return next();
  };
}
