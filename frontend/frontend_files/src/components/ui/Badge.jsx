import clsx from "clsx";

const VARIANTS = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
  safe: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warn: "bg-amber-50 text-amber-700 ring-amber-200",
  unsafe: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  muted: "bg-slate-50 text-slate-500 ring-slate-200"
};

export function Badge({ variant = "neutral", className, dot = false, children }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        VARIANTS[variant] || VARIANTS.neutral,
        className
      )}
    >
      {dot ? <span className={clsx("h-1.5 w-1.5 rounded-full", dotColor(variant))} /> : null}
      {children}
    </span>
  );
}

function dotColor(variant) {
  switch (variant) {
    case "safe":
      return "bg-emerald-500";
    case "warn":
      return "bg-amber-500";
    case "unsafe":
      return "bg-red-500";
    case "info":
      return "bg-sky-500";
    case "brand":
      return "bg-brand-500";
    default:
      return "bg-slate-400";
  }
}

export function statusVariant(status) {
  switch (String(status || "").toUpperCase()) {
    case "SAFE":
    case "OPERATIONAL":
    case "RESOLVED":
    case "AVAILABLE":
    case "CLOSED":
      return "safe";
    case "WARNING":
    case "WARN":
    case "MAINTENANCE":
    case "IN_PROGRESS":
    case "IN_REVIEW":
    case "ACK":
      return "warn";
    case "UNSAFE":
    case "CRITICAL":
    case "OFFLINE":
    case "FAULTY":
    case "UNAVAILABLE":
    case "OPEN":
      return "unsafe";
    case "INFO":
      return "info";
    case "ASSIGNED":
      return "brand";
    default:
      return "neutral";
  }
}
