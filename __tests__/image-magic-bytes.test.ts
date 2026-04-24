import { describe, it, expect } from "vitest";
import { detectImageMime } from "@/lib/image-magic-bytes";

describe("detectImageMime", () => {
  it("detects PNG", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(detectImageMime(buf)).toBe("image/png");
  });

  it("detects JPEG", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(detectImageMime(buf)).toBe("image/jpeg");
  });

  it("detects WebP", () => {
    const buf = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(detectImageMime(buf)).toBe("image/webp");
  });

  it("rejects an unrelated binary", () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
    expect(detectImageMime(buf)).toBeNull();
  });

  it("rejects a too-short buffer", () => {
    expect(detectImageMime(Buffer.from([0xff]))).toBeNull();
  });

  it("rejects RIFF that is not WebP", () => {
    const buf = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(detectImageMime(buf)).toBeNull();
  });
});
