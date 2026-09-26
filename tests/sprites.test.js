import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spriteManifest } from "../src/assets.js";
import { SHEETS } from "../src/sprites.js";

// PNG 머리의 IHDR 에서 가로·세로를 읽는다
function pngSize(path) {
  const bytes = readFileSync(path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("every approved sprite has frame info and the PNG matches it", () => {
  for (const [key, path] of Object.entries(spriteManifest)) {
    const sheet = SHEETS[key];
    assert.ok(sheet, `${key}: src/sprites.js 의 SHEETS 에 프레임 정보가 없다`);
    assert.ok(existsSync(path), `${key}: ${path} 파일이 없다`);
    const { width, height } = pngSize(path);
    assert.equal(width, sheet.w * sheet.frames, `${key}: 가로 ${width} ≠ ${sheet.w}×${sheet.frames}`);
    assert.equal(height, sheet.h, `${key}: 세로 ${height} ≠ ${sheet.h}`);
  }
});

test("sprite frame info agrees with the asset JSON", () => {
  for (const [key, path] of Object.entries(spriteManifest)) {
    const json = path.replace(/\.png$/, ".json");
    if (!existsSync(json)) continue;
    const meta = JSON.parse(readFileSync(json, "utf8"));
    assert.equal(meta.frameWidth, SHEETS[key].w, `${key}: frameWidth`);
    assert.equal(meta.frameHeight, SHEETS[key].h, `${key}: frameHeight`);
    assert.equal(meta.frames, SHEETS[key].frames, `${key}: frames`);
  }
});
