import { isChatStaff } from "@/lib/chat-constants";

type BuildIndicatorProps = {
  userRole: string;
};

export function BuildIndicator({ userRole }: BuildIndicatorProps) {
  if (!isChatStaff(userRole)) {
    return null;
  }

  const buildSha = process.env.BUILD_SHA?.trim() ?? "";
  const buildBranch = process.env.BUILD_BRANCH?.trim() ?? "";
  const isLocalDev = !buildSha && process.env.NODE_ENV !== "production";

  if (!buildSha && !isLocalDev) {
    return null;
  }

  const shortSha = buildSha ? buildSha.slice(0, 7) : null;
  const label = shortSha
    ? `${buildBranch || "build"} · ${shortSha}`
    : "local dev";
  const title = shortSha
    ? [`Branch: ${buildBranch || "unknown"}`, `Commit: ${buildSha}`].join("\n")
    : "Local development build";

  return (
    <div className="fixed bottom-3 left-4 z-20">
      <div
        title={title}
        className="rounded-full border border-white/8 bg-surface-elevated/90 px-3 py-1.5 text-[11px] font-medium tracking-wide text-text-muted shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-sm"
      >
        {label}
      </div>
    </div>
  );
}
