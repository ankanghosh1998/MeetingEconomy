import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "@meetingeconomy/db";
import { closeQueues } from "./jobs/queue";

const app = createApp();

const server = app.listen(env.API_PORT, () => {
  console.info(`MeetingEconomy API listening on ${env.API_URL}`);
});

async function shutdown(signal: string) {
  console.info(`${signal} received. Shutting down MeetingEconomy API.`);
  server.close(async () => {
    await Promise.allSettled([prisma.$disconnect(), closeQueues()]);
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
