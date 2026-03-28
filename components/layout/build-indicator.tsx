import { connection } from "next/server";
import { isChatStaff } from "@/lib/chat-constants";

type BuildIndicatorProps = {
  userRole: string;
};

export async function BuildIndicator({ userRole }: BuildIndicatorProps) {
  if (!isChatStaff(userRole)) {
    return null;
  }

  await connection();

  const buildSha = process.env.BUILD_SHA?.trim() ?? "";
  const buildBranch = process.env.BUILD_BRANCH?.trim() ?? "";
  const isLocalDev = process.env.NODE_ENV !== "production";
  const shortSha = buildSha ? buildSha.slice(0, 7) : null;
  const label = shortSha
    ? `${buildBranch || "build"} · ${shortSha}`
    : isLocalDev
      ? "local dev"
      : "build unknown";
  const title = shortSha
    ? [`Branch: ${buildBranch || "unknown"}`, `Commit: ${buildSha}`, "Source: runtime env"].join("\n")
    : isLocalDev
      ? "Local development build"
      : "Branch: unknown\nCommit: missing\nSource: runtime env missing";

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
