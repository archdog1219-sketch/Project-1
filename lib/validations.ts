import { z } from "zod";

export const signUpSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(50),
    lastName: z.string().trim().min(1, "Last name is required").max(50),
    email: z.string().email("Please enter a valid email address"),
    // Password policy: 10+ chars, upper, lower, digit required.
    // Special characters intentionally not required (user preference).
    password: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const basicInfoSchema = z.object({
  dateOfBirth: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), "Please enter a valid date"),
  city: z.string().min(2, "City must be at least 2 characters").max(100),
});

export const occupationSchema = z.discriminatedUnion("occupationType", [
  z.object({
    occupationType: z.literal("STUDENT_HS"),
  }),
  z.object({
    occupationType: z.literal("STUDENT_COLLEGE"),
  }),
  z.object({
    occupationType: z.literal("EMPLOYER"),
    companyName: z.string().min(1, "Company name is required").max(200),
  }),
  z.object({
    occupationType: z.literal("OTHER"),
  }),
]);

export const studentDetailsSchema = z.object({
  schoolLevel: z.enum(["High School", "College"]),
  graduationYear: z
    .number()
    .int()
    .min(new Date().getFullYear())
    .max(new Date().getFullYear() + 10),
  degree: z.string().max(200).optional(),
});

export const matchingProfileSchema = z.object({
  gpaRange: z.enum(["BELOW_3_0", "R3_0_3_5", "R3_5_3_8", "R3_8_PLUS"]),
  interests: z.array(z.string().min(1).max(50)).min(1, "Pick at least one interest").max(5, "Pick up to 5 interests"),
  extracurriculars: z.array(z.string().min(1).max(80)).max(10).optional(),
});

export type MatchingProfileInput = z.infer<typeof matchingProfileSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .optional(),
  city: z.string().min(2).max(100).optional(),
  bio: z.string().max(300, "Bio must be 300 characters or less").optional(),
  school: z.string().max(200).optional(),
  graduationYear: z.number().int().optional(),
  degree: z.string().max(200).optional(),
  skills: z.array(z.string().min(1).max(50)).max(20).optional(),
  interests: z.array(z.string().min(1).max(50)).max(20).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactEmailVisible: z.boolean().optional(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type BasicInfoInput = z.infer<typeof basicInfoSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Matches the Prisma SaveStatus enum (no ACCEPTED — acceptance tracking arrives
// with the Phase 3 tracker, which will add the enum value + migration).
export const saveStatusSchema = z.object({
  status: z.enum(["SAVED", "APPLYING", "APPLIED"]),
});

export const followSchema = z.object({
  targetId: z.string().min(1, "targetId is required"),
});

export type SaveStatusInput = z.infer<typeof saveStatusSchema>;
export type FollowInput = z.infer<typeof followSchema>;

export const opportunitySubmissionSchema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(120),
  org: z.string().trim().min(2, "Organization is too short").max(120),
  type: z.enum(["Jobs", "Internships", "Summer Programs", "Clubs"]),
  location: z.string().trim().min(2, "Location is too short").max(120),
  description: z.string().trim().min(30, "Description should be at least 30 characters").max(4000),
  applyUrl: z.string().trim().url("Apply URL must be a valid link").max(500).optional().or(z.literal("")),
  deadline: z.string().trim().max(60).optional().or(z.literal("")),
  isPaid: z.boolean(),
  targetGrades: z.array(z.string().min(1).max(40)).max(8),
  targetInterests: z.array(z.string().min(1).max(50)).max(5),
});

export type OpportunitySubmissionInput = z.infer<typeof opportunitySubmissionSchema>;

export const swipeSchema = z.object({
  direction: z.enum(["save", "skip"]),
});

export type SwipeInput = z.infer<typeof swipeSchema>;

export const identityMockSchema = z.object({
  legalFirstName: z.string().trim().min(1, "Required").max(50),
  legalLastName: z.string().trim().min(1, "Required").max(50),
  issuingCountry: z.string().trim().min(2).max(56),
  outcome: z.enum(["pass", "fail"]),
});
