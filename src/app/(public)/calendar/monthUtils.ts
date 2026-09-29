export interface MonthParam {
  year: number;
  month: number; // 1-12
}

export function parseMonthParam(value: string | undefined): MonthParam {
  const now = new Date();
  const fallback: MonthParam = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  if (!value) return fallback;

  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return fallback;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return fallback;

  return { year, month };
}

export function formatMonthParam({ year, month }: MonthParam): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function adjacentMonth({ year, month }: MonthParam, delta: 1 | -1): MonthParam {
  const zeroBasedTotal = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(zeroBasedTotal / 12);
  const newMonth = ((zeroBasedTotal % 12) + 12) % 12;
  return { year: newYear, month: newMonth + 1 };
}

export interface CalendarEventLike {
  id: string;
  title: string;
  category: string;
  startDate: string; // YYYY-MM-DD, UTC
  endDate: string; // YYYY-MM-DD, UTC
  description: string;
  teacherName?: string;
  sessionDateTime?: string; // ISO
  durationMinutes?: number;
  price?: number;
  capacity?: number;
  applicantCount?: number;
}

export interface GridEvent extends CalendarEventLike {
  isStart: boolean;
}

export interface GridDay {
  date: string; // YYYY-MM-DD, UTC
  inMonth: boolean;
  events: GridEvent[];
}

export function buildMonthGrid(
  { year, month }: MonthParam,
  events: CalendarEventLike[],
): GridDay[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = firstOfMonth.getUTCDay(); // 0 = Sunday

  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(firstOfMonth.getUTCDate() - startWeekday);

  const days: GridDay[] = [];
  for (let i = 0; i < 42; i++) {
    const current = new Date(gridStart);
    current.setUTCDate(gridStart.getUTCDate() + i);
    const dateStr = current.toISOString().slice(0, 10);
    const inMonth = current.getUTCMonth() === month - 1;

    const dayEvents: GridEvent[] = events
      .filter((e) => e.startDate <= dateStr && dateStr <= e.endDate)
      .map((e) => ({ ...e, isStart: e.startDate === dateStr }));

    days.push({ date: dateStr, inMonth, events: dayEvents });
  }

  return days;
}
