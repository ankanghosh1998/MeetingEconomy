import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env";

let redisConnection: IORedis | null = null;
let calendarSyncQueue: Queue | null = null;
let costRecalculationQueue: Queue | null = null;
let weeklyReportQueue: Queue | null = null;

export function getRedisConnection() {
  if (!redisConnection) {
    redisConnection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
  }
  return redisConnection;
}

function getCalendarSyncQueue() {
  calendarSyncQueue ??= new Queue("calendar-sync", {
    connection: getRedisConnection()
  });
  return calendarSyncQueue;
}

function getCostRecalculationQueue() {
  costRecalculationQueue ??= new Queue("cost-recalculation", {
    connection: getRedisConnection()
  });
  return costRecalculationQueue;
}

function getWeeklyReportQueue() {
  weeklyReportQueue ??= new Queue("weekly-report", {
    connection: getRedisConnection()
  });
  return weeklyReportQueue;
}

export async function enqueueCalendarSync(integrationId?: string, options?: JobsOptions) {
  return getCalendarSyncQueue().add("sync", { integrationId }, options);
}

export async function enqueueCostRecalculation(orgId: string, options?: JobsOptions) {
  return getCostRecalculationQueue().add("recalculate-org", { orgId }, options);
}

export async function scheduleRecurringJobs() {
  await getCalendarSyncQueue().add(
    "sync-all",
    {},
    {
      jobId: "calendar-sync-every-6-hours",
      repeat: { every: 6 * 60 * 60 * 1000 },
      removeOnComplete: 100,
      removeOnFail: 200
    }
  );

  await getCostRecalculationQueue().add(
    "recalculate-all",
    {},
    {
      jobId: "cost-recalculation-every-6-hours",
      repeat: { every: 6 * 60 * 60 * 1000 },
      removeOnComplete: 100,
      removeOnFail: 200
    }
  );

  await getWeeklyReportQueue().add(
    "weekly-report",
    {},
    {
      jobId: "weekly-report-monday",
      repeat: { pattern: "0 13 * * 1" },
      removeOnComplete: 100,
      removeOnFail: 200
    }
  );
}

export async function closeQueues() {
  await Promise.all([
    calendarSyncQueue?.close(),
    costRecalculationQueue?.close(),
    weeklyReportQueue?.close(),
    redisConnection?.quit()
  ]);
}
