"use client";

import Link from "next/link";
import { LayoutGroup, motion } from "motion/react";
import type { ReactNode } from "react";

interface HeaderNavItemProps {
  href: string;
  active: boolean;
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  badge?: ReactNode;
  children?: ReactNode;
  megaMenuActive?: boolean;
  labelClassName?: string;
  "aria-haspopup"?: "true" | "false";
  "aria-expanded"?: boolean;
}

export function HeaderNavItem({
  href,
  active,
  icon,
  label,
  disabled,
  badge,
  children,
  megaMenuActive,
  labelClassName,
  "aria-haspopup": ariaHasPopup,
  "aria-expanded": ariaExpanded,
}: HeaderNavItemProps) {
  // When the visible label is collapsed at some breakpoints, keep an
  // always-present sr-only copy so the accessible name is stable.
  const hasResponsiveLabel = Boolean(labelClassName);

  if (disabled) {
    return (
      <span className="relative select-none rounded-lg px-3 py-2 text-sm font-medium text-text-muted opacity-35">
        <span className="flex items-center gap-2">
          {icon}
          {hasResponsiveLabel && <span className="sr-only">{label}</span>}
          <span className={labelClassName} aria-hidden={hasResponsiveLabel}>
            {label}
          </span>
          {badge}
        </span>
      </span>
    );
  }

  const isHighlighted = active || megaMenuActive;

  return (
    <Link
      href={href}
      className={[
        "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
        isHighlighted
          ? "text-pa-green"
          : "text-text-secondary hover:bg-white/5 hover:text-text-primary",
      ].join(" ")}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
    >
      {icon}
      {hasResponsiveLabel && <span className="sr-only">{label}</span>}
      <span className={labelClassName} aria-hidden={hasResponsiveLabel}>
        {label}
      </span>
      {children}
      {active && (
        <motion.span
          layoutId="nav-active-indicator"
          className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-pa-green animate-nav-indicator-glow"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
    </Link>
  );
}

/**
 * Wrap HeaderNav items in this to enable smooth layoutId
 * animations for the active indicator across route changes.
 */
export function HeaderNavGroup({ children }: { children: ReactNode }) {
  return <LayoutGroup>{children}</LayoutGroup>;
}
