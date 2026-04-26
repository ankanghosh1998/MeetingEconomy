import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma, UserRole } from "@meetingeconomy/db";
import { z } from "zod";
import { env } from "../config/env";
import { emailDomain, normalizeEmail } from "../lib/crypto";
import { AppError, asyncHandler } from "../lib/errors";
import { signAuthToken, verifyOAuthState } from "../lib/jwt";
import { authMiddleware, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { exchangeGoogleCode, fetchGoogleProfile, googleLoginUrl } from "../services/oauth";

export const authRouter = Router();

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  org_name: z.string().min(2).optional(),
  org_domain: z.string().min(2).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const exchangeSchema = z.object({
  code: z.string().min(32)
});

function authUser(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  orgId: string;
  organization: {
    name: string;
  };
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    org_id: user.orgId,
    org_name: user.organization.name
  };
}

function responseForUser(user: Parameters<typeof authUser>[0]) {
  return {
    token: signAuthToken({
      userId: user.id,
      orgId: user.orgId,
      role: user.role
    }),
    user: authUser(user)
  };
}

authRouter.post(
  "/signup",
  validate({ body: signupSchema }),
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new AppError(409, "A user with this email already exists.", "EMAIL_ALREADY_EXISTS");
    }

    const domain = req.body.org_domain ?? emailDomain(email) ?? "meetingeconomy.local";
    const orgName = req.body.org_name ?? `${domain.split(".")[0]} Workspace`;
    const passwordHash = await bcrypt.hash(req.body.password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          domain,
          defaultHourlyRate: 75
        }
      });

      return tx.user.create({
        data: {
          name: req.body.name,
          email,
          passwordHash,
          role: UserRole.ADMIN,
          orgId: org.id,
          employee: {
            create: {
              department: null
            }
          }
        },
        include: {
          organization: true
        }
      });
    });

    res.status(201).json(responseForUser(user));
  })
);

authRouter.post(
  "/oauth/exchange",
  validate({ body: exchangeSchema }),
  asyncHandler(async (req, res) => {
    const exchange = await prisma.authExchange.findUnique({
      where: { code: req.body.code }
    });

    if (!exchange || exchange.expiresAt < new Date()) {
      if (exchange) await prisma.authExchange.delete({ where: { id: exchange.id } });
      throw new AppError(401, "Invalid or expired OAuth exchange code.", "OAUTH_EXCHANGE_EXPIRED");
    }

    await prisma.authExchange.delete({ where: { id: exchange.id } });
    res.json({
      token: exchange.token,
      user: exchange.userJson
    });
  })
);

authRouter.post(
  "/login",
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true }
    });

    if (!user?.passwordHash) {
      throw new AppError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
    }

    const matches = await bcrypt.compare(req.body.password, user.passwordHash);
    if (!matches) {
      throw new AppError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
    }

    res.json(responseForUser(user));
  })
);

authRouter.get(
  "/me",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: authed.user.userId },
      include: { organization: true }
    });
    res.json({ user: authUser(user) });
  })
);

authRouter.get(
  "/google/url",
  asyncHandler(async (_req, res) => {
    res.json({ url: googleLoginUrl() });
  })
);

authRouter.get(
  "/google",
  asyncHandler(async (_req, res) => {
    res.redirect(googleLoginUrl());
  })
);

authRouter.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const code = z.string().parse(req.query.code);
    const state = z.string().parse(req.query.state);
    const parsedState = verifyOAuthState(state);

    if (parsedState.purpose !== "google-login") {
      throw new AppError(400, "Invalid OAuth state.", "INVALID_OAUTH_STATE");
    }

    const tokens = await exchangeGoogleCode(code, env.GOOGLE_REDIRECT_URI ?? `${env.API_URL}/auth/google/callback`);
    const profile = await fetchGoogleProfile(tokens.access_token);
    const email = normalizeEmail(profile.email);
    const domain = emailDomain(email) ?? "google-oauth.local";

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: profile.name
      },
      create: {
        name: profile.name,
        email,
        role: UserRole.ADMIN,
        organization: {
          create: {
            name: `${domain.split(".")[0]} Workspace`,
            domain,
            defaultHourlyRate: 75
          }
        },
        employee: {
          create: {}
        }
      },
      include: {
        organization: true
      }
    });

    const auth = responseForUser(user);
    const exchangeCode = randomBytes(32).toString("base64url");
    await prisma.authExchange.create({
      data: {
        code: exchangeCode,
        token: auth.token,
        userJson: auth.user,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    });

    const redirect = new URL("/oauth/callback", env.WEB_URL);
    redirect.searchParams.set("code", exchangeCode);
    res.redirect(redirect.toString());
  })
);
