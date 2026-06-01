import { format, formatDistanceToNow, parseISO } from "date-fns";

export function relTime(value) {
  if (!value) return "—";
  try {
    const d = value instanceof Date ? value : parseISO(value);
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "—";
  }
}

export function fmtDate(value, pattern = "PPp") {
  if (!value) return "—";
  try {
    const d = value instanceof Date ? value : parseISO(value);
    return format(d, pattern);
  } catch {
    return "—";
  }
}

export function fmtNum(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export function initials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}
