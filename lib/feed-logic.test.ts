import { describe, it, expect } from "vitest";
import { feedEventTypeForStatus, shouldEmitFeedEvent, rankSuggestions } from "./feed-logic";

describe("feedEventTypeForStatus", () => {
  it("maps APPLIED and ACCEPTED to feed event types, SAVED to null", () => {
    expect(feedEventTypeForStatus("APPLIED")).toBe("APPLIED");
    expect(feedEventTypeForStatus("ACCEPTED")).toBe("ACCEPTED");
    expect(feedEventTypeForStatus("APPLYING")).toBeNull();
    expect(feedEventTypeForStatus("SAVED")).toBeNull();
  });
});

describe("shouldEmitFeedEvent", () => {
  it("emits when transitioning INTO a shareable status from a different one", () => {
    expect(shouldEmitFeedEvent(null, "APPLIED")).toBe(true);
    expect(shouldEmitFeedEvent("SAVED", "APPLIED")).toBe(true);
    expect(shouldEmitFeedEvent("APPLIED", "ACCEPTED")).toBe(true);
  });
  it("does not emit for private SAVED or for no-op transitions", () => {
    expect(shouldEmitFeedEvent(null, "SAVED")).toBe(false);
    expect(shouldEmitFeedEvent("SAVED", "SAVED")).toBe(false);
    expect(shouldEmitFeedEvent("APPLIED", "APPLIED")).toBe(false);
  });
});

describe("rankSuggestions", () => {
  const me = { id: "me", interests: ["Technology", "Science"] };
  it("ranks candidates by shared-interest count, excludes self and already-followed", () => {
    const ranked = rankSuggestions(me, [
      { id: "a", name: "A", interests: ["Technology", "Science"], verified: false },
      { id: "b", name: "B", interests: ["Law"], verified: false },
      { id: "me", name: "Me", interests: ["Technology"], verified: false },
      { id: "c", name: "C", interests: ["Technology"], verified: false },
    ], new Set(["b"]));
    expect(ranked.map((u) => u.id)).toEqual(["a", "c"]);
  });
  it("drops candidates with zero shared interests", () => {
    const ranked = rankSuggestions(me, [{ id: "x", name: "X", interests: ["Art"], verified: false }], new Set());
    expect(ranked).toEqual([]);
  });
  it("matches interests case-insensitively", () => {
    const ranked = rankSuggestions(me, [{ id: "a", name: "A", interests: ["technology"], verified: false }], new Set());
    expect(ranked.map((u) => u.id)).toEqual(["a"]);
    expect(ranked[0].shared).toBe(1);
  });

  it("ranks verified users first at equal shared-interest counts, but never above more-relevant unverified users", () => {
    const ranked = rankSuggestions(me, [
      { id: "unv2", name: "U2", interests: ["Technology", "Science"], verified: false },
      { id: "unv1", name: "U1", interests: ["Technology"], verified: false },
      { id: "ver1", name: "V1", interests: ["Technology"], verified: true },
    ], new Set());
    expect(ranked.map((u) => u.id)).toEqual(["unv2", "ver1", "unv1"]);
  });

  it("preserves input order for candidates with equal shared counts", () => {
    const ranked = rankSuggestions(me, [
      { id: "first", name: "First", interests: ["Technology"], verified: false },
      { id: "second", name: "Second", interests: ["Science"], verified: false },
    ], new Set());
    expect(ranked.map((u) => u.id)).toEqual(["first", "second"]);
  });
});
