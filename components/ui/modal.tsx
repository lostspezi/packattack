"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

type ModalSize = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  size?: ModalSize;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-4xl",
};

function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        className={[
          "relative w-full bg-surface-elevated border border-border rounded-[14px] shadow-xl p-6",
          sizeClasses[size],
          size === "xl" ? "max-h-[90vh] overflow-y-auto" : "",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          {title && (
            <h2 className="text-text-primary font-semibold text-lg">{title}</h2>
          )}
          <button
            onClick={onClose}
            className="ml-auto text-text-muted hover:text-text-secondary flex-shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export { Modal };
export type { ModalProps, ModalSize };
