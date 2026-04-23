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

  it("is a compact 4-step walkthrough: welcome → packs → tutorial-box → balance", () => {
    expect(ONBOARDING_STEPS).toHaveLength(4);
    expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual([
      "tour-welcome",
      "tour-packs",
      "tour-tutorial-box",
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

  it("only tour-tutorial-box needs the {tutorialSlug} placeholder", () => {
    const slugSteps = ONBOARDING_STEPS.filter((s) =>
      s.route.includes("{tutorialSlug}"),
    );
    expect(slugSteps).toHaveLength(1);
    expect(slugSteps[0].id).toBe("tour-tutorial-box");
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
});
