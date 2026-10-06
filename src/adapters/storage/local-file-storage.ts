import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoragePort } from "@/core/ports/definition";

/** Extension ↔ MIME type for files the media route may serve. */
export const MEDIA_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  webm: "audio/webm",
  mp4: "video/mp4",
  json: "application/json",
  txt: "text/plain; charset=utf-8",
};

const EXTENSION_BY_TYPE: Record<string, string> = {
  ...Object.fromEntries(Object.entries(MEDIA_TYPES).map(([ext, type]) => [type.split(";")[0], ext])),
  "audio/mp3": "mp3",
  "audio/x-wav": "wav",
  "video/webm": "webm",
};

/** Flat keys only: no separators, no leading dot, so a key can never escape the root. */
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}(\.[A-Za-z0-9]{1,8})?$/;

export function isValidMediaKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

export function mediaTypeForKey(key: string): string {
  return MEDIA_TYPES[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

export type SavedMedia = { key: string; url: string; mimeType: string; size: number };

export type LocalFileStorage = StoragePort & {
  readonly root: string;
  /** Writes bytes under a fresh key and returns a URL served by `GET /api/media/[key]`. */
  saveMedia(bytes: Uint8Array, mimeType: string): Promise<SavedMedia>;
  size(key: string): Promise<number | null>;
};

export const DEFAULT_MEDIA_ROOT = path.join(process.cwd(), ".data", "media");

export function createLocalFileStorage(root: string = process.env.MEDIA_DIR || DEFAULT_MEDIA_ROOT): LocalFileStorage {
  const resolve = (key: string): string => {
    if (!isValidMediaKey(key)) throw new Error("storage_key_invalid");
    return path.join(root, key);
  };
  const storage: LocalFileStorage = {
    root,
    async write(key, bytes) {
      const file = resolve(key);
      await mkdir(root, { recursive: true });
      await writeFile(file, bytes);
    },
    async read(key) {
      return new Uint8Array(await readFile(resolve(key)));
    },
    async remove(key) {
      await rm(resolve(key), { force: true });
    },
    async size(key) {
      try {
        const info = await stat(resolve(key));
        return info.isFile() ? info.size : null;
      } catch {
        return null;
      }
    },
    async saveMedia(bytes, mimeType) {
      const type = mimeType.split(";")[0].trim().toLowerCase();
      const key = `${randomUUID()}.${EXTENSION_BY_TYPE[type] ?? "bin"}`;
      await storage.write(key, bytes);
      return { key, url: `/api/media/${key}`, mimeType: type, size: bytes.byteLength };
    },
  };
  return storage;
}

let shared: LocalFileStorage | undefined;

export function getMediaStorage(): LocalFileStorage {
  return (shared ??= createLocalFileStorage());
}
