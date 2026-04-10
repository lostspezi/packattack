"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface QuizEventData {
  _id: string;
  title: { de: string; en: string };
  slug: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  questionsPerParticipant: number;
  requiredBadgeKey: string | null;
  notes: string;
  createdAt: string;
  stats: {
    totalParticipants: number;
    waitlisted: number;
    active: number;
    completed: number;
    questionCount: number;
  };
}

interface ParticipantData {
  _id: string;
  userId: string;
  status: string;
  joinedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  correctCount: number;
  totalTimeMs: number;
  currentQuestionIndex: number;
  answers: Array<{
    questionId: string;
    selectedIndex: number;
    correct: boolean;
    timeSpentMs: number;
  }>;
  placement: number | null;
  user: {
    name: string;
    username: string | null;
    email: string;
    image: string | null;
  } | null;
}

type View = "list" | "create" | "detail";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function QuizEventsManager() {
  const params = useParams<{ lang: string }>();
  const lang = params.lang ?? "de";
  const [view, setView] = useState<View>("list");
  const [events, setEvents] = useState<QuizEventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<QuizEventData | null>(null);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Create form state
  const [form, setForm] = useState({
    titleDe: "",
    titleEn: "",
    status: "draft",
    startsAt: "2026-04-14T20:00",
    endsAt: "",
    questionsPerParticipant: 20,
    requiredBadgeKey: "beta_tester",
    notes: "",
    importQuestions: true,
  });

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/quiz-events");
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch {
      setError("Fehler beim Laden der Events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const fetchParticipants = async (eventId: string) => {
    try {
      const res = await fetch(
        `/api/admin/quiz-events/${eventId}/participants?limit=100`,
      );
      if (!res.ok) throw new Error("Failed to fetch participants");
      const data = await res.json();
      setParticipants(data.participants ?? []);
    } catch {
      setError("Fehler beim Laden der Teilnehmer");
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    try {
      // Convert local datetime to UTC (input is in Europe/Berlin = CEST = UTC+2)
      const localDate = new Date(form.startsAt);
      const res = await fetch("/api/admin/quiz-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleDe: form.titleDe,
          titleEn: form.titleEn,
          status: form.status,
          startsAt: localDate.toISOString(),
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          questionsPerParticipant: form.questionsPerParticipant,
          requiredBadgeKey: form.requiredBadgeKey || null,
          notes: form.notes,
          importQuestions: form.importQuestions,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || "Fehler beim Erstellen");
      }
      await fetchEvents();
      setView("list");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (eventId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/quiz-events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Statusänderung fehlgeschlagen");
      await fetchEvents();
      if (selectedEvent?._id === eventId) {
        setSelectedEvent((prev) =>
          prev ? { ...prev, status: newStatus } : null,
        );
      }
    } catch {
      setError("Fehler beim Ändern des Status");
    }
  };

  const handleTestQuiz = async (eventId: string) => {
    try {
      const res = await fetch(`/api/admin/quiz-events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activateParticipants: true }),
      });
      if (!res.ok) throw new Error("Fehler beim Starten des Tests");
      window.location.href = `/${lang}/events`;
    } catch {
      setError("Fehler beim Starten des Tests");
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm("Event wirklich löschen? Alle Daten gehen verloren.")) return;
    try {
      const res = await fetch(`/api/admin/quiz-events/${eventId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Löschen fehlgeschlagen");
      await fetchEvents();
      if (selectedEvent?._id === eventId) {
        setView("list");
        setSelectedEvent(null);
      }
    } catch {
      setError("Fehler beim Löschen");
    }
  };

  const openDetail = async (ev: QuizEventData) => {
    setSelectedEvent(ev);
    setView("detail");
    await fetchParticipants(ev._id);
  };

  function formatTime(ms: number) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${String(sec).padStart(2, "0")}`;
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-400",
    upcoming: "bg-blue-500/20 text-blue-400",
    active: "bg-green-500/20 text-green-400",
    ended: "bg-red-500/20 text-red-400",
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-pa-green border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">
          Quiz Events
        </h1>
        {view === "list" && (
          <button
            onClick={() => setView("create")}
            className="rounded-lg bg-pa-green px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-pa-green/80"
          >
            + Neues Event
          </button>
        )}
        {view !== "list" && (
          <button
            onClick={() => {
              setView("list");
              setSelectedEvent(null);
              setError("");
            }}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:text-text-primary"
          >
            Zurück
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ---- List View ---- */}
      {view === "list" && (
        <div className="space-y-3">
          {events.length === 0 && (
            <p className="text-center text-text-muted py-10">
              Noch keine Quiz Events erstellt.
            </p>
          )}
          {events.map((ev) => (
            <div
              key={ev._id}
              className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-hover"
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => openDetail(ev)}
                >
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-text-primary">
                      {ev.title.de}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[ev.status] ?? ""}`}
                    >
                      {ev.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-muted">
                    Start: {formatDate(ev.startsAt)} &middot;{" "}
                    {ev.stats.questionCount} Fragen &middot;{" "}
                    {ev.stats.totalParticipants} Teilnehmer
                    {ev.stats.completed > 0 && (
                      <> &middot; {ev.stats.completed} fertig</>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {ev.status === "draft" && (
                    <>
                      <button
                        onClick={() => handleTestQuiz(ev._id)}
                        className="rounded-lg bg-pa-green/20 px-3 py-1.5 text-xs font-medium text-pa-green hover:bg-pa-green/30"
                      >
                        Quiz testen
                      </button>
                      <button
                        onClick={() => handleStatusChange(ev._id, "upcoming")}
                        className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/30"
                      >
                        Ankündigen
                      </button>
                    </>
                  )}
                  {ev.status === "upcoming" && (
                    <button
                      onClick={() => handleStatusChange(ev._id, "active")}
                      className="rounded-lg bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/30"
                    >
                      Aktivieren
                    </button>
                  )}
                  {ev.status === "active" && (
                    <button
                      onClick={() => handleStatusChange(ev._id, "ended")}
                      className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30"
                    >
                      Beenden
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(ev._id)}
                    className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- Create View ---- */}
      {view === "create" && (
        <div className="rounded-xl border border-border bg-surface p-6 space-y-5">
          <h2 className="text-lg font-semibold text-text-primary">
            Neues Quiz Event erstellen
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                Titel (DE)
              </label>
              <input
                type="text"
                value={form.titleDe}
                onChange={(e) =>
                  setForm((f) => ({ ...f, titleDe: e.target.value }))
                }
                placeholder="Nerd Quiz #1"
                className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-pa-green focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                Titel (EN)
              </label>
              <input
                type="text"
                value={form.titleEn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, titleEn: e.target.value }))
                }
                placeholder="Nerd Quiz #1"
                className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-pa-green focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
                className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary focus:border-pa-green focus:outline-none"
              >
                <option value="draft">Entwurf</option>
                <option value="upcoming">Angekündigt</option>
                <option value="active">Aktiv</option>
                <option value="ended">Beendet</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                Start
              </label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startsAt: e.target.value }))
                }
                className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary focus:border-pa-green focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                Ende (optional)
              </label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endsAt: e.target.value }))
                }
                className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary focus:border-pa-green focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                Fragen pro Teilnehmer
              </label>
              <input
                type="number"
                min={1}
                max={105}
                value={form.questionsPerParticipant}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    questionsPerParticipant: parseInt(e.target.value, 10) || 20,
                  }))
                }
                className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary focus:border-pa-green focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                Benötigtes Badge
              </label>
              <input
                type="text"
                value={form.requiredBadgeKey}
                onChange={(e) =>
                  setForm((f) => ({ ...f, requiredBadgeKey: e.target.value }))
                }
                placeholder="beta_tester"
                className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-pa-green focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Notizen (intern)
            </label>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={2}
              className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-pa-green focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.importQuestions}
              onChange={(e) =>
                setForm((f) => ({ ...f, importQuestions: e.target.checked }))
              }
              className="h-4 w-4 rounded border-border accent-pa-green"
            />
            <span className="text-sm text-text-secondary">
              Nerd-Quiz Fragen (105 Fragen) automatisch importieren
            </span>
          </label>

          <button
            onClick={handleCreate}
            disabled={saving || !form.titleDe || !form.titleEn}
            className="rounded-lg bg-pa-green px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-pa-green/80 disabled:opacity-50"
          >
            {saving ? "Erstelle…" : "Event erstellen"}
          </button>
        </div>
      )}

      {/* ---- Detail View ---- */}
      {view === "detail" && selectedEvent && (
        <div className="space-y-6">
          {/* Event Info */}
          <div className="rounded-xl border border-border bg-surface p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-text-primary">
                    {selectedEvent.title.de}
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[selectedEvent.status] ?? ""}`}
                  >
                    {selectedEvent.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-text-muted">
                  Start: {formatDate(selectedEvent.startsAt)}
                  {selectedEvent.endsAt &&
                    ` — Ende: ${formatDate(selectedEvent.endsAt)}`}
                </p>
                <p className="text-sm text-text-muted">
                  {selectedEvent.stats.questionCount} Fragen &middot;{" "}
                  {selectedEvent.questionsPerParticipant} pro Teilnehmer
                  {selectedEvent.requiredBadgeKey &&
                    ` · Badge: ${selectedEvent.requiredBadgeKey}`}
                </p>
              </div>
              <div className="flex gap-2">
                {selectedEvent.status === "draft" && (
                  <button
                    onClick={() => handleTestQuiz(selectedEvent._id)}
                    className="rounded-lg bg-pa-green/20 px-3 py-1.5 text-xs font-medium text-pa-green hover:bg-pa-green/30"
                  >
                    Quiz testen
                  </button>
                )}
                {selectedEvent.status === "upcoming" && (
                  <button
                    onClick={() =>
                      handleStatusChange(selectedEvent._id, "active")
                    }
                    className="rounded-lg bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/30"
                  >
                    Aktivieren
                  </button>
                )}
                {selectedEvent.status === "active" && (
                  <button
                    onClick={() =>
                      handleStatusChange(selectedEvent._id, "ended")
                    }
                    className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30"
                  >
                    Beenden
                  </button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="mt-4 grid grid-cols-4 gap-4">
              {[
                {
                  label: "Gesamt",
                  value: selectedEvent.stats.totalParticipants,
                },
                { label: "Warteliste", value: selectedEvent.stats.waitlisted },
                { label: "Aktiv", value: selectedEvent.stats.active },
                { label: "Fertig", value: selectedEvent.stats.completed },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg border border-border bg-surface-alt px-3 py-2 text-center"
                >
                  <p className="text-2xl font-bold text-text-primary">
                    {s.value}
                  </p>
                  <p className="text-xs text-text-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Participants / Leaderboard */}
          <div className="rounded-xl border border-border bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold text-text-primary">
              Teilnehmer & Ergebnisse
            </h3>

            {participants.length === 0 ? (
              <p className="text-center text-text-muted py-6">
                Noch keine Teilnehmer.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-text-muted">
                      <th className="pb-2 pr-4">#</th>
                      <th className="pb-2 pr-4">Benutzer</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Richtig</th>
                      <th className="pb-2 pr-4">Zeit</th>
                      <th className="pb-2 pr-4">Platz</th>
                      <th className="pb-2">Beigetreten</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p, i) => (
                      <tr
                        key={p._id}
                        className="border-b border-border/50 text-text-secondary"
                      >
                        <td className="py-2.5 pr-4 font-mono text-text-muted">
                          {i + 1}
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            {p.user?.image && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={p.user.image}
                                alt=""
                                className="h-6 w-6 rounded-full"
                              />
                            )}
                            <span className="font-medium text-text-primary">
                              {p.user?.name ?? p.userId}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[p.status] ?? "text-text-muted"}`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 font-mono">
                          {p.status === "completed"
                            ? `${p.correctCount}/${selectedEvent.questionsPerParticipant}`
                            : `${p.answers?.length ?? 0}/${selectedEvent.questionsPerParticipant}`}
                        </td>
                        <td className="py-2.5 pr-4 font-mono">
                          {p.totalTimeMs > 0
                            ? formatTime(p.totalTimeMs)
                            : "—"}
                        </td>
                        <td className="py-2.5 pr-4">
                          {p.placement ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-pa-green/20 text-xs font-bold text-pa-green">
                              {p.placement}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 text-text-muted">
                          {formatDate(p.joinedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
