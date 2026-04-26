import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
export { Prisma, UserRole, CostModel, CalendarProvider } from "@prisma/client";
export type {
  AuditLog,
  Employee,
  Integration,
  Meeting,
  MeetingAttendee,
  MeetingCost,
  MeetingRating,
  MeetingSummary,
  Organization,
  Role,
  User
} from "@prisma/client";
