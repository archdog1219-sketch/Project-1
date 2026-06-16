import { describe, it, expect } from "vitest";
import { daysUntil, deadlineInfo, groupByStatus, STATUS_LANES } from "./tracker-logic";

const NOW = new Date("2026-01-10T00:00:00Z");

describe("daysUntil", () => {
  it("returns null for null or unparseable deadlines", () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil("whenever", NOW)).toBeNull();
  });
  it("computes whole days until a parseable date", () => {
    expect(daysUntil("January 15, 2026", NOW)).toBe(5);
  });
  it("returns a negative number for past deadlines", () => {
    expect(daysUntil("January 5, 2026", NOW)).toBe(-5);
  });
});

describe("deadlineInfo", () => {
  it("labels no deadline", () => {
    expect(deadlineInfo(null, NOW)).toEqual({ text: "No deadline", urgent: false });
  });
  it("flags deadlines within 7 days as urgent", () => {
    expect(deadlineInfo("January 15, 2026", NOW)).toEqual({ text: "Due in 5 days", urgent: true });
  });
  it("says 'Due today' at 0 days", () => {
    expect(deadlineInfo("January 10, 2026", NOW)).toEqual({ text: "Due today", urgent: true });
  });
  it("marks past deadlines as passed (not urgent)", () => {
    expect(deadlineInfo("January 5, 2026", NOW)).toEqual({ text: "Deadline passed", urgent: false });
  });
  it("shows the raw deadline for far-off dates", () => {
    expect(deadlineInfo("March 1, 2026", NOW)).toEqual({ text: "March 1, 2026", urgent: false });
  });
  it("is urgent at exactly 7 days but not at 8", () => {
    expect(deadlineInfo("January 17, 2026", NOW).urgent).toBe(true);
    expect(deadlineInfo("January 18, 2026", NOW).urgent).toBe(false);
  });
  it("uses singular 'day' at exactly 1 day", () => {
    expect(deadlineInfo("January 11, 2026", NOW)).toEqual({ text: "Due in 1 day", urgent: true });
  });
  it("shows the raw deadline string (not 'Due in') at 8 days", () => {
    expect(deadlineInfo("January 18, 2026", NOW).text).toBe("January 18, 2026");
  });
});

describe("groupByStatus", () => {
  it("groups items into the three lanes preserving input order", () => {
    const items = [
      { id: "1", status: "APPLIED" as const },
      { id: "2", status: "SAVED" as const },
      { id: "3", status: "SAVED" as const },
      { id: "4", status: "APPLYING" as const },
    ];
    const grouped = groupByStatus(items);
    expect(grouped.SAVED.map((i) => i.id)).toEqual(["2", "3"]);
    expect(grouped.APPLYING.map((i) => i.id)).toEqual(["4"]);
    expect(grouped.APPLIED.map((i) => i.id)).toEqual(["1"]);
  });
  it("exposes lane order Saved → Applying → Applied", () => {
    expect(STATUS_LANES).toEqual(["SAVED", "APPLYING", "APPLIED"]);
  });
});
