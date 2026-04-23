import { describe, it, expect } from "vitest";
import {
  interpolatePattern,
  interpolateRoute,
  pickCopy,
  type TourStep,
} from "@/lib/tour/step-types";
import { ONBOARDING_STEPS } from "@/lib/tour/steps/onboarding";

describe("interpolateRoute", () => {
  it("replaces the {lang} placeholder with the active locale", () => {
    expect(interpolateRoute("/{lang}/dashboard", "de")).toBe("/de/dashboard");
    expect(interpolateRoute("/{lang}/packs/42", "en")).toBe("/en/packs/42");
  });

  it("strips unknown placeholders (returns empty)", () => {
    expect(interpolateRoute("/{lang}/{id}", "de")).toBe("/de/");
  });
});

describe("interpolatePattern", () => {
  it("substitutes multiple placeholders", () => {
    expect(
      interpolatePattern("/{lang}/packs/{tutorialSlug}", {
        lang: "de",
        tutorialSlug: "starter-pack",
      }),
    ).toBe("/de/packs/starter-pack");
  });

  it("empties out unknown placeholders rather than leaving them raw", () => {
    expect(
      interpolatePattern("/{lang}/x/{missing}", { lang: "en" }),
    ).toBe("/en/x/");
  });
});

describe("pickCopy", () => {
  const step: TourStep = {
    id: "test",
    route: "/{lang}/x",
    selector: '[data-tour="test"]',
    nextTrigger: { type: "click-next" },
    copy: {
      de: { title: "Hallo", body: "Welt" },
      en: { title: "Hi", body: "World" },
    },
  };

  it("returns the copy for the active locale", () => {
    expect(pickCopy(step, "de").title).toBe("Hallo");
    expect(pickCopy(step, "en").title).toBe("Hi");
  });

  it("falls back to en then de then first entry for missing locales", () => {
    expect(pickCopy(step, "fr").title).toBe("Hi");
    const deOnly: TourStep = { ...step, copy: { de: step.copy.de } };
    expect(pickCopy(deOnly, "fr").title).toBe("Hallo");
  });

  it("returns base copy when isReplay=true but no copyOnReplay is defined", () => {
    expect(pickCopy(step, "de", true)).toEqual(step.copy.de);
  });

  it("merges copyOnReplay over base copy on replay — partial overrides fall through", () => {
    const replayStep: TourStep = {
      ...step,
      copyOnReplay: {
        de: { body: "Zurück — keine Belohnung mehr" },
      },
    };
    const first = pickCopy(replayStep, "de", false);
    const replay = pickCopy(replayStep, "de", true);
    expect(first.body).toBe("Welt");
    expect(replay.title).toBe("Hallo"); // inherited from base
    expect(replay.body).toBe("Zurück — keine Belohnung mehr"); // override
  });

  it("uses copyOnReplay locale fallbacks when the active locale has none", () => {
    const replayStep: TourStep = {
      ...step,
      copyOnReplay: {
        en: { title: "Replay EN only" },
      },
    };
    expect(pickCopy(replayStep, "de", true).title).toBe("Replay EN only");
  });
});

describe("ONBOARDING_STEPS", () => {
  it("has stable unique step IDs", () => {
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("walks welcome → packs → (box detail deep-dive) → balance in order", () => {
    expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual([
      "tour-welcome",
      "tour-packs",
      "tour-box-buy",
      "tour-box-condition",
      "tour-box-rarities",
      "tour-box-top-hits",
      "tour-box-live-pulls",
      "tour-box-my-pulls",
      "tour-box-card",
      "tour-balance",
    ]);
  });

  it("every step has both de and en copy with non-empty title+body", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(
        step.copy.de?.title,
        `step ${step.id} missing de.title`,
      ).toBeTruthy();
      expect(
        step.copy.de?.body,
        `step ${step.id} missing de.body`,
      ).toBeTruthy();
      expect(
        step.copy.en?.title,
        `step ${step.id} missing en.title`,
      ).toBeTruthy();
      expect(
        step.copy.en?.body,
        `step ${step.id} missing en.body`,
      ).toBeTruthy();
    }
  });

  it("every step's route uses the {lang} placeholder", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(
        step.route,
        `step ${step.id} must use {lang} placeholder`,
      ).toMatch(/^\/\{lang\}\//);
    }
  });

  it("every box-detail sub-step uses the {tutorialSlug} placeholder", () => {
    const slugSteps = ONBOARDING_STEPS.filter((s) =>
      s.route.includes("{tutorialSlug}"),
    );
    expect(slugSteps.length).toBeGreaterThanOrEqual(1);
    for (const step of slugSteps) {
      expect(
        step.id.startsWith("tour-box-"),
        `step ${step.id} uses tutorial slug but isn't a box-detail step`,
      ).toBe(true);
    }
  });

  it("all steps advance via click-next — no forced real interactions", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(
        step.nextTrigger.type,
        `step ${step.id} should be click-next`,
      ).toBe("click-next");
    }
  });

  it("the final step lives on /balance where the reward is granted", () => {
    const last = ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];
    expect(last.id).toBe("tour-balance");
    expect(last.route).toBe("/{lang}/balance");
  });

  it("welcome and balance steps ship replay variants so re-runs don't re-promise coins", () => {
    const welcome = ONBOARDING_STEPS.find((s) => s.id === "tour-welcome")!;
    const balance = ONBOARDING_STEPS.find((s) => s.id === "tour-balance")!;
    expect(welcome.copyOnReplay, "welcome needs a replay body").toBeDefined();
    expect(balance.copyOnReplay?.de, "balance replay needs a de variant").toBeDefined();
    // The replay bodies must not promise a bonus the user will never get.
    expect(welcome.copyOnReplay?.de?.body).not.toMatch(/schenk ich dir 10 Coins/);
    expect(balance.copyOnReplay?.de?.body).not.toMatch(/schreib dir gleich 10 Coins gut/);
  });

  it("no step copy uses em-dashes — they read as AI-generated", () => {
    // Em-dash (—) and en-dash (–) both flagged. Ordinary hyphens are fine.
    const EM_OR_EN_DASH = /[—–]/;
    for (const step of ONBOARDING_STEPS) {
      for (const [lang, copy] of Object.entries(step.copy)) {
        expect(
          copy.title,
          `step ${step.id} / ${lang} title has a dash`,
        ).not.toMatch(EM_OR_EN_DASH);
        expect(
          copy.body,
          `step ${step.id} / ${lang} body has a dash`,
        ).not.toMatch(EM_OR_EN_DASH);
      }
      if (step.copyOnReplay) {
        for (const [lang, copy] of Object.entries(step.copyOnReplay)) {
          if (copy.title !== undefined) {
            expect(
              copy.title,
              `step ${step.id} / ${lang} replay title has a dash`,
            ).not.toMatch(EM_OR_EN_DASH);
          }
          if (copy.body !== undefined) {
            expect(
              copy.body,
              `step ${step.id} / ${lang} replay body has a dash`,
            ).not.toMatch(EM_OR_EN_DASH);
          }
        }
      }
    }
  });
});
