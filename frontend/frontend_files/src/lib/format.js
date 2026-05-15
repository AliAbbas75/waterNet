import { formatDistanceToNow, format, parseISO } from "date-fns";

export function relTime(value) {
  if (!value) return "—";
  const d = value instanceof Date ? value : parseISO(value);
  return formatDistanceToNow(d, { addSuffix: true });
}

export function fmtDate(value, pattern = "PPp") {
  if (!value) return "—";
  const d = value instanceof Date ? value : parseISO(value);
  return format(d, pattern);
}

export function fmtNum(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export function fmtMinutes(min) {
  if (!Number.isFinite(min) || min <= 0) return "—";
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function initials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  return (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
}

export function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
