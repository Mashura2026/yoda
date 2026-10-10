import { describe, expect, it } from "vitest";
import { academyDay, addBusinessDays, businessDaysBetween, onOrBeforeWorkingDay, formatLongDate } from "../src/lib/dates";

const none = new Set<string>();

describe("academy dates (brief section 4)", () => {
  it("Louis and Colin, Day 1 October 19, 2026", () => {
    expect(academyDay("2026-10-19", 30)).toBe("2026-11-17");
    expect(academyDay("2026-10-19", 60)).toBe("2026-12-17");
    expect(academyDay("2026-10-19", 90)).toBe("2027-01-16");
  });
  it("New SDR, Day 1 November 2, 2026", () => {
    expect(academyDay("2026-11-02", 30)).toBe("2026-12-01");
    expect(academyDay("2026-11-02", 60)).toBe("2026-12-31");
    expect(academyDay("2026-11-02", 90)).toBe("2027-01-30");
  });
  it("Day 90 on a Saturday reviews the prior working day, target date unchanged", () => {
    expect(onOrBeforeWorkingDay("2027-01-16", none)).toBe("2027-01-15");
    expect(onOrBeforeWorkingDay("2027-01-30", none)).toBe("2027-01-29");
  });
  it("formats long dates", () => {
    expect(formatLongDate("2026-10-19")).toBe("Monday, October 19, 2026");
  });
});

describe("business days", () => {
  const hol = new Set(["2026-11-26", "2026-12-25"]);
  it("skips weekends and holidays", () => {
    expect(addBusinessDays("2026-11-25", 1, hol)).toBe("2026-11-27");
    expect(businessDaysBetween("2026-11-24", "2026-11-30", hol)).toBe(3);
  });
  it("is zero when not past", () => {
    expect(businessDaysBetween("2026-11-24", "2026-11-24", hol)).toBe(0);
  });
});
