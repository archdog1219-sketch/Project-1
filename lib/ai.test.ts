import { describe, it, expect } from "vitest";
import { buildCoverLetterPrompt } from "./ai";

describe("buildCoverLetterPrompt", () => {
  const profile = {
    name: "Alex Rivera",
    gradeLabel: "Grade 11",
    city: "New York, NY",
    interests: ["Technology", "Science"],
    extracurriculars: ["Robotics Club"],
    skills: ["Python"],
    bio: "Aspiring engineer.",
  };
  const opportunity = {
    title: "Software Engineering Intern",
    org: "Google",
    description: "A summer internship building real products.",
  };

  it("includes the student's name, grade, and the role + org", () => {
    const p = buildCoverLetterPrompt(profile, opportunity);
    expect(p).toContain("Alex Rivera");
    expect(p).toContain("Grade 11");
    expect(p).toContain("Software Engineering Intern");
    expect(p).toContain("Google");
  });

  it("includes interests and extracurriculars so the draft can reference them", () => {
    const p = buildCoverLetterPrompt(profile, opportunity);
    expect(p).toContain("Technology");
    expect(p).toContain("Robotics Club");
  });

  it("handles missing optional fields without crashing", () => {
    const p = buildCoverLetterPrompt(
      { name: null, gradeLabel: null, city: null, interests: [], extracurriculars: [], skills: [], bio: null },
      opportunity
    );
    expect(p).toContain("Software Engineering Intern");
    expect(typeof p).toBe("string");
  });
});
