"use client";

import React, { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Swords,
  Clock,
  Trophy,
  Users,
  Zap,
  Shield,
  ArrowDownToLine,
  ArrowUpToLine,
  Flame,
  Target,
  Timer,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Accordion primitive                                                */
/* ------------------------------------------------------------------ */

function Section({
  icon,
  title,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-zinc-800/60 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-zinc-800/30"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-yellow-400">
          {icon}
        </span>
        <span className="flex-1 text-sm font-semibold text-zinc-200">{title}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 text-[13px] leading-relaxed text-zinc-400">
          {children}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-800/50 px-3 py-2 text-center">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-sm font-bold text-zinc-200">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Handbook                                                           */
/* ------------------------------------------------------------------ */

export function BattleHandbook({ lang }: { lang: string }) {
  const [open, setOpen] = useState(false);
  const de = lang === "de";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-zinc-800/30"
      >
        <BookOpen className="h-4.5 w-4.5 text-yellow-400" />
        <span className="flex-1 text-sm font-bold text-zinc-200">
          {de ? "Battle-Handbuch" : "Battle Handbook"}
        </span>
        <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
          {de ? "Anleitung" : "Guide"}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-zinc-800/60">
          {/* -------------------------------------------------------- */}
          {/*  1. Wie funktionieren Battles?                           */}
          {/* -------------------------------------------------------- */}
          <Section
            icon={<Swords className="h-3.5 w-3.5" />}
            title={de ? "Wie funktionieren Battles?" : "How do Battles work?"}
            defaultOpen
          >
            <p className="mb-3">
              {de
                ? "In Battles trittst du gegen andere Spieler in strategischen Kartenduellen an. Jede Runde ziehst du 5 zufällige Karten aus der gewählten Box und wählst eine davon aus. Je nach Modus gewinnt die Karte mit dem höchsten oder niedrigsten Coin-Wert die Runde. Wer am Ende die meisten Runden gewonnen hat, gewinnt das Battle und sammelt Prestige im Leaderboard."
                : "In Battles, you compete against other players in strategic card duels. Each round, you draw 5 random cards from the selected box and choose one. Depending on the mode, the card with the highest or lowest coin value wins the round. Whoever wins the most rounds wins the battle and earns prestige on the leaderboard."}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={de ? "Spieler" : "Players"} value="2–4" />
              <Stat label={de ? "Runden" : "Rounds"} value="3 / 5 / 7" />
              <Stat label={de ? "Karten/Hand" : "Cards/Hand"} value="5" />
              <Stat label={de ? "Auswahlzeit" : "Pick Time"} value="30s" />
            </div>
          </Section>

          {/* -------------------------------------------------------- */}
          {/*  2. Ablauf eines Battles                                 */}
          {/* -------------------------------------------------------- */}
          <Section
            icon={<Timer className="h-3.5 w-3.5" />}
            title={de ? "Ablauf eines Battles" : "Battle Flow"}
          >
            <ol className="mb-1 list-inside list-decimal space-y-2.5">
              <li>
                <strong className="text-zinc-300">{de ? "Lobby" : "Lobby"} (5 min)</strong>
                <br />
                {de
                  ? "Nach dem Erstellen haben andere Spieler 5 Minuten Zeit beizutreten. Wird die Lobby nicht voll, wird das Battle automatisch abgebrochen."
                  : "After creation, other players have 5 minutes to join. If the lobby doesn't fill up, the battle is cancelled automatically."}
              </li>
              <li>
                <strong className="text-zinc-300">{de ? "Bereitschafts-Check" : "Ready Check"} (30s)</strong>
                <br />
                {de
                  ? "Sobald alle Plätze belegt sind, müssen alle Spieler innerhalb von 30 Sekunden \"Bereit\" bestätigen. Bestätigen nicht alle rechtzeitig, wird das Battle abgebrochen."
                  : "Once all slots are filled, all players must confirm \"Ready\" within 30 seconds. If not everyone confirms in time, the battle is cancelled."}
              </li>
              <li>
                <strong className="text-zinc-300">{de ? "Countdown" : "Countdown"} (3 min)</strong>
                <br />
                {de
                  ? "Der Ersteller kann das Battle jederzeit starten. Nach 3 Minuten startet es automatisch."
                  : "The creator can start the battle at any time. After 3 minutes, it starts automatically."}
              </li>
              <li>
                <strong className="text-zinc-300">{de ? "Runden" : "Rounds"}</strong>
                <br />
                {de
                  ? "Jede Runde: 5 Karten ziehen, 1 auswählen (30 Sekunden), dann gemeinsames Aufdecken. Wählst du nicht rechtzeitig, wird eine zufällige Karte für dich gewählt."
                  : "Each round: draw 5 cards, pick 1 (30 seconds), then simultaneous reveal. If you don't pick in time, a random card is chosen for you."}
              </li>
              <li>
                <strong className="text-zinc-300">{de ? "Ergebnis" : "Result"}</strong>
                <br />
                {de
                  ? "Nach allen Runden gewinnt der Spieler mit den meisten gewonnenen Runden. Bei Gleichstand gibt es eine Sudden-Death-Runde."
                  : "After all rounds, the player with the most rounds won wins. In case of a tie, there's a sudden death round."}
              </li>
            </ol>
          </Section>

          {/* -------------------------------------------------------- */}
          {/*  3. Spielmodi                                            */}
          {/* -------------------------------------------------------- */}
          <Section
            icon={<Target className="h-3.5 w-3.5" />}
            title={de ? "Spielmodi" : "Battle Modes"}
          >
            <p className="mb-3">
              {de
                ? "Der Spielmodus bestimmt, welche Karte eine Runde gewinnt:"
                : "The battle mode determines which card wins a round:"}
            </p>
            <div className="space-y-3">
              <div className="rounded-lg bg-zinc-800/40 p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-blue-400">
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                  {de ? "Niedrigste Karte" : "Lowest Card"}
                </div>
                <p>
                  {de
                    ? "Die Karte mit dem niedrigsten Coin-Wert gewinnt die Runde. Starke Karten sind hier ein Nachteil — spiele lieber deine schwächsten aus."
                    : "The card with the lowest coin value wins the round. Strong cards are a liability here — save them and play your weakest instead."}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-800/40 p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-orange-400">
                  <ArrowUpToLine className="h-3.5 w-3.5" />
                  {de ? "Höchste Karte" : "Highest Card"}
                </div>
                <p>
                  {de
                    ? "Die Karte mit dem höchsten Coin-Wert gewinnt die Runde. Der Klassiker — spiele so stark wie möglich."
                    : "The card with the highest coin value wins the round. The classic — play as strong as you can."}
                </p>
              </div>
            </div>
          </Section>

          {/* -------------------------------------------------------- */}
          {/*  5. Rundenablauf                                         */}
          {/* -------------------------------------------------------- */}
          <Section
            icon={<Zap className="h-3.5 w-3.5" />}
            title={de ? "Runden & Kartenauswahl" : "Rounds & Card Selection"}
          >
            <div className="space-y-2.5">
              <p>
                {de
                  ? "Jede Runde läuft wie folgt ab:"
                  : "Each round works as follows:"}
              </p>
              <ol className="list-inside list-decimal space-y-2">
                <li>
                  <strong className="text-zinc-300">{de ? "Karten ziehen" : "Draw cards"}</strong>{" — "}
                  {de
                    ? "Du erhältst 5 zufällige Karten aus der Box"
                    : "You receive 5 random cards from the box"}
                </li>
                <li>
                  <strong className="text-zinc-300">{de ? "Karte auswählen" : "Pick a card"}</strong>{" — "}
                  {de
                    ? "Du hast 30 Sekunden, um eine Karte auszuwählen. Deine Wahl ist geheim."
                    : "You have 30 seconds to pick a card. Your choice is secret."}
                </li>
                <li>
                  <strong className="text-zinc-300">{de ? "Aufdecken" : "Reveal"}</strong>{" — "}
                  {de
                    ? "Alle Karten werden gleichzeitig aufgedeckt. Je nach Modus gewinnt der höchste oder niedrigste Coin-Wert die Runde."
                    : "All cards are revealed simultaneously. Depending on the mode, the highest or lowest coin value wins the round."}
                </li>
              </ol>
              <div className="mt-2 rounded-lg bg-zinc-800/40 p-3">
                <p className="text-xs">
                  <strong className="text-zinc-300">{de ? "Ungenutzte Karten:" : "Unused cards:"}</strong>{" "}
                  {de
                    ? "Die 4 nicht gewählten Karten werden zurück in die Box gelegt. Nur deine gewählte Karte bleibt im Spiel."
                    : "The 4 cards you didn't pick are returned to the box. Only your chosen card stays in play."}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-800/40 p-3">
                <p className="text-xs">
                  <strong className="text-zinc-300">{de ? "Gleichstand:" : "Tie:"}</strong>{" "}
                  {de
                    ? "Spielen zwei oder mehr Spieler Karten mit demselben entscheidenden Wert, gewinnt niemand die Runde."
                    : "If two or more players play cards with the same deciding value, nobody wins the round."}
                </p>
              </div>
            </div>
          </Section>

          {/* -------------------------------------------------------- */}
          {/*  6. Sudden Death                                         */}
          {/* -------------------------------------------------------- */}
          <Section
            icon={<Flame className="h-3.5 w-3.5" />}
            title={de ? "Sudden Death" : "Sudden Death"}
          >
            <p>
              {de
                ? "Wenn nach allen regulären Runden zwei oder mehr Spieler gleich viele Runden gewonnen haben, wird eine zusätzliche Sudden-Death-Runde gespielt. Der Gewinner dieser Runde gewinnt das gesamte Battle. Endet auch die Sudden-Death-Runde unentschieden, gilt das Battle als Unentschieden — es gibt dann keine Prestige-Änderungen."
                : "If two or more players have won the same number of rounds after all regular rounds, an additional sudden death round is played. The winner of this round wins the entire battle. If the sudden death round also ends in a tie, the battle is a draw — no prestige changes occur."}
            </p>
          </Section>

          {/* -------------------------------------------------------- */}
          {/*  7. Prestige & Ränge                                     */}
          {/* -------------------------------------------------------- */}
          <Section
            icon={<Trophy className="h-3.5 w-3.5" />}
            title={de ? "Prestige & Ränge" : "Prestige & Ranks"}
          >
            <p className="mb-3">
              {de
                ? "Dein Prestige zeigt deine Spielstärke an. Jeder Spieler startet bei 1000 Prestige. Siege erhöhen deinen Wert, Niederlagen verringern ihn. Je stärker dein Gegner, desto mehr Prestige gewinnst du bei einem Sieg."
                : "Your prestige reflects your skill level. Every player starts at 1000 prestige. Wins increase it, losses decrease it. The stronger your opponent, the more prestige you gain from a win."}
            </p>
            <div className="mb-3 space-y-1.5">
              {[
                { name: "Champion", elo: "1600+", color: "text-purple-400", bg: "bg-purple-400/10" },
                { name: "Diamond", elo: "1400–1599", color: "text-cyan-400", bg: "bg-cyan-400/10" },
                { name: "Gold", elo: "1200–1399", color: "text-yellow-400", bg: "bg-yellow-400/10" },
                { name: "Silver", elo: "1000–1199", color: "text-zinc-300", bg: "bg-zinc-300/10" },
                { name: "Bronze", elo: "< 1000", color: "text-amber-600", bg: "bg-amber-600/10" },
              ].map((rank) => (
                <div key={rank.name} className={`flex items-center justify-between rounded-lg ${rank.bg} px-3 py-2`}>
                  <span className={`text-sm font-bold ${rank.color}`}>{rank.name}</span>
                  <span className="text-xs text-zinc-400">{rank.elo} Prestige</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-zinc-800/40 p-3 text-xs">
              <p>
                <strong className="text-zinc-300">{de ? "K-Faktor:" : "K-Factor:"}</strong>{" "}
                {de
                  ? "Neue Spieler (< 30 Battles) haben einen K-Faktor von 40, erfahrene Spieler von 20. Dein Prestige bewegt sich am Anfang also schneller und stabilisiert sich mit der Zeit."
                  : "New players (< 30 battles) have a K-factor of 40, experienced players 20. Your prestige moves faster at the beginning and stabilizes over time."}
              </p>
            </div>
          </Section>

          {/* -------------------------------------------------------- */}
          {/*  8. Strategietipps                                       */}
          {/* -------------------------------------------------------- */}
          <Section
            icon={<Shield className="h-3.5 w-3.5" />}
            title={de ? "Strategietipps" : "Strategy Tips"}
          >
            <ul className="list-inside list-disc space-y-2">
              <li>
                <strong className="text-zinc-300">{de ? "Box-Wahl:" : "Box choice:"}</strong>{" "}
                {de
                  ? "Teurere Boxen haben wertvollere Karten in der Hand – das wirkt sich direkt auf die Coin-Werte pro Runde aus."
                  : "More expensive boxes have more valuable cards in your hand, which directly affects coin values per round."}
              </li>
              <li>
                <strong className="text-zinc-300">{de ? "Modus beachten:" : "Watch the mode:"}</strong>{" "}
                {de
                  ? "Im \"Höchste Karte\"-Modus werden ganz andere Hände gespielt als im \"Niedrigste Karte\"-Modus. Stell dich auf den gewählten Modus ein."
                  : "\"Highest Card\" mode plays very differently than \"Lowest Card\" mode. Adapt your picks to the selected mode."}
              </li>
              <li>
                <strong className="text-zinc-300">{de ? "Rundenanzahl:" : "Round count:"}</strong>{" "}
                {de
                  ? "Mehr Runden bedeuten weniger Zufall und mehr Skill-Einfluss."
                  : "More rounds mean less randomness and more skill influence."}
              </li>
              <li>
                <strong className="text-zinc-300">{de ? "Nicht trödeln:" : "Don't dawdle:"}</strong>{" "}
                {de
                  ? "Wählst du keine Karte innerhalb von 30 Sekunden, wird eine zufällige für dich gewählt — und die ist selten optimal."
                  : "If you don't pick a card within 30 seconds, a random one is chosen for you — and it's rarely optimal."}
              </li>
            </ul>
          </Section>

          {/* -------------------------------------------------------- */}
          {/*  9. Wichtige Regeln                                      */}
          {/* -------------------------------------------------------- */}
          <Section
            icon={<Users className="h-3.5 w-3.5" />}
            title={de ? "Wichtige Regeln" : "Important Rules"}
          >
            <ul className="list-inside list-disc space-y-2">
              <li>
                {de
                  ? "Du kannst nur an einem Battle gleichzeitig teilnehmen."
                  : "You can only participate in one battle at a time."}
              </li>
              <li>
                {de
                  ? "Nach Battlestart ist kein Verlassen mehr möglich — das Battle wird zu Ende gespielt."
                  : "Once a battle starts, you cannot leave — the battle will be played to completion."}
              </li>
              <li>
                {de
                  ? "Private Battles benötigen einen Einladungscode zum Beitreten."
                  : "Private battles require an invite code to join."}
              </li>
            </ul>
          </Section>

          {/* -------------------------------------------------------- */}
          {/*  Quick Reference                                         */}
          {/* -------------------------------------------------------- */}
          <Section
            icon={<Clock className="h-3.5 w-3.5" />}
            title={de ? "Kurzübersicht" : "Quick Reference"}
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label={de ? "Lobbyzeit" : "Lobby Time"} value="5 min" />
              <Stat label={de ? "Bereitschaft" : "Ready Check"} value="30s" />
              <Stat label="Countdown" value="3 min" />
              <Stat label={de ? "Auswahlzeit" : "Pick Time"} value="30s" />
              <Stat label={de ? "Start-Prestige" : "Starting Prestige"} value="1000" />
              <Stat label={de ? "Max. Spieler" : "Max Players"} value="4" />
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
