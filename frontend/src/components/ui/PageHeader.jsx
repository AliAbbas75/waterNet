import clsx from "clsx";

export function PageHeader({ title, description, action, className }) {
  return (
    <div className={clsx("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-5", className)}>
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
