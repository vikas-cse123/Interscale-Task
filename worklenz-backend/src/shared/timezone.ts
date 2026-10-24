import momentTime from "moment-timezone";

const TIME_ZONE_ALIASES: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
};

export function normalizeTimeZone(value: unknown, fallback = "UTC"): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) return fallback;

  const canonical = TIME_ZONE_ALIASES[candidate] ?? candidate;
  return momentTime.tz.zone(canonical) ? canonical : fallback;
}
