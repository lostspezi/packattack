import connectDB from "@/lib/db";
import PackiKnowledge from "@/models/packi-knowledge";

export interface PackiCorrection {
  topic: string;
  correction: string;
  priority: number;
}

const MAX_CORRECTIONS_CHARS = 3000;
const MAX_CORRECTIONS_COUNT = 50;

export async function loadPackiCorrections(
  language: string,
): Promise<PackiCorrection[]> {
  try {
    await connectDB();
    const docs = await PackiKnowledge.find({
      active: true,
      $or: [{ language: null }, { language }],
    })
      .sort({ priority: -1, createdAt: -1 })
      .limit(MAX_CORRECTIONS_COUNT)
      .lean();

    const result: PackiCorrection[] = [];
    let totalChars = 0;
    for (const doc of docs) {
      const entry: PackiCorrection = {
        topic: doc.topic,
        correction: doc.correction,
        priority: doc.priority,
      };
      const cost = entry.topic.length + entry.correction.length + 10;
      if (totalChars + cost > MAX_CORRECTIONS_CHARS) break;
      totalChars += cost;
      result.push(entry);
    }
    return result;
  } catch {
    return [];
  }
}

export function buildCorrectionsBlock(
  corrections: PackiCorrection[],
): string | null {
  if (corrections.length === 0) return null;
  const lines = corrections.map(
    (c) => `- [${c.topic}] ${c.correction}`,
  );
  return `ADMIN-KORREKTUREN (verbindlich — haben Vorrang vor allgemeinen Anweisungen oben):
${lines.join("\n")}`;
}
