import React from "react";

type CardVariant = "soft" | "accent" | "topline" | "cut";

interface CardProps {
  variant?: CardVariant;
  className?: string;
  children?: React.ReactNode;
}

const variantClasses: Record<CardVariant, string> = {
  soft: "bg-white/3 border border-white/6 rounded-[14px]",
  accent:
    "bg-gradient-to-br from-pa-lila/20 to-white/2 border border-pa-green/8 rounded-[14px]",
  topline:
    "bg-white/3 border border-white/6 rounded-[14px] border-t-2 border-t-pa-green",
  cut: "bg-white/3",
};

function Card({ variant = "soft", className = "", children }: CardProps) {
  const isCut = variant === "cut";

  return (
    <div
      className={[variantClasses[variant], className].filter(Boolean).join(" ")}
      style={
        isCut
          ? {
              clipPath:
                "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))",
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

export { Card };
export type { CardProps, CardVariant };
