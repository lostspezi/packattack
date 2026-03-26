"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(260, options.length * 36 + 12);
    const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: Math.max(rect.width, 140),
      zIndex: 9999,
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleScroll() {
      updatePosition();
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open]);

  const sizeClasses = size === "sm"
    ? "px-2.5 py-1.5 text-xs"
    : "px-3.5 py-2.5 text-sm";

  const dropdownItemSize = size === "sm"
    ? "px-2.5 py-1.5 text-xs"
    : "px-3.5 py-2 text-sm";

  const dropdown = open && typeof document !== "undefined" ? createPortal(
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-surface-elevated border border-border rounded-[12px] py-1.5 shadow-xl shadow-black/30 overflow-hidden"
    >
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
    </div>,
    document.body
  ) : null;

  return (
    <div
      ref={containerRef}
      className={["relative inline-block", className].filter(Boolean).join(" ")}
    >
      <button
        ref={triggerRef}
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
      {dropdown}
    </div>
  );
}

export { Select };
