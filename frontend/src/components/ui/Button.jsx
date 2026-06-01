import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

const VARIANTS = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-300 disabled:bg-brand-300",
  secondary:
    "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 focus-visible:ring-slate-300",
  ghost: "text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-200",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-300",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-300"
};

const SIZES = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2"
};

export const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    className,
    children,
    loading,
    disabled,
    leftIcon,
    rightIcon,
    type = "button",
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        "disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" size={16} /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
