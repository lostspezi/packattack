"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface AvatarSelectorProps {
  currentImage: string | null;
  lang: string;
  linkedProviders: string[];
  onAvatarChange: (url: string | null) => void;
}

const MAX_SIZE = 1 * 1024 * 1024; // 1 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg"];
const MAX_DIM = 500;

function validateImageDimensions(
  file: File
): Promise<{ valid: boolean; message?: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width > MAX_DIM || img.height > MAX_DIM) {
        resolve({
          valid: false,
          message: `Image must be ${MAX_DIM}x${MAX_DIM} pixels or smaller (got ${img.width}x${img.height})`,
        });
      } else {
        resolve({ valid: true });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ valid: false, message: "Could not read image dimensions" });
    };
    img.src = url;
  });
}

export function AvatarSelector({
  currentImage,
  linkedProviders,
  onAvatarChange,
}: AvatarSelectorProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImage);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [selectingProvider, setSelectingProvider] = useState<string | null>(
    null
  );

  const hasDiscord = linkedProviders.includes("discord");
  const hasTwitch = linkedProviders.includes("twitch");
  const [cacheBust, setCacheBust] = useState(0);

  function avatarSrc(url: string | null): string | null {
    if (!url) return null;
    if (url === "/api/profile/avatar/file" && cacheBust > 0) {
      return `${url}?t=${cacheBust}`;
    }
    return url;
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!e.target.files) return;
    // Reset so same file can be re-selected
    e.target.value = "";

    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ type: "error", title: "Only PNG and JPG files are allowed" });
      return;
    }

    if (file.size > MAX_SIZE) {
      toast({ type: "error", title: "File size must be 1MB or less" });
      return;
    }

    const dimCheck = await validateImageDimensions(file);
    if (!dimCheck.valid) {
      toast({ type: "error", title: dimCheck.message ?? "Invalid image" });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as { error?: string; image?: string };

      if (!res.ok) {
        toast({
          type: "error",
          title: data.error ?? "Failed to upload avatar",
        });
        return;
      }

      const newUrl = data.image ?? "/api/profile/avatar/file";
      setCacheBust(Date.now());
      setPreviewUrl(null);
      onAvatarChange(newUrl);
      toast({ type: "success", title: "Avatar updated" });
    } catch {
      toast({ type: "error", title: "An unexpected error occurred" });
    } finally {
      setUploading(false);
    }
  }

  async function handleProviderSelect(provider: "discord" | "twitch") {
    setSelectingProvider(provider);
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      const data = (await res.json()) as { error?: string; image?: string };

      if (!res.ok) {
        toast({
          type: "error",
          title: data.error ?? `Failed to use ${provider} avatar`,
        });
        return;
      }

      const newUrl = data.image ?? null;
      setPreviewUrl(newUrl);
      onAvatarChange(newUrl);
      toast({
        type: "success",
        title: `Avatar updated to ${provider} profile picture`,
      });
    } catch {
      toast({ type: "error", title: "An unexpected error occurred" });
    } finally {
      setSelectingProvider(null);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast({
          type: "error",
          title: data.error ?? "Failed to remove avatar",
        });
        return;
      }

      setPreviewUrl(null);
      onAvatarChange(null);
      toast({ type: "success", title: "Avatar removed" });
    } catch {
      toast({ type: "error", title: "An unexpected error occurred" });
    } finally {
      setRemoving(false);
    }
  }

  const displaySrc = avatarSrc(previewUrl) ?? "/images/default-avatar.png";

  return (
    <div className="flex flex-col gap-4">
      {/* Current avatar preview */}
      <div className="flex items-center gap-5">
        <div className="relative w-20 h-20 rounded-full overflow-hidden bg-white/6 border border-white/10 flex items-center justify-center flex-shrink-0">
          <Image
            src={displaySrc}
            alt="Avatar"
            fill
            className="object-cover"
            unoptimized
          />
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-sm text-text-primary font-medium">
            Profile Picture
          </p>
          <p className="text-xs text-text-muted">
            PNG or JPG, max 500×500 px, max 1 MB
          </p>
        </div>
      </div>

      {/* Provider + upload buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Discord */}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!hasDiscord || selectingProvider === "discord"}
          loading={selectingProvider === "discord"}
          onClick={() => handleProviderSelect("discord")}
          title={
            hasDiscord
              ? "Use Discord avatar"
              : "Link your Discord account first"
          }
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
          </svg>
          Discord
          {!hasDiscord && (
            <span className="text-xs text-text-muted">(not linked)</span>
          )}
        </Button>

        {/* Twitch */}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!hasTwitch || selectingProvider === "twitch"}
          loading={selectingProvider === "twitch"}
          onClick={() => handleProviderSelect("twitch")}
          title={
            hasTwitch ? "Use Twitch avatar" : "Link your Twitch account first"
          }
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
          </svg>
          Twitch
          {!hasTwitch && (
            <span className="text-xs text-text-muted">(not linked)</span>
          )}
        </Button>

        {/* Custom upload */}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload
        </Button>

        {/* Remove */}
        {previewUrl && (
          <Button
            type="button"
            variant="danger"
            size="sm"
            loading={removing}
            onClick={handleRemove}
          >
            Remove
          </Button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
