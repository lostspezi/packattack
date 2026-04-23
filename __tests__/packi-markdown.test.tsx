import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderPackiMarkdown } from "@/lib/packi/markdown";

const html = (source: string) => renderToStaticMarkup(renderPackiMarkdown(source));

describe("renderPackiMarkdown", () => {
  it("renders plain text in a paragraph", () => {
    expect(html("Hallo Welt")).toBe("<p>Hallo Welt</p>");
  });

  it("renders bold text", () => {
    expect(html("Das ist **wichtig** ok")).toContain("<strong>wichtig</strong>");
  });

  it("renders italics", () => {
    expect(html("Das ist *kursiv* ok")).toContain("<em>kursiv</em>");
  });

  it("renders links only for relative hrefs starting with /", () => {
    const out = html("Schau [hier](/de/dashboard)");
    expect(out).toContain('href="/de/dashboard"');
    expect(out).toContain("text-pa-green");
  });

  it("refuses to render http(s) links as anchors", () => {
    const out = html("Klick [hier](https://evil.example.com)");
    expect(out).not.toContain("<a");
    expect(out).toContain("[hier](https://evil.example.com)");
  });

  it("refuses to render javascript: links", () => {
    // Regex requires href starting with /, so javascript: never matches.
    const out = html("[click](javascript:alert(1))");
    expect(out).not.toContain("<a");
  });

  it("renders bullet lists", () => {
    const out = html("- Erste\n- Zweite");
    expect(out).toContain("<ul");
    expect(out).toContain("<li>Erste</li>");
    expect(out).toContain("<li>Zweite</li>");
  });

  it("separates lists between blank-line paragraphs", () => {
    const out = html("Hallo\n\n- eins\n- zwei\n\nEnde");
    expect(out).toContain("<p>Hallo</p>");
    expect(out).toContain("<ul");
    expect(out).toContain("<p>Ende</p>");
  });

  it("escapes raw HTML (React default) so script tags cannot render", () => {
    const out = html("<script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });
});
