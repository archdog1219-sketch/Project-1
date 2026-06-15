import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const OPPORTUNITIES = [
  { title: "Software Engineering Intern", org: "Google", type: "INTERNSHIP" as const, location: "Remote", description: "Join Google's engineering team for a 12-week summer internship working alongside full-time engineers on real products.", deadline: "January 15, 2026", applyUrl: "#", targetGrades: ["Grade 11", "Grade 12", "College"], targetInterests: ["Technology"], isPaid: true, tags: ["Paid", "Summer 2026"] },
  { title: "STEM Residential Program", org: "MIT", type: "SUMMER_PROGRAM" as const, location: "Cambridge, MA", description: "A 6-week residential summer program at MIT for high school students passionate about science and engineering.", deadline: "March 1, 2026", applyUrl: "#", targetGrades: ["Grade 10", "Grade 11", "Grade 12"], targetInterests: ["Science", "Technology"], isPaid: false, tags: ["Residential", "Grades 10–12"] },
  { title: "Marketing & Strategy Club", org: "Yale University", type: "CLUB" as const, location: "New Haven, CT", description: "Yale's student-run marketing club works with real nonprofits and startups on branding, strategy, and growth campaigns.", deadline: null, applyUrl: "#", targetGrades: ["College"], targetInterests: ["Business"], isPaid: false, tags: ["Extracurricular", "All grades"] },
  { title: "Retail Associate", org: "Target", type: "JOB" as const, location: "New York, NY", description: "Part-time retail associate role. Flexible scheduling works around school. Benefits include employee discount and tuition assistance.", deadline: null, applyUrl: "#", targetGrades: ["Grade 11", "Grade 12", "College"], targetInterests: ["Business"], isPaid: true, tags: ["Part-time", "$17/hr"] },
  { title: "Data Science Intern", org: "Meta", type: "INTERNSHIP" as const, location: "Menlo Park, CA", description: "Work on Meta's data science team to analyze product metrics, build dashboards, and run experiments. Strong Python and SQL skills required.", deadline: "December 1, 2025", applyUrl: "#", targetGrades: ["College"], targetInterests: ["Technology", "Science"], isPaid: true, tags: ["Paid", "Summer 2026"] },
  { title: "Congressional Internship", org: "U.S. House of Representatives", type: "INTERNSHIP" as const, location: "Washington, D.C.", description: "Intern in a congressional office during the spring or summer session. Constituent correspondence, legislative research, committee hearings.", deadline: "February 28, 2026", applyUrl: "#", targetGrades: ["College"], targetInterests: ["Politics", "Law"], isPaid: false, tags: ["Unpaid", "College students"] },
  { title: "Robotics Club", org: "Stanford University", type: "CLUB" as const, location: "Stanford, CA", description: "Stanford's undergraduate robotics club competes in national competitions and builds autonomous systems from scratch.", deadline: null, applyUrl: "#", targetGrades: ["College"], targetInterests: ["Technology", "Science"], isPaid: false, tags: ["STEM", "All grades"] },
  { title: "Young Entrepreneurs Program", org: "Babson College", type: "SUMMER_PROGRAM" as const, location: "Wellesley, MA", description: "A 2-week intensive entrepreneurship program for high school students. Develop a business idea, build a prototype, pitch to investors.", deadline: "April 15, 2026", applyUrl: "#", targetGrades: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"], targetInterests: ["Business"], isPaid: false, tags: ["Residential", "Grades 9–12"] },
  { title: "Barista", org: "Starbucks", type: "JOB" as const, location: "Various locations", description: "Part-time barista positions nationwide. Benefits include free coffee, health insurance (20+ hrs/week), and tuition reimbursement.", deadline: null, applyUrl: "#", targetGrades: ["Grade 11", "Grade 12", "College"], targetInterests: ["Business"], isPaid: true, tags: ["Part-time", "Benefits"] },
];

async function main() {
  await db.opportunity.deleteMany();
  for (const o of OPPORTUNITIES) {
    await db.opportunity.create({ data: o });
  }
  console.log(`Seeded ${OPPORTUNITIES.length} opportunities.`);
}

main().finally(() => process.exit(0));
