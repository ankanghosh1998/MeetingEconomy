import { Router } from "express";
import bcrypt from "bcryptjs";
import { CostModel, prisma } from "@meetingeconomy/db";
import { z } from "zod";
import { normalizeEmail, randomPasswordPlaceholder } from "../lib/crypto";
import { AppError, asyncHandler } from "../lib/errors";
import { signAuthToken } from "../lib/jwt";
import { authMiddleware, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { exchangeGoogleCode, fetchGoogleProfile, googleLoginUrl } from "../services/oauth";

export const authRouter = Router();

const passwordSchema = z.string().min(8).max(128);
const authBodySchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email(),
  password: passwordSchema,
  org_name: z.string().min(2).max(120).optional(),
  domain: z.string().min(2).max(120).optional()
});

function toAuthResponse(user: {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "MEMBER";
  orgId: string;
  organization: { name: string };
}) {
  const token = signAuthToken({
    userId: user.id,
    orgId: user.orgId,
    role: user.role
  });
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      org_id: user.orgId,
      org_name: user.organization.name
    }
  };
}

authRouter.post(
  "/signup",
  validate({ body: authBodySchema.refine((value) => value.name && value.org_name, "name and org_name are required") }),
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError(409, "User already exists.", "USER_EXISTS");

    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const domain = req.body.domain?.trim() || email.split("@")[1] || "company.local";

    const created = await prisma.organization.create({
      data: {
        name: req.body.org_name,
        domain,
        costModel: CostModel.AVERAGE_HOURLY,
        defaultHourlyRate: 75,
        users: {
          create: {
            name: req.body.name,
            email,
            passwordHash,
            role: "ADMIN"
          }
        }
      },
      include: {
        users: {
          include: {
            organization: true
          }
        }
      }
    });

    const user = created.users[0];
    if (!user) throw new AppError(500, "Unable to create user.");

    res.status(201).json(toAuthResponse(user));
  })
);

const loginSchema = z.object({
  email: z.string().email(),
  password: passwordSchema
});

authRouter.post(
  "/login",
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organization: true
      }
    });
    if (!user || !user.passwordHash) throw new AppError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
    const matches = await bcrypt.compare(req.body.password, user.passwordHash);
    if (!matches) throw new AppError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
    res.json(toAuthResponse(user));
  })
);

authRouter.get(
  "/google",
  asyncHandler(async (req, res) => {
    const redirectTo = typeof req.query.redirectTo === "string" ? req.query.redirectTo : undefined;
    res.json({ url: googleLoginUrl(redirectTo) });
  })
);

authRouter.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const code = z.string().parse(req.query.code);
    const redirectTo = typeof req.query.state === "string" ? decodeURIComponent(req.query.state) : `${process.env.WEB_URL ?? "http://localhost:3000"}/oauth/callback`;
    const tokens = await exchangeGoogleCode(code, process.env.GOOGLE_REDIRECT_URI);
    const profile = await fetchGoogleProfile(tokens.access_token);
    const email = normalizeEmail(profile.email);

    let user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true }
    });

    if (!user) {
      const domain = email.split("@")[1] || "company.local";
      const org = await prisma.organization.create({
        data: {
          name: profile.name ? `${profile.name.split(" ")[0]}'s Organization` : "New Organization",
          domain,
          costModel: CostModel.AVERAGE_HOURLY,
          defaultHourlyRate: 75
        }
      });

      user = await prisma.user.create({
        data: {
          name: profile.name || email.split("@")[0],
          email,
          passwordHash: await bcrypt.hash(randomPasswordPlaceholder(), 12),
          role: "ADMIN",
          orgId: org.id
        },
        include: { organization: true }
      });
    }

    const auth = toAuthResponse(user);
    const exchange = await prisma.authExchange.create({
      data: {
        userId: user.id,
        token: auth.token,
        redirectTo
      }
    });

    const connector = redirectTo.includes("?") ? "&" : "?";
    res.redirect(`${redirectTo}${connector}code=${exchange.code}`);
  })
);

authRouter.get(
  "/google/exchange",
  validate({ query: z.object({ code: z.string().min(8) }) }),
  asyncHandler(async (req, res) => {
    const code = String(req.query.code);
    const exchange = await prisma.authExchange.findUnique({
      where: { code },
      include: {
        user: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!exchange || exchange.usedAt || exchange.expiresAt.getTime() < Date.now()) {
      throw new AppError(400, "Invalid or expired exchange code.", "INVALID_EXCHANGE_CODE");
    }

    await prisma.authExchange.update({
      where: { id: exchange.id },
      data: { usedAt: new Date() }
    });

    res.json({
      token: exchange.token,
      user: {
        id: exchange.user.id,
        name: exchange.user.name,
        email: exchange.user.email,
        role: exchange.user.role,
        org_id: exchange.user.orgId,
        org_name: exchange.user.organization.name
      },
      redirect_to: exchange.redirectTo
    });
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
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        org_id: user.orgId,
        org_name: user.organization.name
      }
    });
  })
);
