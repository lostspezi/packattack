import React from "react";

type BadgeVariant =
  | "user"
  | "shop"
  | "moderator"
  | "admin"
  | "super_admin"
  | "online"
  | "verified"
  | "banned"
  | "info"
  | "success"
  | "warning"
  | "error";

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children?: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  user: "bg-white/4 text-text-muted border border-white/6",
  shop: "bg-white/4 text-text-secondary border border-white/6",
  moderator: "bg-pa-lila/40 text-purple-300 border border-purple-300/15",
  admin: "bg-pa-green/10 text-pa-green border border-pa-green/15",
  super_admin:
    "bg-gradient-to-br from-pa-green/10 to-pa-lila/20 text-pa-green border border-pa-green/15",
  online: "bg-green-500/10 text-green-400 border border-green-400/15",
  verified: "bg-pa-green/10 text-pa-green border border-pa-green/15",
  banned: "bg-error/10 text-error border border-error/15",
  info: "bg-blue-500/10 text-blue-400 border border-blue-400/15",
  success: "bg-green-500/10 text-green-400 border border-green-400/15",
  warning: "bg-yellow-500/10 text-yellow-400 border border-yellow-400/15",
  error: "bg-error/10 text-error border border-error/15",
};

function BadgeInner({ variant = "user", className = "", children }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {variant === "online" && (
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
      )}
      {variant === "verified" && (
        <svg
          className="w-3 h-3"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 6l3 3 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {children}
    </span>
  );
}

BadgeInner.displayName = "Badge";

export { BadgeInner as Badge };
export type { BadgeProps, BadgeVariant };
