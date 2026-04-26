import "dotenv/config";
import { Worker } from "bullmq";
import { prisma } from "@meetingeconomy/db";
import { env, isRedisConfigured } from "../config/env";
import { closeQueues, getRedisConnection, scheduleRecurringJobs } from "./queue";
import { syncAllCalendarIntegrations, syncCalendarIntegration } from "../services/calendar";
import { recalculateOrganizationCosts } from "../services/costEngine";
import { getDashboardForOrg } from "../services/dashboard";
import { sendEmail } from "../services/email";

async function sendWeeklyReports() {
  const orgs = await prisma.organization.findMany({
    include: {
      users: {
        where: {
          role: {
            in: ["ADMIN", "MANAGER"]
          }
        },
        select: {
          email: true
        }
      }
    }
  });

  for (const org of orgs) {
    const dashboard = await getDashboardForOrg(org.id);
    await sendEmail({
      to: org.users.map((user) => user.email),
      subject: `${org.name} weekly meeting economy report`,
      text: `Total meeting cost: $${dashboard.total_cost}
Total meeting hours: ${dashboard.total_hours}
Flagged meeting cost: $${dashboard.flagged_cost}
Average cost per meeting: $${dashboard.avg_cost_per_meeting}`
    });
  }

  return orgs.length;
}

const workers: Worker[] = [];

if (!isRedisConfigured || !env.REDIS_URL) {
  console.warn("REDIS_URL not configured; background workers are disabled.");
  setInterval(() => {}, 60_000);
} else {
  const redisConnection = getRedisConnection();

  const calendarWorker = new Worker(
    "calendar-sync",
    async (job) => {
      if (job.name === "sync-all" || !job.data.integrationId) {
        return syncAllCalendarIntegrations();
      }
      return syncCalendarIntegration(job.data.integrationId);
    },
    { connection: redisConnection }
  );

  const costWorker = new Worker(
    "cost-recalculation",
    async (job) => {
      if (job.name === "recalculate-all") {
        const orgs = await prisma.organization.findMany({ select: { id: true } });
        let count = 0;
        for (const org of orgs) {
          count += await recalculateOrganizationCosts(org.id);
        }
        return count;
      }
      return recalculateOrganizationCosts(job.data.orgId);
    },
    { connection: redisConnection }
  );

  const weeklyWorker = new Worker("weekly-report", sendWeeklyReports, {
    connection: redisConnection
  });

  workers.push(calendarWorker, costWorker, weeklyWorker);

  for (const worker of workers) {
    worker.on("failed", (job, error) => {
      console.error(`Job failed: ${job?.queueName}/${job?.name}`, error);
    });
  }

  scheduleRecurringJobs()
    .then(() => {
      console.info(`MeetingEconomy workers running with Redis ${env.REDIS_URL}`);
    })
    .catch((error) => {
      console.error("Unable to schedule recurring jobs.", error);
    });
}

process.on("SIGTERM", async () => {
  await Promise.all([...workers.map((worker) => worker.close()), closeQueues()]);
  process.exit(0);
});
