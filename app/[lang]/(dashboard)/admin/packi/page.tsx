import { PackiKnowledgeManager } from "@/components/admin/packi-knowledge-manager";

export default async function AdminPackiPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Packi — Korrekturen</h2>
        <p className="text-text-secondary mt-1 text-sm max-w-2xl">
          Hier hinterlegst du Fakten und Regeln, die Packi bei allen Chats
          berücksichtigen soll. Einträge haben Vorrang vor der allgemeinen
          Persona und wirken beim nächsten Nachrichten-Turn — kein Redeploy.
        </p>
      </div>
      <PackiKnowledgeManager />
    </div>
  );
}
