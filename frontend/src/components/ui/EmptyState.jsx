import clsx from "clsx";

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-dashed border-slate-200 bg-white/60 p-8 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Icon size={20} />
        </div>
      ) : null}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
