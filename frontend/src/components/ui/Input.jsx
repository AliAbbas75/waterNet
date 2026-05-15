import clsx from "clsx";
import { forwardRef } from "react";

const baseInput =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-shadow " +
  "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 " +
  "disabled:bg-slate-50 disabled:cursor-not-allowed";

export const Input = forwardRef(function Input({ className, leftIcon, ...rest }, ref) {
  if (leftIcon) {
    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{leftIcon}</span>
        <input ref={ref} className={clsx(baseInput, "pl-9", className)} {...rest} />
      </div>
    );
  }
  return <input ref={ref} className={clsx(baseInput, className)} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ className, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={clsx(baseInput, "min-h-[80px]", className)} {...rest} />;
});

export const Select = forwardRef(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={clsx(
        baseInput,
        "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 20 20\\' fill=\\'%2364748b\\'><path fill-rule=\\'evenodd\\' d=\\'M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z\\' clip-rule=\\'evenodd\\'/></svg>')] bg-[length:14px] bg-[right_0.7rem_center] bg-no-repeat pr-9",
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export function FieldLabel({ children, htmlFor, hint, required }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-700 mb-1">
      {children}
      {required ? <span className="text-red-500 ml-0.5">*</span> : null}
      {hint ? <span className="text-slate-400 font-normal ml-1.5">{hint}</span> : null}
    </label>
  );
}

export function Field({ label, hint, error, required, htmlFor, children }) {
  return (
    <div>
      {label ? <FieldLabel htmlFor={htmlFor} hint={hint} required={required}>{label}</FieldLabel> : null}
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
