import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const registrationRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "ratelimit:register",
});

export const loginRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "15 m"),
  prefix: "ratelimit:login",
});
