import UpvoteCampaign, { type IUpvoteCampaign } from "@/models/upvote-campaign";
import { shouldAutoClose } from "@/lib/votes/lifecycle";

/**
 * Lazy auto-close: prüft beim Read, ob eine aktive Kampagne ihr endsAt
 * überschritten hat, und setzt sie atomar auf closed. Gibt das (ggf.
 * aktualisierte) Dokument zurück.
 *
 * Wird in jeder relevanten Read-Route aufgerufen. Kein Cron nötig.
 */
export async function autoCloseIfExpired<T extends IUpvoteCampaign>(
  campaign: T,
  now: Date = new Date()
): Promise<T> {
  if (!shouldAutoClose({ status: campaign.status, endsAt: campaign.endsAt }, now)) {
    return campaign;
  }

  const updated = await UpvoteCampaign.findOneAndUpdate(
    { _id: campaign._id, status: "active" },
    { $set: { status: "closed", closedAt: now } },
    { new: true }
  );

  if (updated) return updated as T;

  const refetched = await UpvoteCampaign.findById(campaign._id);
  return (refetched ?? campaign) as T;
}

/**
 * Bulk-Variante für Listen-Endpoints. Schließt alle abgelaufenen aktiven
 * Kampagnen in einem updateMany-Aufruf, dann liefert der Caller wie gewohnt
 * die aktuellen Records.
 */
export async function autoCloseExpiredBulk(now: Date = new Date()): Promise<number> {
  const result = await UpvoteCampaign.updateMany(
    { status: "active", endsAt: { $ne: null, $lte: now } },
    { $set: { status: "closed", closedAt: now } }
  );
  return result.modifiedCount ?? 0;
}
