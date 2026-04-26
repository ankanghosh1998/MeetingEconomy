import { describe, expect, it } from "vitest";
import { calculateMeetingCost, normalizeDurationMinutes } from "../services/costEngine";

describe("cost engine", () => {
  it("calculates meeting total from internal attendee hourly rates", () => {
    const result = calculateMeetingCost({
      startTime: new Date("2026-04-22T10:00:00Z"),
      endTime: new Date("2026-04-22T11:00:00Z"),
      attendees: [
        { hourlyRate: 120, isExternal: false },
        { hourlyRate: 60, isExternal: false },
        { hourlyRate: 300, isExternal: true }
      ]
    });

    expect(result.ignored).toBe(false);
    expect(result.costPerMinute).toBe(3);
    expect(result.totalCost).toBe(180);
  });

  it("ignores meetings under five minutes", () => {
    const result = calculateMeetingCost({
      startTime: new Date("2026-04-22T10:00:00Z"),
      endTime: new Date("2026-04-22T10:04:00Z"),
      attendees: [{ hourlyRate: 120 }]
    });

    expect(result.ignored).toBe(true);
    expect(result.totalCost).toBe(0);
  });

  it("caps all-day meetings at eight hours", () => {
    const duration = normalizeDurationMinutes(
      new Date("2026-04-22T00:00:00Z"),
      new Date("2026-04-23T00:00:00Z"),
      true
    );

    expect(duration).toBe(480);
  });
});
