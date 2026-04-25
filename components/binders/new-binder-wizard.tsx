"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ThemePicker, type ThemeKey } from "./theme-picker";
import {
  SetTemplatePicker,
  type SetTemplateSelection,
} from "./set-template-picker";

type BinderType = "free" | "set-template";
type Step = "type" | "set" | "details";

interface NewBinderWizardProps {
  lang: string;
}

export function NewBinderWizard({ lang }: NewBinderWizardProps) {
  const isDe = lang === "de";
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("type");
  const [type, setType] = useState<BinderType>("free");
  const [setSelection, setSetSelection] =
    useState<SetTemplateSelection | null>(null);
  const [theme, setTheme] = useState<ThemeKey>("classic");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function next() {
    if (step === "type") {
      setStep(type === "set-template" ? "set" : "details");
    } else if (step === "set") {
      if (!setSelection) {
        toast({
          type: "error",
          title: isDe ? "Bitte ein Set wählen." : "Please pick a set.",
        });
        return;
      }
      setStep("details");
    }
  }

  function back() {
    if (step === "set") setStep("type");
    if (step === "details") setStep(type === "set-template" ? "set" : "type");
  }

  async function submit() {
    if (!name.trim()) {
      toast({
        type: "error",
        title: isDe ? "Bitte einen Namen angeben." : "Please give it a name.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/binders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          type,
          theme,
          setTemplate:
            type === "set-template" && setSelection
              ? { game: setSelection.game, set: setSelection.set }
              : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({
          type: "error",
          title: isDe ? "Konnte nicht erstellen." : "Could not create.",
          message:
            typeof body.error === "string" ? body.error : undefined,
        });
        setSubmitting(false);
        return;
      }
      const data = (await res.json()) as { binder: { slug: string } };
      router.push(`/${lang}/binders/${data.binder.slug}`);
    } catch {
      toast({
        type: "error",
        title: isDe ? "Netzwerkfehler." : "Network error.",
      });
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="w-7 h-7 text-pa-green" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {isDe ? "Neuer Binder" : "New binder"}
          </h1>
          <p className="text-sm text-text-secondary">
            {isDe
              ? "In drei Schritten zu deinem eigenen Sammelalbum."
              : "Build your own album in three steps."}
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
        <StepIndicator step={step} type={type} isDe={isDe} />

        {step === "type" && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-text-primary">
              {isDe ? "Welche Art Binder?" : "What kind of binder?"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TypeOption
                title={isDe ? "Frei" : "Free"}
                description={
                  isDe
                    ? "Leerer Binder. Du entscheidest alles selbst."
                    : "Empty binder. You decide everything."
                }
                active={type === "free"}
                onClick={() => setType("free")}
              />
              <TypeOption
                title={isDe ? "Set-Template" : "Set template"}
                description={
                  isDe
                    ? "Slots sind nach einem Set vorbereitet, Vollständigkeit wird gezählt."
                    : "Slots are pre-allocated for a set, completion is tracked."
                }
                active={type === "set-template"}
                onClick={() => setType("set-template")}
              />
            </div>
          </div>
        )}

        {step === "set" && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-text-primary">
              {isDe ? "Welches Set?" : "Which set?"}
            </h2>
            <SetTemplatePicker
              value={setSelection}
              onChange={setSetSelection}
              isDe={isDe}
            />
          </div>
        )}

        {step === "details" && (
          <div className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="binder-name"
                className="block text-sm font-medium text-text-secondary"
              >
                {isDe ? "Name" : "Name"}
              </label>
              <input
                id="binder-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder={
                  isDe ? "z. B. Mein erster Binder" : "e.g. My first binder"
                }
                className="w-full bg-white/3 border border-white/8 text-text-primary rounded-[10px] px-4 py-3 outline-none focus:border-pa-green/35 focus:ring-2 focus:ring-pa-green/6"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="binder-description"
                className="block text-sm font-medium text-text-secondary"
              >
                {isDe ? "Beschreibung" : "Description"}
              </label>
              <textarea
                id="binder-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder={
                  isDe
                    ? "Worum geht es in diesem Binder?"
                    : "What is this binder about?"
                }
                className="w-full bg-white/3 border border-white/8 text-text-primary rounded-[10px] px-4 py-3 outline-none focus:border-pa-green/35 focus:ring-2 focus:ring-pa-green/6"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">
                {isDe ? "Theme" : "Theme"}
              </label>
              <ThemePicker value={theme} onChange={setTheme} isDe={isDe} />
            </div>
          </div>
        )}

        <div className="flex justify-between pt-2">
          {step !== "type" ? (
            <button
              type="button"
              onClick={back}
              className="text-sm text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              {isDe ? "Zurück" : "Back"}
            </button>
          ) : (
            <span />
          )}

          {step === "details" ? (
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !name.trim()}
              className="bg-pa-green text-bg font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-pa-green-hover disabled:opacity-60 inline-flex items-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {submitting
                ? isDe
                  ? "Wird angelegt…"
                  : "Creating…"
                : isDe
                  ? "Binder anlegen"
                  : "Create binder"}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="bg-pa-green text-bg font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-pa-green-hover inline-flex items-center gap-2"
            >
              {isDe ? "Weiter" : "Next"}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({
  step,
  type,
  isDe,
}: {
  step: Step;
  type: BinderType;
  isDe: boolean;
}) {
  const steps: Step[] =
    type === "set-template" ? ["type", "set", "details"] : ["type", "details"];
  const activeIdx = steps.indexOf(step);
  return (
    <div className="flex items-center gap-2 text-xs text-text-muted">
      {steps.map((s, i) => {
        const label =
          s === "type"
            ? isDe
              ? "Typ"
              : "Type"
            : s === "set"
              ? "Set"
              : isDe
                ? "Details"
                : "Details";
        return (
          <span key={s} className="flex items-center gap-2">
            <span
              className={[
                "px-2 py-0.5 rounded-md text-[11px] font-bold uppercase",
                i <= activeIdx
                  ? "bg-pa-green/15 text-pa-green"
                  : "bg-white/5 text-text-muted",
              ].join(" ")}
            >
              {label}
            </span>
            {i < steps.length - 1 && <span className="text-text-muted">›</span>}
          </span>
        );
      })}
    </div>
  );
}

function TypeOption({
  title,
  description,
  active,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "text-left p-4 rounded-xl border transition-colors",
        active
          ? "border-pa-green bg-pa-green/10"
          : "border-white/8 hover:border-white/20",
      ].join(" ")}
    >
      <p className="text-sm font-bold text-text-primary mb-1">{title}</p>
      <p className="text-xs text-text-muted">{description}</p>
    </button>
  );
}
