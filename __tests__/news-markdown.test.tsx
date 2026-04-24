import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { classifyLink, renderNewsMarkdown } from "@/lib/news/markdown";

const html = (source: string) => renderToStaticMarkup(renderNewsMarkdown(source));

describe("classifyLink", () => {
  it("accepts internal absolute paths", () => {
    expect(classifyLink("/de/packs")).toEqual({ href: "/de/packs", external: false });
  });

  it("accepts http and https urls", () => {
    expect(classifyLink("https://example.com/")).toMatchObject({ external: true });
    expect(classifyLink("http://example.com/")).toMatchObject({ external: true });
  });

  it("rejects javascript and data URIs", () => {
    expect(classifyLink("javascript:alert(1)")).toBeNull();
    expect(classifyLink("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects relative paths without leading slash", () => {
    expect(classifyLink("packs")).toBeNull();
    expect(classifyLink("../secret")).toBeNull();
  });
});

describe("renderNewsMarkdown", () => {
  it("renders plain text in a paragraph", () => {
    expect(html("Hallo")).toContain("<p");
    expect(html("Hallo")).toContain("Hallo");
  });

  it("renders bold and italic", () => {
    expect(html("Das ist **wichtig** und *kursiv*")).toContain("<strong>wichtig</strong>");
    expect(html("Das ist **wichtig** und *kursiv*")).toContain("<em>kursiv</em>");
  });

  it("renders inline code", () => {
    expect(html("Nutze `npm install`")).toContain("<code");
    expect(html("Nutze `npm install`")).toContain("npm install");
  });

  it("renders headings ## as h3", () => {
    expect(html("## Section")).toContain("<h3");
  });

  it("renders external links with target=_blank and rel noopener", () => {
    const out = html("Schau [hier](https://example.com)");
    expect(out).toContain('href="https://example.com/"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain("noopener");
    expect(out).toContain("noreferrer");
  });

  it("renders internal links without target=_blank", () => {
    const out = html("Schau [hier](/de/packs)");
    expect(out).toContain('href="/de/packs"');
    expect(out).not.toContain('target="_blank"');
  });

  it("does not render javascript: as anchor", () => {
    const out = html("Klick [hier](javascript:alert(1))");
    expect(out).not.toContain("<a");
    expect(out).toContain("[hier](javascript:alert(1))");
  });

  it("renders unordered lists", () => {
    const out = html("- eins\n- zwei");
    expect(out).toContain("<ul");
    expect(out).toContain("<li");
    expect(out).toContain("eins");
    expect(out).toContain("zwei");
  });

  it("separates paragraphs by blank line", () => {
    const out = html("erste\n\nzweite");
    const paragraphs = out.match(/<p/g) ?? [];
    expect(paragraphs.length).toBe(2);
  });
});
