import { describe, it, expect } from "vitest";
import { validateSubmission } from "./moderation";

const clean = {
  title: "Summer Software Engineering Intern",
  description:
    "Join our engineering team for a 10-week paid summer internship. You will work on real product features alongside senior engineers and ship code to production.",
};

describe("validateSubmission", () => {
  it("accepts a clean submission", () => {
    expect(validateSubmission(clean)).toEqual({ ok: true });
  });

  it("rejects an email address in the description", () => {
    const r = validateSubmission({ ...clean, description: clean.description + " Email me at recruiter@scam.com." });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.toLowerCase()).toContain("contact");
  });

  it("rejects a URL in the description", () => {
    const r = validateSubmission({ ...clean, description: clean.description + " Apply at http://sketchy.example to start." });
    expect(r.ok).toBe(false);
  });

  it("rejects a bare domain in the description", () => {
    const r = validateSubmission({ ...clean, description: clean.description + " Visit sketchy-jobs.net now." });
    expect(r.ok).toBe(false);
  });

  it("rejects a phone number in the title", () => {
    const r = validateSubmission({ ...clean, title: "Intern call 555-123-4567" });
    expect(r.ok).toBe(false);
  });

  it("rejects a banned scam phrase", () => {
    const r = validateSubmission({ ...clean, description: "Great role! Just send a small processing fee to get started." });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.toLowerCase()).toContain("not allowed");
  });

  it("rejects an all-caps title", () => {
    const r = validateSubmission({ ...clean, title: "URGENT HIRING APPLY NOW FAST" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.toLowerCase()).toContain("formatting");
  });

  it("rejects excessive repeated punctuation", () => {
    const r = validateSubmission({ ...clean, title: "Best internship ever!!!!" });
    expect(r.ok).toBe(false);
  });

  it("does NOT reject a year range like 2024-2026 in the description", () => {
    const r = validateSubmission({ ...clean, description: "This is a 2024-2026 academic-year internship in our Boston office." });
    expect(r).toEqual({ ok: true });
  });

  it("does NOT reject a ZIP+4 like 90210-1234", () => {
    const r = validateSubmission({ ...clean, description: clean.description + " Located near ZIP 90210-1234." });
    expect(r).toEqual({ ok: true });
  });

  it("still rejects a real 10-digit phone number with parentheses", () => {
    const r = validateSubmission({ ...clean, description: clean.description + " Call (555) 123-4567 to apply." });
    expect(r.ok).toBe(false);
  });
});
