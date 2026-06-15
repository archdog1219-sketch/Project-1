export type OpportunityType = "Jobs" | "Internships" | "Summer Programs" | "Clubs";

export interface Listing {
  id: number;
  title: string;
  org: string;
  type: OpportunityType;
  location: string;
  tags: string[];
  description: string;
  deadline?: string;
  applyUrl?: string;
}

export const LISTINGS: Listing[] = [
  {
    id: 1,
    title: "Software Engineering Intern",
    org: "Google",
    type: "Internships",
    location: "Remote",
    tags: ["Paid", "Summer 2026"],
    description: "Join Google's engineering team for a 12-week summer internship. You'll work alongside full-time engineers on real products used by billions of people. Projects vary by team but typically involve software design, coding, and testing. Competitive pay and housing stipend included.",
    deadline: "January 15, 2026",
    applyUrl: "#",
  },
  {
    id: 2,
    title: "STEM Residential Program",
    org: "MIT",
    type: "Summer Programs",
    location: "Cambridge, MA",
    tags: ["Residential", "Grades 10–12"],
    description: "A 6-week residential summer program at MIT for high school students passionate about science and engineering. Students live on campus, attend lectures by MIT faculty, and complete a hands-on research project. Financial aid available.",
    deadline: "March 1, 2026",
    applyUrl: "#",
  },
  {
    id: 3,
    title: "Marketing & Strategy Club",
    org: "Yale University",
    type: "Clubs",
    location: "New Haven, CT",
    tags: ["Extracurricular", "All grades"],
    description: "Yale's student-run marketing club works with real nonprofits and startups on branding, strategy, and growth campaigns. Members meet weekly and take on semester-long consulting projects. Open to all Yale undergraduates.",
    applyUrl: "#",
  },
  {
    id: 4,
    title: "Retail Associate",
    org: "Target",
    type: "Jobs",
    location: "New York, NY",
    tags: ["Part-time", "$17/hr"],
    description: "Part-time retail associate role at Target. Responsibilities include helping customers, stocking shelves, and operating checkout. Flexible scheduling works around school. Benefits include employee discount and tuition assistance after 6 months.",
    applyUrl: "#",
  },
  {
    id: 5,
    title: "Data Science Intern",
    org: "Meta",
    type: "Internships",
    location: "Menlo Park, CA",
    tags: ["Paid", "Summer 2026"],
    description: "Work on Meta's data science team to analyze product metrics, build dashboards, and run experiments that shape how billions of people connect. You'll be embedded in a product team and present findings to senior leadership. Strong Python and SQL skills required.",
    deadline: "December 1, 2025",
    applyUrl: "#",
  },
  {
    id: 6,
    title: "Congressional Internship",
    org: "U.S. House of Representatives",
    type: "Internships",
    location: "Washington, D.C.",
    tags: ["Unpaid", "College students"],
    description: "Intern in a congressional office during the spring or summer session. Duties include constituent correspondence, legislative research, and attending committee hearings. A great introduction to how federal government works. Most offices require at least freshman standing.",
    deadline: "February 28, 2026",
    applyUrl: "#",
  },
  {
    id: 7,
    title: "Robotics Club",
    org: "Stanford University",
    type: "Clubs",
    location: "Stanford, CA",
    tags: ["STEM", "All grades"],
    description: "Stanford's undergraduate robotics club competes in national competitions and builds autonomous systems from scratch. Members specialize in mechanical design, electronics, or software. No prior experience required — just enthusiasm and willingness to learn.",
    applyUrl: "#",
  },
  {
    id: 8,
    title: "Young Entrepreneurs Program",
    org: "Babson College",
    type: "Summer Programs",
    location: "Wellesley, MA",
    tags: ["Residential", "Grades 9–12"],
    description: "A 2-week intensive entrepreneurship program at Babson College for high school students. Participants develop a business idea, build a prototype, and pitch to a panel of investors. Taught by Babson faculty with guest talks from successful founders.",
    deadline: "April 15, 2026",
    applyUrl: "#",
  },
  {
    id: 9,
    title: "Barista",
    org: "Starbucks",
    type: "Jobs",
    location: "Various locations",
    tags: ["Part-time", "Benefits"],
    description: "Starbucks is hiring part-time baristas at locations nationwide. You'll craft beverages, serve customers, and keep the store running smoothly. Benefits include free coffee, health insurance (20+ hrs/week), and tuition reimbursement through Arizona State University's online programs.",
    applyUrl: "#",
  },
];

export const OPPORTUNITY_TYPES: OpportunityType[] = ["Jobs", "Internships", "Summer Programs", "Clubs"];

export const TYPE_LABELS: Record<OpportunityType, string> = {
  Jobs: "Job",
  Internships: "Internship",
  "Summer Programs": "Summer",
  Clubs: "Club",
};
