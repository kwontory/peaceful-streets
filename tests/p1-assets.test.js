import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { P } from '../src/art.js';

const root = new URL('../assets/generated/', import.meta.url);
const expected = {
  'player/cat_idle': [32, 16, 2], 'player/cat_run': [64, 16, 4],
  'player/cat_jump': [32, 16, 2], 'player/cat_land': [16, 16, 1],
  'player/cat_spin': [64, 16, 4], 'tiles/ground': [96, 16, 6],
  'tiles/ground_variants': [64, 16, 4], 'tiles/platform': [48, 12, 3],
  'hazards/spikes': [16, 9, 1], 'hazards/chomper_pot': [60, 36, 3],
  'objects/checkpoint_lamp': [64, 50, 2], 'objects/checkpoint_lamp_glow': [32, 32, 1],
  'objects/goal_flag': [66, 50, 3], 'objects/sign_board': [24, 24, 1],
  'objects/sign_post': [3, 12, 1], 'items/flower': [9, 9, 1],
  'items/flower_collect': [60, 15, 4], 'fx/air_puff': [39, 6, 3],
  'fx/dust': [18, 4, 3], 'fx/poof': [64, 16, 4],
};
const timed = new Set([
  'player/cat_idle', 'player/cat_run', 'player/cat_jump', 'player/cat_spin',
  'hazards/chomper_pot', 'objects/checkpoint_lamp', 'objects/goal_flag',
  'items/flower_collect', 'fx/air_puff', 'fx/dust', 'fx/poof',
]);

function readPng(name) {
  const data = readFileSync(new URL(`${name}.png`, root));
  assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let width = 0, height = 0;
  const compressed = [];
  for (let at = 8; at < data.length;) {
    const length = data.readUInt32BE(at), type = data.toString('ascii', at + 4, at + 8);
    const body = data.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      assert.equal(body[8], 8); assert.equal(body[9], 6);
    }
    if (type === 'IDAT') compressed.push(body);
    at += length + 12;
  }
  const rows = inflateSync(Buffer.concat(compressed));
  const pixels = [];
  for (let y = 0; y < height; y++) {
    const start = y * (width * 4 + 1);
    assert.equal(rows[start], 0, `${name}: PNG scanline filter`);
    for (let x = 0; x < width; x++) pixels.push([...rows.subarray(start + 1 + x * 4, start + 5 + x * 4)]);
  }
  return { width, height, pixels };
}

test('P1 sheets have the specified dimensions, frames, palette, and pixel alpha', () => {
  const palette = new Set(Object.values(P).filter((color) => color.startsWith('#')).map((color) => color.slice(1).toLowerCase()));
  for (const [name, [width, height, frameCount]] of Object.entries(expected)) {
    const image = readPng(name);
    assert.deepEqual([image.width, image.height], [width, height], name);
    assert.ok(image.pixels.some((pixel) => pixel[3] > 0), `${name}: empty image`);
    const frameWidth = width / frameCount;
    const frameSignatures = [];
    for (let frame = 0; frame < frameCount; frame++) {
      const pixels = image.pixels.filter((_, index) => index % width >= frame * frameWidth && index % width < (frame + 1) * frameWidth);
      assert.ok(pixels.some((pixel) => pixel[3] > 0), `${name}: empty frame ${frame}`);
      frameSignatures.push(Buffer.from(pixels.flat()).toString('base64'));
    }
    if (timed.has(name)) assert.equal(new Set(frameSignatures).size, frameCount, `${name}: duplicate animation frames`);
    for (const pixel of image.pixels) {
      const [r, g, b, alpha] = pixel;
      if (name === 'objects/checkpoint_lamp_glow') assert.ok(alpha === 0 || alpha === 89, name);
      else assert.ok(alpha === 0 || alpha === 255, `${name}: antialiased pixel`);
      if (alpha) assert.ok(palette.has(Buffer.from([r, g, b]).toString('hex')), `${name}: color outside palette`);
    }
    if (timed.has(name)) {
      const info = JSON.parse(readFileSync(new URL(`${name}.json`, root), 'utf8'));
      assert.equal(info.frameWidth * info.frames, width, name);
      assert.equal(info.frameHeight, height, name);
      assert.equal(info.frames, frameCount, name);
      assert.equal(info.durationsMs.length, frameCount, name);
      assert.ok(info.durationsMs.every((ms) => ms > 0), name);
      assert.ok(info.anchor && Number.isInteger(info.anchor.x) && Number.isInteger(info.anchor.y), name);
    }
  }
});
