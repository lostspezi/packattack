import type { UpvoteCampaignStatus } from "@/models/upvote-campaign";

const ALLOWED_TRANSITIONS: Record<UpvoteCampaignStatus, UpvoteCampaignStatus[]> = {
  draft: ["active"],
  active: ["closed"],
  closed: [],
};

export function canTransition(
  from: UpvoteCampaignStatus,
  to: UpvoteCampaignStatus
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function shouldAutoClose(
  campaign: { status: UpvoteCampaignStatus; endsAt: Date | null },
  now: Date = new Date()
): boolean {
  if (campaign.status !== "active") return false;
  if (!campaign.endsAt) return false;
  return campaign.endsAt.getTime() <= now.getTime();
}

export function isVotingOpen(
  campaign: { status: UpvoteCampaignStatus; endsAt: Date | null },
  now: Date = new Date()
): boolean {
  if (campaign.status !== "active") return false;
  if (campaign.endsAt && campaign.endsAt.getTime() <= now.getTime()) return false;
  return true;
}
