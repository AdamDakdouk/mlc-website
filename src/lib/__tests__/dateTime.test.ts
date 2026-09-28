import { isRealDateTime } from "../dateTime";

describe("isRealDateTime", () => {
  it("accepts a valid date and time", () => {
    expect(isRealDateTime("2026-10-15T10:00")).toBe(true);
  });

  it("accepts a valid leap-day date and time", () => {
    expect(isRealDateTime("2028-02-29T09:30")).toBe(true);
  });

  it("rejects a non-existent calendar date", () => {
    expect(isRealDateTime("2026-02-30T10:00")).toBe(false);
  });

  it("rejects an out-of-range hour", () => {
    expect(isRealDateTime("2026-01-01T25:00")).toBe(false);
  });

  it("rejects an out-of-range minute", () => {
    expect(isRealDateTime("2026-01-01T10:75")).toBe(false);
  });

  it("rejects a malformed shape (missing the T separator)", () => {
    expect(isRealDateTime("2026-01-01 10:00")).toBe(false);
  });

  it("rejects a date-only string with no time component", () => {
    expect(isRealDateTime("2026-01-01")).toBe(false);
  });

  it("does not throw on a fully garbage string", () => {
    expect(() => isRealDateTime("not-a-date-at-all")).not.toThrow();
    expect(isRealDateTime("not-a-date-at-all")).toBe(false);
  });
});
