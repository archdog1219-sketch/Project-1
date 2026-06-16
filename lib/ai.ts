import Anthropic from "@anthropic-ai/sdk";

export interface CoverLetterProfile {
  name: string | null;
  gradeLabel: string | null;
  city: string | null;
  interests: string[];
  extracurriculars: string[];
  skills: string[];
  bio: string | null;
}

export interface CoverLetterOpportunity {
  title: string;
  org: string;
  description: string;
}

// Pure: assembles the user prompt for the cover-letter generation.
export function buildCoverLetterPrompt(
  profile: CoverLetterProfile,
  opportunity: CoverLetterOpportunity
): string {
  const lines: string[] = [];
  lines.push(
    `Write a short, genuine cover letter (about 150-200 words) for a student applying to the following opportunity. ` +
      `Use a warm, authentic voice appropriate for a student — not corporate boilerplate. Do not invent achievements, ` +
      `qualifications, or experiences that aren't given below. If information is missing, keep the letter general rather than fabricating specifics.`
  );
  lines.push("");
  lines.push(`OPPORTUNITY:`);
  lines.push(`- Role: ${opportunity.title}`);
  lines.push(`- Organization: ${opportunity.org}`);
  lines.push(`- Description: ${opportunity.description}`);
  lines.push("");
  lines.push(`STUDENT:`);
  if (profile.name) lines.push(`- Name: ${profile.name}`);
  if (profile.gradeLabel) lines.push(`- Level: ${profile.gradeLabel}`);
  if (profile.city) lines.push(`- Location: ${profile.city}`);
  if (profile.interests.length) lines.push(`- Interests: ${profile.interests.join(", ")}`);
  if (profile.extracurriculars.length) lines.push(`- Extracurriculars: ${profile.extracurriculars.join(", ")}`);
  if (profile.skills.length) lines.push(`- Skills: ${profile.skills.join(", ")}`);
  if (profile.bio) lines.push(`- About: ${profile.bio}`);
  lines.push("");
  lines.push(`Return only the cover letter text — no preamble, no subject line, no placeholders like [Your Name].`);
  return lines.join("\n");
}

// Lazy client so a missing key never crashes at import/build time.
function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function generateCoverLetter(
  profile: CoverLetterProfile,
  opportunity: CoverLetterOpportunity
): Promise<string> {
  const message = await getClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: buildCoverLetterPrompt(profile, opportunity) }],
  });
  const text = message.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text : "";
}
