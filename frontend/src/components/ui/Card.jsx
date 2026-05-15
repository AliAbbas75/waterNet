import clsx from "clsx";

export function Card({ className, children, padded = true, ...rest }) {
  return (
    <div
      className={clsx(
        "bg-white rounded-xl border border-slate-200 shadow-card",
        padded && "p-5",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={clsx("flex items-start justify-between gap-3 mb-3", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900 truncate">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
