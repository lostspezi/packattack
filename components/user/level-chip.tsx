"use client";

interface LevelChipProps {
  level: number;
  compact?: boolean;
  className?: string;
}

/**
 * Kompaktes Level-Abzeichen, gedacht für Header, Chat-Nachrichten und
 * Kommentare. Wird ab Milestone-Levels farblich aufgewertet.
 */
export function LevelChip({ level, compact = false, className }: LevelChipProps) {
  const tone =
    level >= 100
      ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white"
      : level >= 50
        ? "bg-gradient-to-br from-purple-500 to-indigo-700 text-white"
        : level >= 25
          ? "bg-pa-blue/20 text-pa-blue border border-pa-blue/30"
          : level >= 10
            ? "bg-pa-green/20 text-pa-green border border-pa-green/30"
            : "bg-surface text-secondary border border-border";

  const size = compact ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${size} ${tone} ${className ?? ""}`}
      title={`Level ${level}`}
    >
      Lvl {level}
    </span>
  );
}
