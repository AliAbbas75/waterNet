import clsx from "clsx";

export function Stat({ label, value, icon: Icon, trend, accent = "brand", className }) {
  const accents = {
    brand: "bg-brand-50 text-brand-700",
    safe: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    unsafe: "bg-red-50 text-red-700",
    neutral: "bg-slate-100 text-slate-700"
  };
  return (
    <div className={clsx("bg-white rounded-xl border border-slate-200 shadow-card p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-2xl sm:text-3xl font-semibold text-slate-900 truncate">{value}</p>
          {trend ? <p className="mt-1 text-xs text-slate-500">{trend}</p> : null}
        </div>
        {Icon ? (
          <div className={clsx("inline-flex h-10 w-10 items-center justify-center rounded-lg shrink-0", accents[accent])}>
            <Icon size={20} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
