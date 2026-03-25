"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
}

function Select({
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className = "",
  size = "md",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleEsc);
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  const sizeClasses = size === "sm"
    ? "px-2.5 py-1.5 text-xs"
    : "px-3.5 py-2.5 text-sm";

  const dropdownItemSize = size === "sm"
    ? "px-2.5 py-1.5 text-xs"
    : "px-3.5 py-2 text-sm";

  return (
    <div
      ref={containerRef}
      className={["relative inline-block", className].filter(Boolean).join(" ")}
    >
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        className={[
          "flex items-center justify-between gap-2 rounded-[10px] border transition-colors w-full text-left",
          "bg-surface-elevated border-border",
          open
            ? "border-pa-green/35 ring-2 ring-pa-green/6"
            : "hover:border-white/15",
          disabled ? "opacity-50 cursor-not-allowed" : "",
          sizeClasses,
        ].join(" ")}
      >
        <span className={selectedOption ? "text-text-primary" : "text-text-muted"}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          size={size === "sm" ? 14 : 16}
          className={[
            "text-text-muted transition-transform flex-shrink-0",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[140px] bg-surface-elevated border border-border rounded-[12px] py-1.5 shadow-xl shadow-black/30 overflow-hidden">
          <div className="max-h-[240px] overflow-y-auto">
            {options.map((option) => {
              const isSelected = option.value === value;
              const isDisabled = option.disabled;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    if (!isDisabled) {
                      onChange(option.value);
                      setOpen(false);
                    }
                  }}
                  disabled={isDisabled}
                  className={[
                    "w-full text-left flex items-center justify-between gap-2 transition-colors",
                    dropdownItemSize,
                    isSelected
                      ? "bg-pa-green/8 text-pa-green"
                      : "text-text-primary hover:bg-white/4",
                    isDisabled
                      ? "opacity-35 cursor-not-allowed"
                      : "",
                  ].join(" ")}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <Check size={size === "sm" ? 12 : 14} className="text-pa-green flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { Select };
