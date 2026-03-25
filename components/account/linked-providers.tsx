"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface LinkedProvider {
  provider: string;
  providerAccountId: string;
}

interface LinkedProvidersProps {
  dict: Record<string, string>;
  initialProviders: LinkedProvider[];
}

const providerConfig: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  discord: {
    label: "Discord",
    color: "text-[#5865F2]",
    bgColor: "bg-[#5865F2]/10 border-[#5865F2]/20",
  },
  twitch: {
    label: "Twitch",
    color: "text-[#9146FF]",
    bgColor: "bg-[#9146FF]/10 border-[#9146FF]/20",
  },
  google: {
    label: "Google",
    color: "text-[#EA4335]",
    bgColor: "bg-[#EA4335]/10 border-[#EA4335]/20",
  },
};

const ALL_PROVIDERS = ["discord", "twitch", "google"] as const;

export function LinkedProviders({ dict, initialProviders }: LinkedProvidersProps) {
  const { toast } = useToast();
  const [providers, setProviders] = useState(initialProviders);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const linkedSet = new Set(providers.map((p) => p.provider));

  async function handleUnlink(provider: string) {
    setLoadingProvider(provider);
    try {
      const res = await fetch("/api/account/link", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        const errorMap: Record<string, string> = {
          last_login_method:
            dict["error_last_login_method"] ??
            "Cannot unlink: this is your only login method",
        };
        toast({
          type: "error",
          title:
            (data.error && errorMap[data.error]) ||
            (dict["error_unlink"] ?? "Failed to unlink provider"),
        });
        return;
      }

      setProviders((prev) => prev.filter((p) => p.provider !== provider));
      toast({
        type: "success",
        title: dict["success_unlinked"] ?? "Provider unlinked successfully",
      });
    } catch {
      toast({
        type: "error",
        title: dict["error_unexpected"] ?? "An unexpected error occurred",
      });
    } finally {
      setLoadingProvider(null);
    }
  }

  return (
    <div className="space-y-3">
      {ALL_PROVIDERS.map((providerKey) => {
        const config = providerConfig[providerKey] ?? {
          label: providerKey,
          color: "text-text-primary",
          bgColor: "bg-white/4 border-white/8",
        };
        const isLinked = linkedSet.has(providerKey);

        return (
          <div
            key={providerKey}
            className={[
              "flex items-center justify-between p-4 rounded-[10px] border",
              isLinked ? config.bgColor : "bg-white/2 border-white/6",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <span
                className={[
                  "text-sm font-semibold",
                  isLinked ? config.color : "text-text-muted",
                ].join(" ")}
              >
                {config.label}
              </span>
              {isLinked ? (
                <span className="text-xs text-green-400 bg-green-400/10 border border-green-400/15 px-2 py-0.5 rounded-full">
                  {dict["status_linked"] ?? "Linked"}
                </span>
              ) : (
                <span className="text-xs text-text-muted bg-white/4 border border-white/8 px-2 py-0.5 rounded-full">
                  {dict["status_not_linked"] ?? "Not linked"}
                </span>
              )}
            </div>
            {isLinked ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={loadingProvider === providerKey}
                onClick={() => handleUnlink(providerKey)}
              >
                {dict["button_unlink"] ?? "Unlink"}
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
