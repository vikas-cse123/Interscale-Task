jest.unmock("../shared/timezone");

import { normalizeTimeZone } from "../shared/timezone";

describe("normalizeTimeZone", () => {
  it("maps the legacy Asia/Calcutta alias to Asia/Kolkata", () => {
    expect(normalizeTimeZone("Asia/Calcutta")).toBe("Asia/Kolkata");
  });

  it("keeps canonical IANA names and trims surrounding whitespace", () => {
    expect(normalizeTimeZone(" Asia/Kolkata ")).toBe("Asia/Kolkata");
    expect(normalizeTimeZone("America/New_York")).toBe("America/New_York");
  });

  it("falls back when the value is missing, empty, or unknown", () => {
    expect(normalizeTimeZone(undefined)).toBe("UTC");
    expect(normalizeTimeZone(null)).toBe("UTC");
    expect(normalizeTimeZone("   ")).toBe("UTC");
    expect(normalizeTimeZone("Not/AZone")).toBe("UTC");
  });

  it("uses the caller-provided fallback for invalid values", () => {
    expect(normalizeTimeZone("Not/AZone", "Etc/UTC")).toBe("Etc/UTC");
  });
});
