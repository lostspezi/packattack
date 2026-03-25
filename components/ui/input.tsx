"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  className?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-text-secondary text-sm font-medium"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            "bg-white/3 border text-text-primary rounded-[10px] px-4 py-3 outline-none",
            "focus:border-pa-green/35 focus:ring-2 focus:ring-pa-green/6",
            error
              ? "border-error/30 ring-2 ring-error/6"
              : "border-white/8",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {error && <span className="text-error text-xs">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
