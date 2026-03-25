"use client";

import React from "react";

interface CheckboxProps {
  label?: string;
  error?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  id?: string;
}

function Checkbox({
  label,
  error,
  checked,
  onCheckedChange,
  className = "",
  id,
}: CheckboxProps) {
  const checkboxId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className={["flex flex-col gap-1.5", className].filter(Boolean).join(" ")}>
      <label
        htmlFor={checkboxId}
        className="inline-flex items-center gap-2.5 cursor-pointer"
      >
        <span
          role="checkbox"
          aria-checked={checked}
          tabIndex={0}
          id={checkboxId}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              onCheckedChange(!checked);
            }
          }}
          onClick={() => onCheckedChange(!checked)}
          className={[
            "w-5 h-5 rounded-[5px] border-2 flex items-center justify-center flex-shrink-0",
            checked
              ? "bg-pa-green border-pa-green"
              : "bg-transparent border-white/20",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {checked && (
            <svg
              className="w-3 h-3 text-bg"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        {label && (
          <span className="text-text-secondary text-sm">{label}</span>
        )}
      </label>
      {error && <span className="text-error text-xs">{error}</span>}
    </div>
  );
}

export { Checkbox };
export type { CheckboxProps };
