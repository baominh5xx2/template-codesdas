import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createLocalFileStorage, isValidMediaKey } from "@/adapters/storage/local-file-storage";

let root: string;
beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "media-"));
  vi.stubEnv("MEDIA_DIR", root);
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

describe("local file storage", () => {
  it("saves media under a fresh key with a matching extension and serves it back", async () => {
    const storage = createLocalFileStorage(root);
    const saved = await storage.saveMedia(new Uint8Array([1, 2, 3]), "audio/mpeg");
    expect(saved).toMatchObject({ mimeType: "audio/mpeg", size: 3 });
    expect(saved.key).toMatch(/^[0-9a-f-]{36}\.mp3$/);
    expect(saved.url).toBe(`/api/media/${saved.key}`);
    expect(Array.from(await storage.read(saved.key))).toEqual([1, 2, 3]);
    await storage.remove(saved.key);
    expect(await storage.size(saved.key)).toBeNull();
  });

  it("rejects keys that could escape the root", async () => {
    for (const key of ["../x", "a/b", "..", ".env", "a\\b", "", "x".repeat(200)]) expect(isValidMediaKey(key)).toBe(false);
    await expect(createLocalFileStorage(root).read("../secret")).rejects.toThrow("storage_key_invalid");
  });
});

describe("GET /api/media/[key]", () => {
  it("serves full files, byte ranges, and 404s", async () => {
    const { GET } = await import("@/app/api/media/[key]/route");
    const saved = await createLocalFileStorage(root).saveMedia(new TextEncoder().encode("0123456789"), "video/mp4");
    const call = (key: string, headers?: HeadersInit) => GET(new Request(`http://local/api/media/${key}`, { headers }), { params: Promise.resolve({ key }) });

    const full = await call(saved.key);
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("video/mp4");
    expect(full.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await full.text()).toBe("0123456789");

    const partial = await call(saved.key, { range: "bytes=2-5" });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(await partial.text()).toBe("2345");

    expect((await call(saved.key, { range: "bytes=-3" }).then((r) => r.text()))).toBe("789");
    expect((await call(saved.key, { range: "bytes=50-" })).status).toBe(416);
    expect((await call("missing.mp4")).status).toBe(404);
    expect((await call("..%2Fx")).status).toBe(404);
  });
});
