import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("health API", () => {
  it("returns service status", async () => {
    const response = await request(createApp()).get("/health").expect(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.service).toBe("meetingeconomy-api");
  });
});
