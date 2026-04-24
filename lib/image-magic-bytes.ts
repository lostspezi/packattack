/**
 * Lightweight magic-byte sniffing for image uploads. Used to defend against
 * polyglot files where the client-supplied Content-Type header lies about the
 * payload. Mirrors the existing PNG/JPEG checks in app/api/profile/avatar.
 */

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type SupportedImageMime = "image/png" | "image/jpeg" | "image/webp";

export function detectImageMime(buf: Buffer): SupportedImageMime | null {
  if (buf.length >= 8 && buf.slice(0, 8).equals(PNG_SIG)) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}
