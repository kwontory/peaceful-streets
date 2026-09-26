import test from "node:test";
import assert from "node:assert/strict";
import { preloadAssets, imageFor } from "../src/assets.js";

test("assets load before use and failed images leave the drawing fallback available", async () => {
  const result = await preloadAssets({ cat: "cat.png", missing: "missing.png" }, () => {
    const image = { naturalWidth: 0 };
    Object.defineProperty(image, "src", {
      set(value) {
        queueMicrotask(() => {
          if (value === "cat.png") { image.naturalWidth = 16; image.onload(); }
          else image.onerror();
        });
      },
    });
    return image;
  });
  assert.deepEqual(result, { loaded: 1, failed: ["missing"] });
  assert.equal(imageFor("cat").naturalWidth, 16);
  assert.equal(imageFor("missing"), null);
});
