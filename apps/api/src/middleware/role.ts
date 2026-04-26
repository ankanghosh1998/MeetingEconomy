import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@meetingeconomy/types";
import type { AuthedRequest } from "./auth";
import { AppError } from "../lib/errors";

export function roleMiddleware(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authed = req as AuthedRequest;
    if (!allowed.includes(authed.user.role)) {
      return next(new AppError(403, "You do not have access to this resource.", "FORBIDDEN"));
    }
    next();
  };
}
