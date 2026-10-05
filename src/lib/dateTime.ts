export const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function isRealDateTime(value: string): boolean {
  if (!DATETIME_RE.test(value)) {
    return false;
  }
  const date = new Date(`${value}:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.toISOString().slice(0, 16) === value;
}

// Lives here (not inline in components) so render code stays pure per react-hooks/purity.
export function hasDatePassed(value: Date | string): boolean {
  return new Date(value).getTime() <= Date.now();
}
