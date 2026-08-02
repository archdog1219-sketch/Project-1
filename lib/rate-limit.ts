import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function getRedis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export function getRegistrationRateLimit() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    prefix: "ratelimit:register",
  });
}

export function getLoginRateLimit() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "15 m"),
    prefix: "ratelimit:login",
  });
}

export function getAiDraftRateLimit() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "ratelimit:aidraft",
  });
}

// General per-user limiter for authenticated write endpoints (follow, save,
// profile edits, onboarding). Generous enough never to affect normal use.
export function getWriteRateLimit() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(40, "1 m"),
    prefix: "ratelimit:write",
  });
}

// Stricter per-user limiter for photo uploads (each write costs blob storage).
export function getUploadRateLimit() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "ratelimit:upload",
  });
}

// Caps how many opportunities a single employer can post per day.
export function getPostRateLimit() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "1 d"),
    prefix: "ratelimit:post",
  });
}

// Swiping is a legitimately high-frequency action — the shared 40/min write
// limiter would throttle a fast swiper mid-deck, so it gets its own budget.
export function getSwipeRateLimit() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(120, "1 m"),
    prefix: "ratelimit:swipe",
  });
}

// Brute-force guard on 6-digit OTP entry. Keyed by email, not IP, so one
// attacker cannot burn a victim's budget from many addresses.
export function getPhoneOtpRateLimit() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "15 m"),
    prefix: "ratelimit:phoneotp",
  });
}

// Company applications are reviewed by hand — a low IP cap is plenty.
export function getCompanyApplicationRateLimit() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(3, "1 d"),
    prefix: "ratelimit:companyapp",
  });
}

// One-shot set-password links from approved companies. Kept out of the
// registration bucket so shared office IPs can't exhaust each other.
export function getSetPasswordRateLimit() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "ratelimit:setpassword",
  });
}
