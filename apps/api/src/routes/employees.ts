import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { prisma } from "@meetingeconomy/db";
import { z } from "zod";
import { normalizeEmail } from "../lib/crypto";
import { AppError, asyncHandler } from "../lib/errors";
import { authMiddleware, type AuthedRequest } from "../middleware/auth";
import { roleMiddleware } from "../middleware/role";
import { validate } from "../middleware/validate";
import { resolveHourlyRate, recalculateOrganizationCosts } from "../services/costEngine";
import { enqueueCostRecalculation } from "../jobs/queue";

export const employeesRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

employeesRouter.use(authMiddleware);

function safeNumber(input: unknown) {
  if (input === null || input === undefined || input === "") return undefined;
  const parsed = Number(String(input).replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function refreshCosts(orgId: string) {
  try {
    await enqueueCostRecalculation(orgId, { removeOnComplete: 100, removeOnFail: 200 });
  } catch {
    await recalculateOrganizationCosts(orgId);
  }
}

function maskEmployee(employee: {
  id: string;
  userId: string;
  salary: unknown;
  hourlyRate: unknown;
  department: string | null;
  user: { name: string; email: string };
  role: { title: string; minSalary: unknown; maxSalary: unknown; hourlyRate: unknown } | null;
  rateSource?: "employee" | "role" | "organization" | "fallback";
}) {
  return {
    id: employee.id,
    user_id: employee.userId,
    name: employee.user.name,
    email: employee.user.email,
    role_title: employee.role?.title ?? null,
    department: employee.department,
    has_salary: employee.salary !== null,
    has_hourly_rate: employee.hourlyRate !== null,
    rate_source: employee.rateSource ?? "fallback"
  };
}

employeesRouter.get(
  "/",
  roleMiddleware("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: authed.user.orgId }
    });
    const employees = await prisma.employee.findMany({
      where: {
        user: {
          orgId: authed.user.orgId
        }
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        role: true
      },
      orderBy: {
        user: {
          name: "asc"
        }
      }
    });

    res.json({
      employees: employees.map((employee) => {
        const rate = resolveHourlyRate({
          employee,
          orgDefaultHourlyRate: org.defaultHourlyRate,
          costModel: org.costModel
        });
        return maskEmployee({ ...employee, rateSource: rate.source });
      })
    });
  })
);

employeesRouter.post(
  "/upload",
  roleMiddleware("ADMIN"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    if (!req.file) {
      throw new AppError(400, "CSV file is required.", "CSV_REQUIRED");
    }

    const records = parse(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as Array<Record<string, string>>;

    let imported = 0;
    for (const row of records) {
      const name = row.Name || row.name;
      const email = row.Email || row.email;
      const roleTitle = row.Role || row.role;
      const salary = safeNumber(row.Salary || row.salary);

      if (!name || !email) continue;

      const role = roleTitle
        ? await prisma.role.upsert({
            where: {
              orgId_title: {
                orgId: authed.user.orgId,
                title: roleTitle
              }
            },
            update: {},
            create: {
              orgId: authed.user.orgId,
              title: roleTitle
            }
          })
        : null;

      const user = await prisma.user.upsert({
        where: { email: normalizeEmail(email) },
        update: { name },
        create: {
          name,
          email: normalizeEmail(email),
          orgId: authed.user.orgId,
          role: "MEMBER"
        }
      });

      await prisma.employee.upsert({
        where: { userId: user.id },
        update: {
          roleId: role?.id,
          salary
        },
        create: {
          userId: user.id,
          roleId: role?.id,
          salary
        }
      });
      imported += 1;
    }

    await prisma.auditLog.create({
      data: {
        orgId: authed.user.orgId,
        userId: authed.user.userId,
        action: "employees.csv_upload",
        metadata: { imported }
      }
    });

    await refreshCosts(authed.user.orgId);
    res.json({ imported });
  })
);

const updateEmployeeSchema = z.object({
  role_id: z.string().nullable().optional(),
  salary: z.coerce.number().positive().nullable().optional(),
  hourly_rate: z.coerce.number().positive().nullable().optional(),
  department: z.string().nullable().optional()
});

const roleSchema = z.object({
  title: z.string().min(2),
  min_salary: z.coerce.number().positive().nullable().optional(),
  max_salary: z.coerce.number().positive().nullable().optional(),
  hourly_rate: z.coerce.number().positive().nullable().optional()
});

employeesRouter.get(
  "/roles",
  roleMiddleware("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const roles = await prisma.role.findMany({
      where: { orgId: authed.user.orgId },
      orderBy: { title: "asc" }
    });
    res.json({
      roles: roles.map((role) => ({
        id: role.id,
        title: role.title,
        min_salary: role.minSalary ? Number(role.minSalary) : null,
        max_salary: role.maxSalary ? Number(role.maxSalary) : null,
        hourly_rate: role.hourlyRate ? Number(role.hourlyRate) : null
      }))
    });
  })
);

employeesRouter.post(
  "/roles",
  roleMiddleware("ADMIN"),
  validate({ body: roleSchema }),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const role = await prisma.role.create({
      data: {
        orgId: authed.user.orgId,
        title: req.body.title,
        minSalary: req.body.min_salary,
        maxSalary: req.body.max_salary,
        hourlyRate: req.body.hourly_rate
      }
    });
    await refreshCosts(authed.user.orgId);
    res.status(201).json({
      role: {
        id: role.id,
        title: role.title,
        min_salary: role.minSalary ? Number(role.minSalary) : null,
        max_salary: role.maxSalary ? Number(role.maxSalary) : null,
        hourly_rate: role.hourlyRate ? Number(role.hourlyRate) : null
      }
    });
  })
);

employeesRouter.put(
  "/roles/:id",
  roleMiddleware("ADMIN"),
  validate({ params: z.object({ id: z.string() }), body: roleSchema.partial() }),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const roleId = String(req.params.id);
    const existing = await prisma.role.findFirst({
      where: {
        id: roleId,
        orgId: authed.user.orgId
      }
    });
    if (!existing) throw new AppError(404, "Role not found.", "ROLE_NOT_FOUND");

    const role = await prisma.role.update({
      where: {
        id: existing.id
      },
      data: {
        title: req.body.title,
        minSalary: req.body.min_salary,
        maxSalary: req.body.max_salary,
        hourlyRate: req.body.hourly_rate
      }
    });
    await refreshCosts(authed.user.orgId);
    res.json({
      role: {
        id: role.id,
        title: role.title,
        min_salary: role.minSalary ? Number(role.minSalary) : null,
        max_salary: role.maxSalary ? Number(role.maxSalary) : null,
        hourly_rate: role.hourlyRate ? Number(role.hourlyRate) : null
      }
    });
  })
);

employeesRouter.put(
  "/:id",
  roleMiddleware("ADMIN"),
  validate({ params: z.object({ id: z.string() }), body: updateEmployeeSchema }),
  asyncHandler(async (req, res) => {
    const authed = req as AuthedRequest;
    const employeeId = String(req.params.id);
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        user: {
          orgId: authed.user.orgId
        }
      }
    });
    if (!employee) throw new AppError(404, "Employee not found.", "EMPLOYEE_NOT_FOUND");

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        roleId: req.body.role_id,
        salary: req.body.salary,
        hourlyRate: req.body.hourly_rate,
        department: req.body.department
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        role: true
      }
    });

    await refreshCosts(authed.user.orgId);
    res.json({ employee: maskEmployee(updated) });
  })
);
