/** Binary payload passed into or returned from the gateway. */
export type MediaBytes = { bytes: Uint8Array; mimeType: string };

/** Sniffs common image/audio/video signatures; falls back to `fallback`. */
export function sniffMimeType(bytes: Uint8Array, fallback: string): string {
  const at = (offset: number, ...values: number[]) => values.every((value, i) => bytes[offset + i] === value);
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x41, 0x56, 0x45)) return "audio/wav";
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (at(0, 0x49, 0x44, 0x33) || at(0, 0xff, 0xfb) || at(0, 0xff, 0xf3) || at(0, 0xff, 0xf2)) return "audio/mpeg";
  if (at(4, 0x66, 0x74, 0x79, 0x70)) return "video/mp4";
  return fallback;
}

export function decodeBase64(value: string): Uint8Array {
  const payload = value.startsWith("data:") ? value.slice(value.indexOf(",") + 1) : value;
  return new Uint8Array(Buffer.from(payload, "base64"));
}

export function toBlob(media: MediaBytes): Blob {
  return new Blob([media.bytes as Uint8Array<ArrayBuffer>], { type: media.mimeType });
}
