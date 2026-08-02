import { describe, it, expect } from "vitest";
import { signUpSchema } from "./validations";

function validSignUp(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: "5551234567",
    password: "Password123",
    confirmPassword: "Password123",
    ...overrides,
  };
}

describe("signUpSchema phone validation", () => {
  it("accepts a normally formatted number", () => {
    const result = signUpSchema.safeParse(validSignUp({ phone: "(555) 123-4567" }));
    expect(result.success).toBe(true);
  });

  it("accepts an international number", () => {
    const result = signUpSchema.safeParse(validSignUp({ phone: "+44 20 7946 0958" }));
    expect(result.success).toBe(true);
  });

  it("rejects an all-punctuation string that would normalize to empty", () => {
    const result = signUpSchema.safeParse(validSignUp({ phone: "-------" }));
    expect(result.success).toBe(false);
  });

  it("rejects a number with too few digits", () => {
    const result = signUpSchema.safeParse(validSignUp({ phone: "12-34" }));
    expect(result.success).toBe(false);
  });

  it("rejects an empty phone number", () => {
    const result = signUpSchema.safeParse(validSignUp({ phone: "" }));
    expect(result.success).toBe(false);
  });
});
