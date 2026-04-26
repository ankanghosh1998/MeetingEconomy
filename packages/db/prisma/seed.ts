import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, CostModel, CalendarProvider } from "@prisma/client";

const prisma = new PrismaClient();

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function toHourly(salary: number) {
  return salary / 2080;
}

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const org = await prisma.organization.upsert({
    where: { id: "seed-org-meetingeconomy" },
    update: {},
    create: {
      id: "seed-org-meetingeconomy",
      name: "Acme Operations",
      domain: "acme.test",
      costModel: CostModel.SALARY_BANDS,
      defaultHourlyRate: 85,
      currency: "USD"
    }
  });

  const engineering = await prisma.role.upsert({
    where: { orgId_title: { orgId: org.id, title: "Engineering" } },
    update: {},
    create: {
      orgId: org.id,
      title: "Engineering",
      minSalary: 120000,
      maxSalary: 170000
    }
  });

  const product = await prisma.role.upsert({
    where: { orgId_title: { orgId: org.id, title: "Product" } },
    update: {},
    create: {
      orgId: org.id,
      title: "Product",
      minSalary: 110000,
      maxSalary: 155000
    }
  });

  const ops = await prisma.role.upsert({
    where: { orgId_title: { orgId: org.id, title: "Operations" } },
    update: {},
    create: {
      orgId: org.id,
      title: "Operations",
      hourlyRate: 70
    }
  });

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@acme.test" },
      update: {},
      create: {
        name: "Ada Admin",
        email: "admin@acme.test",
        passwordHash,
        role: UserRole.ADMIN,
        orgId: org.id,
        employee: {
          create: {
            roleId: product.id,
            salary: 160000,
            department: "Product"
          }
        }
      },
      include: { employee: true }
    }),
    prisma.user.upsert({
      where: { email: "morgan@acme.test" },
      update: {},
      create: {
        name: "Morgan Manager",
        email: "morgan@acme.test",
        passwordHash,
        role: UserRole.MANAGER,
        orgId: org.id,
        employee: {
          create: {
            roleId: engineering.id,
            salary: 155000,
            department: "Engineering"
          }
        }
      },
      include: { employee: true }
    }),
    prisma.user.upsert({
      where: { email: "maya@acme.test" },
      update: {},
      create: {
        name: "Maya Member",
        email: "maya@acme.test",
        passwordHash,
        role: UserRole.MEMBER,
        orgId: org.id,
        employee: {
          create: {
            roleId: engineering.id,
            salary: 130000,
            department: "Engineering"
          }
        }
      },
      include: { employee: true }
    }),
    prisma.user.upsert({
      where: { email: "owen@acme.test" },
      update: {},
      create: {
        name: "Owen Ops",
        email: "owen@acme.test",
        passwordHash,
        role: UserRole.MEMBER,
        orgId: org.id,
        employee: {
          create: {
            roleId: ops.id,
            department: "Operations"
          }
        }
      },
      include: { employee: true }
    })
  ]);

  const now = new Date();
  const starts: [Date, Date, Date, Date] = [
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 10, 0),
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 13, 0),
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30),
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0)
  ];

  const meetingDefinitions = [
    {
      id: "seed-meeting-kickoff",
      title: "Q2 Planning Council",
      start: starts[0],
      minutes: 75,
      organizer: users[0],
      attendees: users,
      external: ["consultant@example.com"],
      recurring: false
    },
    {
      id: "seed-meeting-standup",
      title: "Engineering Standup",
      start: starts[1],
      minutes: 15,
      organizer: users[1],
      attendees: [users[1], users[2]],
      external: [],
      recurring: true
    },
    {
      id: "seed-meeting-roadmap",
      title: "Roadmap Prioritization",
      start: starts[2],
      minutes: 50,
      organizer: users[0],
      attendees: [users[0], users[1], users[2]],
      external: [],
      recurring: false
    },
    {
      id: "seed-meeting-vendor",
      title: "Vendor Review",
      start: starts[3],
      minutes: 90,
      organizer: users[3],
      attendees: users,
      external: ["vendor@example.com", "legal@example.net", "finance@example.net", "partner@example.org", "advisor@example.org"],
      recurring: true
    }
  ];

  for (const item of meetingDefinitions) {
    const allEmails = [
      ...item.attendees.map((user) => ({ email: user.email, name: user.name, userId: user.id, isExternal: false })),
      ...item.external.map((email) => ({ email, name: null, userId: null, isExternal: true }))
    ];

    const meeting = await prisma.meeting.upsert({
      where: { id: item.id },
      update: {},
      create: {
        id: item.id,
        orgId: org.id,
        provider: CalendarProvider.GOOGLE,
        externalId: item.id,
        title: item.title,
        startTime: item.start,
        endTime: addMinutes(item.start, item.minutes),
        organizerId: item.organizer.id,
        organizerEmail: item.organizer.email,
        isLarge: allEmails.length > 8,
        isLong: item.minutes > 60,
        isRecurring: item.recurring,
        attendees: {
          create: allEmails.map((attendee) => ({
            email: attendee.email,
            name: attendee.name,
            userId: attendee.userId,
            isExternal: attendee.isExternal,
            isRequired: true
          }))
        }
      }
    });

    const hourlyByEmail: Record<string, number> = {
      "admin@acme.test": toHourly(160000),
      "morgan@acme.test": toHourly(155000),
      "maya@acme.test": toHourly(130000),
      "owen@acme.test": 70
    };
    let hourlySum = 0;
    for (const user of item.attendees) {
      hourlySum += hourlyByEmail[user.email] ?? 85;
    }
    const costPerMinute = hourlySum / 60;
    const totalCost = costPerMinute * item.minutes;

    await prisma.meetingCost.upsert({
      where: { meetingId: meeting.id },
      update: {
        totalCost,
        costPerMinute,
        durationMinutes: item.minutes
      },
      create: {
        meetingId: meeting.id,
        totalCost,
        costPerMinute,
        durationMinutes: item.minutes
      }
    });
  }

  await prisma.meetingRating.upsert({
    where: {
      meetingId_userId: {
        meetingId: "seed-meeting-roadmap",
        userId: users[2].id
      }
    },
    update: {},
    create: {
      meetingId: "seed-meeting-roadmap",
      userId: users[2].id,
      rating: 4,
      comment: "Good decisions, but we could shorten the context review."
    }
  });

  console.log("Seed complete. Login with admin@acme.test / Password123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
