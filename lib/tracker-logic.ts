export type TrackerStatus = "SAVED" | "APPLYING" | "APPLIED";

export const STATUS_LANES: TrackerStatus[] = ["SAVED", "APPLYING", "APPLIED"];

export const LANE_LABELS: Record<TrackerStatus, string> = {
  SAVED: "📌 Saved",
  APPLYING: "✍️ Applying",
  APPLIED: "✅ Applied",
};

// Whole days from `now` until the deadline. null if absent/unparseable.
export function daysUntil(deadline: string | null, now: Date = new Date()): number | null {
  if (!deadline) return null;
  const ts = Date.parse(deadline);
  if (Number.isNaN(ts)) return null;
  const MS_PER_DAY = 86_400_000;
  return Math.round((ts - now.getTime()) / MS_PER_DAY);
}

export interface DeadlineInfo {
  text: string;
  urgent: boolean;
}

// A display label + urgency flag for a deadline string.
export function deadlineInfo(deadline: string | null, now: Date = new Date()): DeadlineInfo {
  const days = daysUntil(deadline, now);
  if (days === null) return { text: "No deadline", urgent: false };
  if (days < 0) return { text: "Deadline passed", urgent: false };
  if (days === 0) return { text: "Due today", urgent: true };
  if (days <= 7) return { text: `Due in ${days} day${days === 1 ? "" : "s"}`, urgent: true };
  return { text: deadline as string, urgent: false };
}

// Groups items (each carrying a `status`) into the three lanes, preserving input order.
export function groupByStatus<T extends { status: TrackerStatus }>(
  items: T[]
): Record<TrackerStatus, T[]> {
  const out: Record<TrackerStatus, T[]> = { SAVED: [], APPLYING: [], APPLIED: [] };
  for (const item of items) {
    out[item.status].push(item);
  }
  return out;
}
