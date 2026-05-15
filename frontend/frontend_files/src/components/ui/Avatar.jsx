import clsx from "clsx";
import { initials } from "../../lib/format.js";

export function Avatar({ name, src, size = 28, className }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name || ""}
        width={size}
        height={size}
        className={clsx("rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-full bg-brand-100 text-brand-800 font-medium",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
    >
      {initials(name).toUpperCase()}
    </span>
  );
}
