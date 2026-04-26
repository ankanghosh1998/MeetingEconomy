import type { NextFunction, Request, Response } from "express";
import { prisma } from "@meetingeconomy/db";
import { AppError } from "../lib/errors";
import { verifyAuthToken } from "../lib/jwt";

export type AuthedRequest = Request & {
  user: {
    userId: string;
    orgId: string;
    role: "ADMIN" | "MANAGER" | "MEMBER";
  };
};

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError(401, "Missing Bearer token.", "AUTH_REQUIRED"));
  }

  try {
    const payload = verifyAuthToken(header.slice(7));
    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        orgId: payload.orgId
      },
      select: {
        id: true,
        orgId: true,
        role: true
      }
    });
    if (!user) throw new AppError(401, "Token no longer valid.", "INVALID_TOKEN");
    (req as AuthedRequest).user = {
      userId: user.id,
      orgId: user.orgId,
      role: user.role
    };
    return next();
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError(401, "Invalid token.", "INVALID_TOKEN"));
  }
}
