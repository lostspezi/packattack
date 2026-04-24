import { describe, it, expect } from "vitest";
import { slugify } from "@/models/news-post";

describe("slugify", () => {
  it("lowercases and dasherizes", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("collapses runs of whitespace and punctuation", () => {
    expect(slugify("Foo   bar!!! baz?")).toBe("foo-bar-baz");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("--hi--")).toBe("hi");
  });

  it("expands German umlauts", () => {
    expect(slugify("Größere Überraschung für Süß")).toBe("groessere-ueberraschung-fuer-suess");
  });

  it("strips accents", () => {
    expect(slugify("Café crème brûlée")).toBe("cafe-creme-brulee");
  });

  it("limits length to 80 chars", () => {
    const long = "a".repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });

  it("returns empty string for input without alphanumerics", () => {
    expect(slugify("!!!")).toBe("");
  });

  it("handles digits", () => {
    expect(slugify("Release 2026 v3")).toBe("release-2026-v3");
  });
});
