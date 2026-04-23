import { describe, it, expect } from "vitest";
import {
  interpolateRoute,
  pickCopy,
  type TourStep,
} from "@/lib/tour/step-types";
import { CORE_SOCIAL_STEPS } from "@/lib/tour/steps/core-social";

describe("interpolateRoute", () => {
  it("replaces the {lang} placeholder with the active locale", () => {
    expect(interpolateRoute("/{lang}/dashboard", "de")).toBe("/de/dashboard");
    expect(interpolateRoute("/{lang}/packs/42", "en")).toBe("/en/packs/42");
  });

  it("leaves unrelated braces alone", () => {
    expect(interpolateRoute("/{lang}/{id}", "de")).toBe("/de/{id}");
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

describe("CORE_SOCIAL_STEPS", () => {
  it("has stable unique step IDs", () => {
    const ids = CORE_SOCIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers the 10 planned touchpoints", () => {
    expect(CORE_SOCIAL_STEPS).toHaveLength(10);
  });

  it("every step has both de and en copy with non-empty title+body", () => {
    for (const step of CORE_SOCIAL_STEPS) {
      expect(step.copy.de?.title, `step ${step.id} missing de.title`).toBeTruthy();
      expect(step.copy.de?.body, `step ${step.id} missing de.body`).toBeTruthy();
      expect(step.copy.en?.title, `step ${step.id} missing en.title`).toBeTruthy();
      expect(step.copy.en?.body, `step ${step.id} missing en.body`).toBeTruthy();
    }
  });

  it("every step's route uses the {lang} placeholder", () => {
    for (const step of CORE_SOCIAL_STEPS) {
      expect(step.route, `step ${step.id} must use {lang} placeholder`).toMatch(/^\/\{lang\}\//);
    }
  });

  it("chat steps stay on /dashboard so the /chat → /dashboard redirect doesn't loop", () => {
    const chatSteps = CORE_SOCIAL_STEPS.filter((s) => s.id.startsWith("chat-"));
    expect(chatSteps.length).toBeGreaterThan(0);
    for (const step of chatSteps) {
      expect(step.route).toBe("/{lang}/dashboard");
    }
  });
});
