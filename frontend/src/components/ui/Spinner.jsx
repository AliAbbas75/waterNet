import { Loader2 } from "lucide-react";
import clsx from "clsx";

export function Spinner({ label, size = "md", className }) {
  const px = size === "sm" ? 16 : size === "lg" ? 32 : 22;
  return (
    <div className={clsx("inline-flex items-center gap-2 text-slate-500", className)}>
      <Loader2 className="animate-spin" size={px} />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  );
}
