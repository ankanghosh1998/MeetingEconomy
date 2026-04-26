import { prisma, type CostModel, type Prisma } from "@meetingeconomy/db";

const MIN_MEETING_MINUTES = 5;
const ALL_DAY_CAP_MINUTES = 8 * 60;

export type CostAttendeeInput = {
  hourlyRate: number | null;
  isExternal?: boolean;
};

export type CostCalculationInput = {
  startTime: Date;
  endTime: Date;
  isAllDay?: boolean;
  attendees: CostAttendeeInput[];
};

export type CostCalculationResult = {
  ignored: boolean;
  durationMinutes: number;
  costPerMinute: number;
  totalCost: number;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeDurationMinutes(startTime: Date, endTime: Date, isAllDay = false) {
  const rawMinutes = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60_000));
  return isAllDay ? Math.min(rawMinutes || ALL_DAY_CAP_MINUTES, ALL_DAY_CAP_MINUTES) : rawMinutes;
}

export function calculateMeetingCost(input: CostCalculationInput): CostCalculationResult {
  const durationMinutes = normalizeDurationMinutes(input.startTime, input.endTime, input.isAllDay);

  if (durationMinutes < MIN_MEETING_MINUTES) {
    return {
      ignored: true,
      durationMinutes,
      costPerMinute: 0,
      totalCost: 0
    };
  }

  const internalHourlySum = input.attendees.reduce((sum, attendee) => {
    if (attendee.isExternal) return sum;
    return sum + Math.max(0, attendee.hourlyRate ?? 0);
  }, 0);

  const costPerMinute = internalHourlySum / 60;
  return {
    ignored: false,
    durationMinutes,
    costPerMinute: roundMoney(costPerMinute),
    totalCost: roundMoney(costPerMinute * durationMinutes)
  };
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : Number(value);
}

export function resolveHourlyRate(input: {
  employee?: {
    salary: Prisma.Decimal | number | null;
    hourlyRate: Prisma.Decimal | number | null;
    role?: {
      minSalary: Prisma.Decimal | number | null;
      maxSalary: Prisma.Decimal | number | null;
      hourlyRate: Prisma.Decimal | number | null;
    } | null;
  } | null;
  orgDefaultHourlyRate: Prisma.Decimal | number | null;
  costModel: CostModel;
}) {
  const employee = input.employee;
  const explicitHourly = decimalToNumber(employee?.hourlyRate);
  if (explicitHourly) return { hourlyRate: explicitHourly, source: "employee" as const };

  const salary = decimalToNumber(employee?.salary);
  if (salary) return { hourlyRate: salary / 2080, source: "employee" as const };

  const roleHourly = decimalToNumber(employee?.role?.hourlyRate);
  if (roleHourly) return { hourlyRate: roleHourly, source: "role" as const };

  const minSalary = decimalToNumber(employee?.role?.minSalary);
  const maxSalary = decimalToNumber(employee?.role?.maxSalary);
  if (minSalary && maxSalary) {
    return { hourlyRate: (minSalary + maxSalary) / 2 / 2080, source: "role" as const };
  }
  if (minSalary) return { hourlyRate: minSalary / 2080, source: "role" as const };
  if (maxSalary) return { hourlyRate: maxSalary / 2080, source: "role" as const };

  const orgRate = decimalToNumber(input.orgDefaultHourlyRate);
  if (orgRate) return { hourlyRate: orgRate, source: "organization" as const };

  return { hourlyRate: 75, source: "fallback" as const };
}

export async function recalculateMeetingCost(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      organization: true,
      attendees: {
        include: {
          user: {
            include: {
              employee: {
                include: {
                  role: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!meeting) return null;

  const attendees = meeting.attendees.map((attendee) => {
    const rate = resolveHourlyRate({
      employee: attendee.user?.employee ?? null,
      orgDefaultHourlyRate: meeting.organization.defaultHourlyRate,
      costModel: meeting.organization.costModel
    });

    return {
      hourlyRate: rate.hourlyRate,
      isExternal: attendee.isExternal
    };
  });

  const result = calculateMeetingCost({
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    isAllDay: meeting.isAllDay,
    attendees
  });

  const attendeeCount = meeting.attendees.length;

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: {
      isLarge: attendeeCount > 8,
      isLong: result.durationMinutes > 60
    }
  });

  return prisma.meetingCost.upsert({
    where: { meetingId: meeting.id },
    update: {
      totalCost: result.totalCost,
      costPerMinute: result.costPerMinute,
      durationMinutes: result.durationMinutes,
      calculatedAt: new Date()
    },
    create: {
      meetingId: meeting.id,
      totalCost: result.totalCost,
      costPerMinute: result.costPerMinute,
      durationMinutes: result.durationMinutes
    }
  });
}

export async function recalculateOrganizationCosts(orgId: string) {
  const meetings = await prisma.meeting.findMany({
    where: { orgId },
    select: { id: true }
  });

  for (const meeting of meetings) {
    await recalculateMeetingCost(meeting.id);
  }

  return meetings.length;
}
