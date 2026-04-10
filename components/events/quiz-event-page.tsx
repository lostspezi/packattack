"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Trophy,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  Shield,
  Lock,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EventData {
  _id: string;
  title: { de: string; en: string };
  slug: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  questionsPerParticipant: number;
  requiredBadgeKey: string | null;
  participantCount: number;
}

interface ParticipantData {
  _id: string;
  status: string;
  joinedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  currentQuestionIndex: number;
  correctCount: number;
  totalTimeMs: number;
  totalQuestions: number;
  answeredCount: number;
  placement: number | null;
}

interface QuestionData {
  _id: string;
  number: number;
  category: string;
  question: string;
  answers: string[];
}

interface WaitlistUser {
  userId: string;
  name: string;
  image: string | null;
  isMe: boolean;
}

interface ActiveUser {
  userId: string;
  name: string;
  image: string | null;
  answeredCount: number;
  totalQuestions: number;
  isMe: boolean;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  totalTimeMs: number;
  placement: number | null;
  isMe: boolean;
}

type Phase =
  | "loading"
  | "no-event"
  | "join"
  | "waitlist"
  | "ready"
  | "quiz"
  | "completed";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function placementLabel(p: number | null) {
  if (p === 1) return "\u{1F947}";
  if (p === 2) return "\u{1F948}";
  if (p === 3) return "\u{1F949}";
  return "";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function QuizEventPage() {
  const params = useParams<{ lang: string }>();
  const lang = params.lang ?? "de";
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = userRole === "admin" || userRole === "super_admin";

  const [phase, setPhase] = useState<Phase>("loading");
  const [event, setEvent] = useState<EventData | null>(null);
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [countdown, setCountdown] = useState("");
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{
    correct: boolean;
    correctIndex: number;
  } | null>(null);

  // Live participant data
  const [waitlisted, setWaitlisted] = useState<WaitlistUser[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const questionStartTime = useRef<number>(0);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ---- Fetch current event ---- */
  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch("/api/events/current");
      if (!res.ok) throw new Error();
      const data = await res.json();

      if (!data.event) {
        setPhase("no-event");
        return;
      }

      setEvent(data.event);
      const p = data.participant as ParticipantData | null;
      setParticipant(p);

      if (!p) {
        setPhase("join");
      } else if (p.status === "waitlisted") {
        setPhase("waitlist");
      } else if (p.status === "completed") {
        setPhase("completed");
      } else if (
        p.status === "active" &&
        p.answeredCount > 0 &&
        p.answeredCount < p.totalQuestions
      ) {
        setPhase("quiz");
        await resumeQuiz();
      } else if (
        p.status === "active" &&
        p.totalQuestions > 0 &&
        p.answeredCount >= p.totalQuestions
      ) {
        setPhase("completed");
      } else if (data.event.status === "active") {
        setPhase("ready");
      } else {
        // draft/upcoming: show waitlist (admins get a "Jetzt starten" button)
        setPhase("waitlist");
      }
    } catch {
      setError("Fehler beim Laden des Events");
    }
  }, []);

  const resumeQuiz = async () => {
    try {
      const res = await fetch("/api/events/current/start", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.question || data.nextQuestion) {
        setQuestion(data.question || data.nextQuestion);
        questionStartTime.current = Date.now();
      }
    } catch {
      /* ignore */
    }
  };

  /* ---- Fetch participants (waitlist + active + leaderboard) ---- */
  const fetchParticipants = useCallback(async () => {
    try {
      const res = await fetch("/api/events/current/participants");
      if (!res.ok) return;
      const data = await res.json();
      setWaitlisted(data.waitlisted ?? []);
      setActiveUsers(data.active ?? []);
      setLeaderboard(data.leaderboard ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  /* ---- Poll participants every 5s when relevant ---- */
  useEffect(() => {
    if (
      phase === "loading" ||
      phase === "no-event" ||
      phase === "join"
    )
      return;

    // Initial fetch
    fetchParticipants();

    pollInterval.current = setInterval(fetchParticipants, 5000);
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [phase, fetchParticipants]);

  /* ---- Countdown timer ---- */
  useEffect(() => {
    if (!event?.startsAt) return;
    if (phase !== "waitlist" && phase !== "join") return;

    function tick() {
      const now = Date.now();
      const start = new Date(event!.startsAt).getTime();
      const diff = start - now;

      if (diff <= 0) {
        setCountdown("Jetzt!");
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
          countdownInterval.current = null;
        }
        fetchEvent();
        return;
      }

      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      const parts: string[] = [];
      if (days > 0) parts.push(`${days}T`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      parts.push(`${minutes}m`);
      parts.push(`${String(seconds).padStart(2, "0")}s`);

      setCountdown(parts.join(" "));
    }

    tick();
    countdownInterval.current = setInterval(tick, 1000);
    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, [event, phase, fetchEvent]);

  /* ---- Actions ---- */
  const handleJoin = async () => {
    setJoining(true);
    setError("");
    try {
      const res = await fetch("/api/events/current/join", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "badge_required") {
          setError(
            data.message ||
              "Du benötigst das Beta-Tester Badge, um teilzunehmen.",
          );
        } else {
          setError(data.message || "Fehler beim Anmelden");
        }
        return;
      }
      await fetchEvent();
    } catch {
      setError("Fehler beim Anmelden");
    } finally {
      setJoining(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/events/current/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Fehler beim Starten");
        return;
      }
      setQuestion(data.question);
      setParticipant((prev) =>
        prev
          ? {
              ...prev,
              startedAt: data.startedAt,
              totalQuestions: data.totalQuestions,
              currentQuestionIndex: data.currentQuestionIndex,
            }
          : null,
      );
      questionStartTime.current = Date.now();
      setPhase("quiz");
    } catch {
      setError("Fehler beim Starten");
    } finally {
      setStarting(false);
    }
  };

  const handleAnswer = async (selectedIndex: number) => {
    if (answering) return;
    setAnswering(true);
    setSelectedAnswer(selectedIndex);

    const timeSpentMs = Date.now() - questionStartTime.current;

    try {
      const res = await fetch("/api/events/current/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedIndex, timeSpentMs }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Fehler beim Antworten");
        setAnswering(false);
        return;
      }

      setLastResult({
        correct: data.correct,
        correctIndex: data.correctIndex,
      });

      setParticipant((prev) =>
        prev
          ? {
              ...prev,
              answeredCount: data.answeredCount,
              correctCount: data.correctCount,
            }
          : null,
      );

      // Show result for 1.5s, then advance
      setTimeout(() => {
        if (data.isComplete) {
          setPhase("completed");
          setParticipant((prev) =>
            prev
              ? {
                  ...prev,
                  status: "completed",
                  totalTimeMs: data.totalTimeMs,
                  placement: data.placement,
                }
              : null,
          );
          fetchParticipants();
        } else {
          setQuestion(data.nextQuestion);
          questionStartTime.current = Date.now();
        }
        setSelectedAnswer(null);
        setLastResult(null);
        setAnswering(false);
      }, 1500);
    } catch {
      setError("Fehler beim Antworten");
      setAnswering(false);
    }
  };

  const title =
    lang === "de"
      ? (event?.title.de ?? "Nerd Quiz")
      : (event?.title.en ?? "Nerd Quiz");

  const totalParticipants =
    waitlisted.length + activeUsers.length + leaderboard.length;

  /* ---------------------------------------------------------------- */
  /*  Sub-components                                                   */
  /* ---------------------------------------------------------------- */

  const WaitingRoom = () => {
    if (waitlisted.length === 0) return null;
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-text-primary">
          <Users className="h-5 w-5 text-pa-green" />
          Warteraum
          <span className="ml-auto rounded-full bg-surface-alt px-2.5 py-0.5 text-xs font-medium text-text-muted">
            {waitlisted.length}
          </span>
        </h3>
        <div className="flex flex-wrap gap-3">
          {waitlisted.map((u) => (
            <div
              key={u.userId}
              className={[
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                u.isMe
                  ? "border border-pa-green/30 bg-pa-green/5 font-semibold text-pa-green"
                  : "bg-surface-alt text-text-secondary",
              ].join(" ")}
            >
              {u.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={u.image} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-pa-green/20 text-[10px] font-bold text-pa-green">
                  {u.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="truncate">{u.name}</span>
              {u.isMe && (
                <span className="text-[10px] text-pa-green">(Du)</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const ActiveUsersList = () => {
    if (activeUsers.length === 0) return null;
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-text-primary">
          <Zap className="h-5 w-5 text-yellow-400" />
          Gerade im Quiz
          <span className="ml-auto rounded-full bg-surface-alt px-2.5 py-0.5 text-xs font-medium text-text-muted">
            {activeUsers.length}
          </span>
        </h3>
        <div className="space-y-2">
          {activeUsers.map((u) => (
            <div
              key={u.userId}
              className={[
                "flex items-center gap-3 rounded-xl px-4 py-2.5",
                u.isMe
                  ? "border border-pa-green/30 bg-pa-green/5"
                  : "bg-surface-alt",
              ].join(" ")}
            >
              {u.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={u.image} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-pa-green/20 text-[10px] font-bold text-pa-green">
                  {u.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="flex-1 truncate text-sm font-medium text-text-primary">
                {u.name}
                {u.isMe && (
                  <span className="ml-1 text-xs text-pa-green">(Du)</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-yellow-400 transition-all"
                    style={{
                      width: `${u.totalQuestions > 0 ? (u.answeredCount / u.totalQuestions) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-text-muted">
                  {u.answeredCount}/{u.totalQuestions}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const LiveLeaderboard = () => {
    if (leaderboard.length === 0) return null;
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-text-primary">
          <Trophy className="h-5 w-5 text-yellow-400" />
          Bestenliste
          <span className="ml-1 text-xs font-normal text-text-muted">
            (live)
          </span>
          <span className="ml-auto rounded-full bg-surface-alt px-2.5 py-0.5 text-xs font-medium text-text-muted">
            {leaderboard.length} fertig
          </span>
        </h3>

        {/* Header row */}
        <div className="mb-2 flex items-center gap-3 px-4 text-xs font-medium uppercase tracking-wider text-text-muted">
          <span className="w-8 text-center">#</span>
          <span className="flex-1">Spieler</span>
          <span className="w-16 text-right">Quote</span>
          <span className="w-20 text-right">Zeit</span>
        </div>

        <div className="space-y-1.5">
          {leaderboard.map((entry) => (
            <div
              key={entry.userId}
              className={[
                "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                entry.isMe
                  ? "border border-pa-green/30 bg-pa-green/5"
                  : "bg-surface-alt",
              ].join(" ")}
            >
              <span className="w-8 text-center text-base font-bold">
                {entry.placement
                  ? placementLabel(entry.placement)
                  : `#${entry.rank}`}
              </span>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {entry.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={entry.image}
                    alt=""
                    className="h-7 w-7 rounded-full"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-pa-green/20 text-xs font-bold text-pa-green">
                    {entry.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="truncate text-sm font-medium text-text-primary">
                  {entry.name}
                  {entry.isMe && (
                    <span className="ml-1 text-xs text-pa-green">(Du)</span>
                  )}
                </span>
              </div>
              <span className="w-16 text-right font-mono text-sm font-semibold text-pa-green">
                {entry.percentage}%
              </span>
              <span className="w-20 text-right font-mono text-sm text-text-muted">
                {formatTime(entry.totalTimeMs)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-pa-green" />
      </div>
    );
  }

  if (phase === "no-event") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Zap className="mx-auto mb-4 h-12 w-12 text-text-muted" />
        <h2 className="text-xl font-bold text-text-primary">
          Kein aktives Event
        </h2>
        <p className="mt-2 text-text-muted">
          Es gibt gerade kein Quiz-Event. Schau später nochmal vorbei!
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-2 text-red-300 hover:text-red-200"
          >
            &times;
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/*  JOIN PHASE                                                   */}
      {/* ============================================================ */}
      {phase === "join" && (
        <>
          <div className="rounded-2xl border border-border bg-surface p-5 text-center sm:p-8">
            <Zap className="mx-auto mb-3 h-12 w-12 text-pa-green sm:mb-4 sm:h-14 sm:w-14" />
            <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
              {title}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-base text-text-secondary sm:mt-3 sm:text-lg">
              Teste dein Nerd-Wissen! 20 zufällige Fragen aus der
              Welt der Popkultur.
            </p>

            <div className="mt-5 flex flex-col items-center gap-2 text-sm text-text-muted sm:mt-6 sm:flex-row sm:justify-center sm:gap-6">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0" />
                {new Date(event!.startsAt).toLocaleDateString("de-DE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                Uhr
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 shrink-0" />
                {totalParticipants || event!.participantCount} Teilnehmer
              </span>
            </div>

            {/* Requirements */}
            <div className="mt-5 rounded-xl border border-border bg-surface-alt p-4 text-left sm:mt-6">
              <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <Shield className="h-4 w-4 shrink-0 text-pa-green" />
                Teilnahmevoraussetzungen
              </div>
              <ul className="mt-3 space-y-2.5 text-sm text-text-secondary">
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pa-green" />
                  <span>
                    Du benötigst das{" "}
                    <strong>Beta-Tester Badge</strong>, um teilzunehmen.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pa-green" />
                  <span>20 zufällige Fragen aus einem Pool von über 100 Fragen</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pa-green" />
                  <span>Die 3 besten Spieler gewinnen Preise!</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
                  <span className="text-text-muted">
                    Du hast nur einen Versuch — gib dein Bestes!
                  </span>
                </li>
              </ul>
            </div>

            {/* Countdown */}
            {countdown && (
              <div className="mt-5 sm:mt-6">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Startet in
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-pa-green sm:text-3xl">
                  {countdown}
                </p>
              </div>
            )}

            <button
              onClick={handleJoin}
              disabled={joining}
              className="mt-6 w-full rounded-xl bg-pa-green px-8 py-3.5 text-base font-bold text-black transition-all hover:bg-pa-green/80 active:scale-95 disabled:opacity-50 sm:mt-8 sm:w-auto"
            >
              {joining ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              ) : (
                "Anmelden"
              )}
            </button>
          </div>

          {/* Show who's already signed up */}
          <WaitingRoom />
        </>
      )}

      {/* ============================================================ */}
      {/*  WAITLIST PHASE                                               */}
      {/* ============================================================ */}
      {phase === "waitlist" && (
        <>
          <div className="rounded-2xl border border-border bg-surface p-5 text-center sm:p-8">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-pa-green sm:mb-4 sm:h-14 sm:w-14" />
            <h1 className="text-xl font-bold text-text-primary sm:text-2xl">
              Du bist angemeldet!
            </h1>
            <p className="mt-2 text-sm text-text-secondary sm:text-base">
              Du stehst auf der Warteliste. Das Quiz startet bald.
            </p>

            {event?.status !== "draft" && countdown && (
              <div className="mt-5 sm:mt-6">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Startet in
                </p>
                <p className="mt-1 font-mono text-3xl font-bold text-pa-green sm:text-4xl">
                  {countdown}
                </p>
              </div>
            )}

            {event?.status === "draft" ? (
              <p className="mt-5 text-sm text-text-muted sm:mt-6">
                Entwurf — nutze den Button unten zum Testen.
              </p>
            ) : (
              <p className="mt-5 text-sm text-text-muted sm:mt-6">
                Lass diese Seite offen — das Quiz beginnt automatisch.
              </p>
            )}

            {/* Admin: force-start for testing */}
            {isAdmin && (
              <button
                onClick={handleStart}
                disabled={starting}
                className="mt-4 w-full rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-6 py-2.5 text-sm font-semibold text-yellow-400 transition-colors hover:bg-yellow-500/20 active:scale-95 disabled:opacity-50 sm:w-auto"
              >
                {starting ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Jetzt starten (Admin)"
                )}
              </button>
            )}
          </div>

          {/* Waiting room */}
          <WaitingRoom />
        </>
      )}

      {/* ============================================================ */}
      {/*  READY PHASE                                                  */}
      {/* ============================================================ */}
      {phase === "ready" && (
        <>
          <div className="rounded-2xl border border-pa-green/30 bg-surface p-5 text-center sm:p-8">
            <Zap className="mx-auto mb-3 h-12 w-12 animate-pulse text-pa-green sm:mb-4 sm:h-14 sm:w-14" />
            <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
              Das Quiz ist live!
            </h1>
            <p className="mx-auto mt-2 max-w-md text-base text-text-secondary sm:text-lg">
              Klicke auf Start, wenn du bereit bist. Die Zeit läuft ab dem
              Moment, in dem du startest.
            </p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-text-muted">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              Du hast nur einen Versuch!
            </p>

            <button
              onClick={handleStart}
              disabled={starting}
              className="mt-6 w-full rounded-xl bg-pa-green px-10 py-4 text-lg font-bold text-black transition-all hover:bg-pa-green/80 active:scale-95 disabled:opacity-50 sm:mt-8 sm:w-auto"
            >
              {starting ? (
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              ) : (
                "Quiz starten"
              )}
            </button>
          </div>

          <ActiveUsersList />
          <LiveLeaderboard />
        </>
      )}

      {/* ============================================================ */}
      {/*  QUIZ PHASE                                                   */}
      {/* ============================================================ */}
      {phase === "quiz" && question && (
        <>
          {/* Progress bar */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
                <div
                  className="h-full rounded-full bg-pa-green transition-all duration-500 ease-out"
                  style={{
                    width: `${((participant?.answeredCount ?? 0) / (participant?.totalQuestions ?? 20)) * 100}%`,
                  }}
                />
              </div>
            </div>
            <span className="shrink-0 text-sm font-medium tabular-nums text-text-muted">
              {participant?.answeredCount ?? 0}/
              {participant?.totalQuestions ?? 20}
            </span>
            <span className="shrink-0 flex items-center gap-1 text-sm font-medium text-pa-green">
              <CheckCircle2 className="h-4 w-4" />
              {participant?.correctCount ?? 0}
            </span>
          </div>

          {/* Question card — key triggers fade+slide animation on each new question */}
          <div
            key={question._id}
            className="animate-quiz-in rounded-2xl border border-border bg-surface p-4 sm:p-6 md:p-8"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-pa-green/15 px-3 py-1 text-xs font-semibold text-pa-green">
                {question.category}
              </span>
              <span className="text-xs text-text-muted">
                Frage {(participant?.answeredCount ?? 0) + 1} von{" "}
                {participant?.totalQuestions ?? 20}
              </span>
            </div>

            <h2 className="mt-3 text-lg font-bold leading-snug text-text-primary sm:mt-4 sm:text-xl md:text-2xl">
              {question.question}
            </h2>

            <div className="mt-4 space-y-2.5 sm:mt-6 sm:space-y-3">
              {question.answers.map((answer, idx) => {
                let btnClass =
                  "w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all duration-200 sm:px-5 sm:py-4 sm:text-base ";

                if (lastResult) {
                  if (idx === lastResult.correctIndex) {
                    btnClass +=
                      "border-green-500 bg-green-500/15 text-green-400";
                  } else if (
                    idx === selectedAnswer &&
                    !lastResult.correct
                  ) {
                    btnClass +=
                      "border-red-500 bg-red-500/15 text-red-400";
                  } else {
                    btnClass +=
                      "border-border bg-surface-alt text-text-muted opacity-50";
                  }
                } else if (selectedAnswer === idx) {
                  btnClass +=
                    "border-pa-green bg-pa-green/10 text-pa-green scale-[0.98]";
                } else {
                  btnClass +=
                    "border-border bg-surface-alt text-text-primary hover:border-pa-green/50 hover:bg-pa-green/5 active:scale-[0.98]";
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    disabled={answering}
                    className={btnClass}
                  >
                    <span className="mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs font-bold sm:h-7 sm:w-7 sm:text-sm">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {answer}

                    {lastResult && idx === lastResult.correctIndex && (
                      <CheckCircle2 className="ml-auto inline h-5 w-5 text-green-400" />
                    )}
                    {lastResult &&
                      idx === selectedAnswer &&
                      !lastResult.correct && (
                        <XCircle className="ml-auto inline h-5 w-5 text-red-400" />
                      )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Show leaderboard below quiz */}
          <LiveLeaderboard />
        </>
      )}

      {/* ============================================================ */}
      {/*  COMPLETED PHASE                                              */}
      {/* ============================================================ */}
      {phase === "completed" && (
        <>
          {/* Results card */}
          <div className="rounded-2xl border border-border bg-surface p-5 text-center sm:p-8">
            <Trophy className="mx-auto mb-3 h-12 w-12 text-yellow-400 sm:mb-4 sm:h-14 sm:w-14" />
            <h1 className="text-xl font-bold text-text-primary sm:text-2xl">
              Quiz abgeschlossen!
            </h1>

            <div className="mt-5 grid grid-cols-3 gap-3 sm:mt-6 sm:flex sm:items-center sm:justify-center sm:gap-8">
              <div>
                <p className="text-2xl font-bold text-pa-green sm:text-3xl">
                  {participant?.correctCount ?? 0}
                  <span className="text-sm text-text-muted sm:text-lg">
                    /{participant?.totalQuestions ?? 20}
                  </span>
                </p>
                <p className="text-[11px] text-text-muted sm:text-xs">Richtig</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary sm:text-3xl">
                  {participant?.totalQuestions
                    ? Math.round(
                        ((participant.correctCount ?? 0) /
                          participant.totalQuestions) *
                          100,
                      )
                    : 0}
                  %
                </p>
                <p className="text-[11px] text-text-muted sm:text-xs">Quote</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary sm:text-3xl">
                  {formatTime(participant?.totalTimeMs ?? 0)}
                </p>
                <p className="text-[11px] text-text-muted sm:text-xs">Zeit</p>
              </div>
            </div>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-sm text-text-muted sm:mt-6">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              Das Quiz kann nur einmal absolviert werden.
            </p>

            <a
              href={`/${lang}/dashboard`}
              className="mt-5 inline-block rounded-xl border border-border px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary sm:mt-6"
            >
              Zurück zum Dashboard
            </a>
          </div>

          {/* Active users still playing */}
          <ActiveUsersList />

          {/* Live leaderboard */}
          <LiveLeaderboard />

          {/* Waitlisted users who haven't started */}
          <WaitingRoom />
        </>
      )}
    </div>
  );
}
