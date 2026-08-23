import clsx from "clsx";
import { Link } from "react-router-dom";

export function Stat({
  label,
  value,
  icon: Icon,
  trend,
  accent = "brand",
  className,
  to,
  onClick,
  ...rest
}) {
  const accents = {
    brand: "bg-brand-50 text-brand-700",
    safe: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    unsafe: "bg-red-50 text-red-700",
    neutral: "bg-slate-100 text-slate-700"
  };

  const content = (
    <>
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
    </>
  );

  const commonClassName = clsx(
    "block bg-white rounded-xl border border-slate-200 shadow-card p-4 sm:p-5 transition-all duration-200",
    (to || onClick) && "cursor-pointer hover:shadow-md hover:border-brand-200 hover:bg-brand-50/30 focus:outline-none focus:ring-2 focus:ring-brand-500/30",
    className
  );

  if (to) {
    return (
      <Link to={to} className={commonClassName} {...rest}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={commonClassName} {...rest}>
        {content}
      </button>
    );
  }

  return (
    <div className={commonClassName} {...rest}>
      {content}
    </div>
  );
}
