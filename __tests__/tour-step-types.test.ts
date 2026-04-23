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
});

describe("ONBOARDING_STEPS", () => {
  it("has stable unique step IDs", () => {
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers the 8 onboarding touchpoints (welcome → reward)", () => {
    expect(ONBOARDING_STEPS).toHaveLength(8);
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

  it("steps that need the tutorial slug use the {tutorialSlug} placeholder", () => {
    const slugSteps = ONBOARDING_STEPS.filter((s) =>
      ["pack-buy", "pack-opening", "card-decision"].includes(s.id),
    );
    expect(slugSteps).toHaveLength(3);
    for (const step of slugSteps) {
      expect(step.route).toContain("{tutorialSlug}");
    }
  });

  it("the final step triggers the reward POST via click-next", () => {
    const last = ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];
    expect(last.id).toBe("tour-reward");
    expect(last.nextTrigger.type).toBe("click-next");
  });
});
