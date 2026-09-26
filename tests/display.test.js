import test from "node:test";
import assert from "node:assert/strict";
import { canvasScale, createDisplaySettings } from "../src/display.js";

test("compact mode preserves integer pixels on large screens and fits small screens", () => {
  assert.equal(canvasScale(4.1), 4);
  assert.equal(canvasScale(4.1, true), 3);
  assert.equal(canvasScale(1.5), 1.5);
  assert.ok(Math.abs(canvasScale(1.5, true) - 1.2) < 1e-9);
});

test("display preference is restored and saved", () => {
  const values = new Map([["peaceful-streets.display", "compact"]]);
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  const display = createDisplaySettings(storage);
  assert.equal(display.isCompact(), true);
  display.setCompact(false);
  assert.equal(values.get("peaceful-streets.display"), "auto");
  assert.equal(createDisplaySettings(storage).isCompact(), false);
});
