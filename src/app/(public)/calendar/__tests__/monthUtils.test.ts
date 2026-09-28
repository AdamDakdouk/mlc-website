import {
  parseMonthParam,
  formatMonthParam,
  adjacentMonth,
  buildMonthGrid,
  type CalendarEventLike,
} from "../monthUtils";

describe("parseMonthParam", () => {
  it("parses a valid YYYY-MM string", () => {
    expect(parseMonthParam("2026-10")).toEqual({ year: 2026, month: 10 });
  });

  it("falls back to the current UTC month for an undefined value", () => {
    const now = new Date();
    expect(parseMonthParam(undefined)).toEqual({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });
  });

  it("falls back to the current month for a malformed value", () => {
    const now = new Date();
    expect(parseMonthParam("garbage")).toEqual({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });
  });

  it("falls back to the current month for an out-of-range month number", () => {
    const now = new Date();
    expect(parseMonthParam("2026-13")).toEqual({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });
  });
});

describe("formatMonthParam", () => {
  it("pads single-digit months", () => {
    expect(formatMonthParam({ year: 2026, month: 3 })).toBe("2026-03");
  });

  it("formats double-digit months as-is", () => {
    expect(formatMonthParam({ year: 2026, month: 12 })).toBe("2026-12");
  });
});

describe("adjacentMonth", () => {
  it("steps forward within a year", () => {
    expect(adjacentMonth({ year: 2026, month: 10 }, 1)).toEqual({ year: 2026, month: 11 });
  });

  it("steps forward across a year boundary", () => {
    expect(adjacentMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("steps backward within a year", () => {
    expect(adjacentMonth({ year: 2026, month: 10 }, -1)).toEqual({ year: 2026, month: 9 });
  });

  it("steps backward across a year boundary", () => {
    expect(adjacentMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("buildMonthGrid", () => {
  const events: CalendarEventLike[] = [
    {
      id: "1",
      title: "Open House",
      category: "Event",
      startDate: "2026-10-05",
      endDate: "2026-10-05",
      description: "",
    },
    {
      id: "2",
      title: "Winter-ish Break",
      category: "Holiday",
      startDate: "2026-10-03",
      endDate: "2026-10-06",
      description: "",
    },
  ];

  it("returns 42 days (6 full weeks)", () => {
    const grid = buildMonthGrid({ year: 2026, month: 10 }, events);
    expect(grid).toHaveLength(42);
  });

  it("marks days outside the target month as not in-month", () => {
    const grid = buildMonthGrid({ year: 2026, month: 10 }, events);
    // October 2026 starts on a Thursday, so the grid's first cells are
    // trailing September days.
    expect(grid[0].inMonth).toBe(false);
    const oct5 = grid.find((d) => d.date === "2026-10-05");
    expect(oct5?.inMonth).toBe(true);
  });

  it("attaches a single-day event only to its own date", () => {
    const grid = buildMonthGrid({ year: 2026, month: 10 }, events);
    const oct5 = grid.find((d) => d.date === "2026-10-05");
    const oct6 = grid.find((d) => d.date === "2026-10-06");
    expect(oct5?.events.map((e) => e.id)).toContain("1");
    expect(oct6?.events.map((e) => e.id)).not.toContain("1");
  });

  it("attaches a multi-day event to every day in its range", () => {
    const grid = buildMonthGrid({ year: 2026, month: 10 }, events);
    for (const date of ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"]) {
      const day = grid.find((d) => d.date === date);
      expect(day?.events.map((e) => e.id)).toContain("2");
    }
    const oct7 = grid.find((d) => d.date === "2026-10-07");
    expect(oct7?.events.map((e) => e.id)).not.toContain("2");
  });

  it("marks isStart true only on an event's actual start date", () => {
    const grid = buildMonthGrid({ year: 2026, month: 10 }, events);
    const oct3 = grid.find((d) => d.date === "2026-10-03");
    const oct4 = grid.find((d) => d.date === "2026-10-04");
    expect(oct3?.events.find((e) => e.id === "2")?.isStart).toBe(true);
    expect(oct4?.events.find((e) => e.id === "2")?.isStart).toBe(false);
  });
});
