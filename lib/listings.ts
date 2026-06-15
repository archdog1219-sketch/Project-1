export type OpportunityTypeLabel = "Jobs" | "Internships" | "Summer Programs" | "Clubs";

export const OPPORTUNITY_TYPES: OpportunityTypeLabel[] = [
  "Jobs",
  "Internships",
  "Summer Programs",
  "Clubs",
];

export const TYPE_LABELS: Record<OpportunityTypeLabel, string> = {
  Jobs: "Job",
  Internships: "Internship",
  "Summer Programs": "Summer",
  Clubs: "Club",
};

export const LABEL_TO_ENUM: Record<OpportunityTypeLabel, "JOB" | "INTERNSHIP" | "SUMMER_PROGRAM" | "CLUB"> = {
  Jobs: "JOB",
  Internships: "INTERNSHIP",
  "Summer Programs": "SUMMER_PROGRAM",
  Clubs: "CLUB",
};

export const ENUM_TO_LABEL: Record<"JOB" | "INTERNSHIP" | "SUMMER_PROGRAM" | "CLUB", OpportunityTypeLabel> = {
  JOB: "Jobs",
  INTERNSHIP: "Internships",
  SUMMER_PROGRAM: "Summer Programs",
  CLUB: "Clubs",
};
