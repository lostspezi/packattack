"use client";

import React, { useState, useRef, useEffect } from "react";

interface DropdownItem {
  label: string;
  value: string;
  onClick: (value: string) => void;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  className?: string;
}

function Dropdown({ trigger, items, align = "left", className = "" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={containerRef}
      className={["relative inline-block", className].filter(Boolean).join(" ")}
    >
      <div
        onClick={() => setOpen((prev) => !prev)}
        className="cursor-pointer"
      >
        {trigger}
      </div>
      {open && (
        <div
          className={[
            "absolute z-50 mt-1 min-w-[160px] bg-surface-elevated border border-border rounded-[10px] py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          ].join(" ")}
        >
          {items.map((item) => (
            <button
              key={item.value}
              onClick={() => {
                item.onClick(item.value);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-white/4"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { Dropdown };
export type { DropdownProps, DropdownItem };
