export interface ModerationInput {
  title: string;
  description: string;
}

export type ModerationResult = { ok: true } | { ok: false; reason: string };

const URL_RE = /(https?:\/\/|www\.)\S+/i;
const DOMAIN_RE = /\b[a-z0-9][a-z0-9-]*\.(com|net|org|io|co|edu|gov|info|biz|app|dev)\b/i;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const REPEAT_PUNCT_RE = /([!?])\1{2,}/;
const REPEAT_CHAR_RE = /(.)\1{5,}/;

// Phrases commonly used in scam / pay-to-apply / off-platform listings.
const BANNED_PHRASES = [
  "wire transfer",
  "processing fee",
  "registration fee",
  "application fee",
  "pay to apply",
  "gift card",
  "western union",
  "money gram",
  "guaranteed income",
  "guaranteed money",
  "send money",
  "bitcoin",
  "crypto payment",
  "cash app",
  "venmo me",
];

function hasContactInfo(text: string): boolean {
  return URL_RE.test(text) || DOMAIN_RE.test(text) || EMAIL_RE.test(text) || PHONE_RE.test(text);
}

function isMostlyCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 10) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length > 0.7;
}

export function validateSubmission(input: ModerationInput): ModerationResult {
  const title = input.title ?? "";
  const description = input.description ?? "";
  const haystack = `${title}\n${description}`;
  const lower = haystack.toLowerCase();

  if (hasContactInfo(haystack)) {
    return {
      ok: false,
      reason:
        "Please don't include contact info (links, emails, or phone numbers) in the title or description — use the Apply URL field instead.",
    };
  }

  const banned = BANNED_PHRASES.find((p) => lower.includes(p));
  if (banned) {
    return { ok: false, reason: `This listing contains a phrase that's not allowed ("${banned}").` };
  }

  if (isMostlyCaps(title)) {
    return { ok: false, reason: "Please fix the title's formatting — avoid writing it in all capitals." };
  }

  if (REPEAT_PUNCT_RE.test(haystack) || REPEAT_CHAR_RE.test(haystack)) {
    return { ok: false, reason: "Please fix the formatting — avoid excessive repeated characters or punctuation." };
  }

  return { ok: true };
}
