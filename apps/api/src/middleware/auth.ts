import type { NextFunction, Request, Response } from "express";
import type { AuthTokenPayload } from "../lib/jwt";
import { AppError } from "../lib/errors";
import { verifyAuthToken as verify } from "../lib/jwt";

export type AuthedRequest = Request & {
  user: AuthTokenPayload;
};

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    return next(new AppError(401, "Missing bearer token.", "UNAUTHORIZED"));
  }

  try {
    (req as AuthedRequest).user = verify(token);
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token.", "UNAUTHORIZED"));
  }
}
