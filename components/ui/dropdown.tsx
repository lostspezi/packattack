"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

interface DropdownItem {
  label: string;
  value: string;
  onClick: (value: string) => void;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  side?: "auto" | "top" | "bottom";
  className?: string;
  minWidth?: number;
  selectedValue?: string;
}

function Dropdown({
  trigger,
  items,
  align = "left",
  side = "auto",
  className = "",
  minWidth = 160,
  selectedValue,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = Math.min(window.innerWidth - 16, Math.max(minWidth, rect.width));
    const menuHeight = Math.min(320, dropdownRef.current?.offsetHeight ?? items.length * 40 + 12);
    const shouldOpenUpward =
      side === "top" ||
      (side === "auto" &&
        window.innerHeight - rect.bottom < menuHeight + 12 &&
        rect.top > menuHeight + 12);

    const left =
      align === "right"
        ? Math.max(8, rect.right - menuWidth)
        : Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.left));

    setDropdownStyle({
      position: "fixed",
      left,
      width: menuWidth,
      maxWidth: window.innerWidth - 16,
      zIndex: 95,
      ...(shouldOpenUpward
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
  }, [align, items.length, minWidth, side]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      updatePosition();
      const frame = window.requestAnimationFrame(updatePosition);
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);

      return () => {
        window.cancelAnimationFrame(frame);
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open]);

  const dropdown =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="overflow-hidden rounded-[10px] border border-border bg-surface-elevated py-1 shadow-xl shadow-black/30"
          >
            {items.map((item) => {
              const isSelected = selectedValue === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    item.onClick(item.value);
                    setOpen(false);
                  }}
                  className={[
                    "flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors",
                    isSelected
                      ? "bg-pa-green/8 text-pa-green"
                      : "text-text-primary hover:bg-white/4",
                  ].join(" ")}
                >
                  <span>{item.label}</span>
                  {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={containerRef}
      className={["relative inline-block", className].filter(Boolean).join(" ")}
    >
      <div
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        className="cursor-pointer"
      >
        {trigger}
      </div>
      {dropdown}
    </div>
  );
}

export { Dropdown };
export type { DropdownProps, DropdownItem };
