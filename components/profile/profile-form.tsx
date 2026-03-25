"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { AvatarSelector } from "@/components/profile/avatar-selector";

interface ProfileData {
  name: string;
  username: string;
  bio: string | null;
  socialLinks: {
    discord?: string;
    twitch?: string;
    twitter?: string;
    youtube?: string;
  };
  publicProfile: boolean;
  role: string;
  image: string | null;
}

interface ProfileFormProps {
  dict: Record<string, string>;
  lang: string;
  initialData: ProfileData;
  linkedProviders?: string[];
}

export function ProfileForm({ dict, initialData, linkedProviders = [] }: ProfileFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(initialData.name);
  const [username, setUsername] = useState(initialData.username);
  const [bio, setBio] = useState(initialData.bio ?? "");
  const [discord, setDiscord] = useState(initialData.socialLinks?.discord ?? "");
  const [twitch, setTwitch] = useState(initialData.socialLinks?.twitch ?? "");
  const [twitter, setTwitter] = useState(initialData.socialLinks?.twitter ?? "");
  const [youtube, setYoutube] = useState(initialData.socialLinks?.youtube ?? "");
  const [publicProfile, setPublicProfile] = useState(initialData.publicProfile);
  const [currentImage, setCurrentImage] = useState(initialData.image);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          username,
          bio: bio || null,
          socialLinks: { discord, twitch, twitter, youtube },
          publicProfile,
        }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        if (data.error === "username_taken") {
          toast({
            type: "error",
            title: dict["error_username_taken"] ?? "Username already taken",
          });
        } else {
          toast({
            type: "error",
            title: dict["error_save"] ?? "Failed to save profile",
          });
        }
        return;
      }

      toast({
        type: "success",
        title: dict["success_saved"] ?? "Profile saved successfully",
      });
    } catch {
      toast({
        type: "error",
        title: dict["error_unexpected"] ?? "An unexpected error occurred",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
          {dict["section_avatar"] ?? "Avatar"}
        </h3>
        <AvatarSelector
          currentImage={currentImage}
          lang=""
          linkedProviders={linkedProviders}
          onAvatarChange={setCurrentImage}
        />
      </div>

      {/* Basic Info */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
          {dict["section_basic_info"] ?? "Basic Info"}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={dict["label_name"] ?? "Name"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={50}
          />
          <Input
            label={dict["label_username"] ?? "Username"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={30}
          />
        </div>
      </div>

      {/* Bio */}
      <div className="flex flex-col gap-1.5">
        <label className="text-text-secondary text-sm font-medium">
          {dict["label_bio"] ?? "Bio"}
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={3}
          className="bg-white/3 border border-white/8 text-text-primary rounded-[10px] px-4 py-3 outline-none focus:border-pa-green/35 focus:ring-2 focus:ring-pa-green/6 resize-none"
          placeholder={dict["placeholder_bio"] ?? "Tell others about yourself…"}
        />
        <span className="text-xs text-text-muted text-right">
          {bio.length}/500
        </span>
      </div>

      {/* Social Links */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
          {dict["section_social_links"] ?? "Social Links"}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Discord
            </label>
            <Input
              value={discord}
              onChange={(e) => setDiscord(e.target.value)}
              placeholder="username#0000"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Twitch
            </label>
            <Input
              value={twitch}
              onChange={(e) => setTwitch(e.target.value)}
              placeholder="twitchusername"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              Twitter / X
            </label>
            <Input
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              placeholder="@handle"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-text-secondary text-sm font-medium">
              YouTube
            </label>
            <Input
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              placeholder="channel name or URL"
            />
          </div>
        </div>
      </div>

      {/* Public Profile */}
      <Checkbox
        id="public-profile"
        label={dict["label_public_profile"] ?? "Public Profile"}
        checked={publicProfile}
        onCheckedChange={setPublicProfile}
      />

      <div className="flex">
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={loading}
          className="w-full md:w-auto"
        >
          {dict["button_save"] ?? "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
