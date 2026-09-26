// Rebuild P1 sprite candidates from the game's existing code art and palette.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { P, CAT, CAT_MAP, LEGS, FLOWER, FLOWER_MAP, AIR_PUFF, AIR_PUFF_MAP,
  sprite, useContext, groundTile, spikes, pot, lamp, goalFlag } from '../src/art.js';

const root = new URL('../assets/generated/', import.meta.url).pathname;
const rgba = (value) => {
  if (Array.isArray(value)) return value;
  if (value.startsWith('#')) return [...value.slice(1).match(/../g).map((part) => parseInt(part, 16)), 255];
  const [r, g, b, a] = value.match(/[\d.]+/g).map(Number);
  return [r, g, b, Math.round(a * 255)];
};
class Bitmap {
  constructor(width, height) { this.width = width; this.height = height; this.data = new Uint8Array(width * height * 4); }
  pixel(x, y, color) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) this.data.set(rgba(color), (y * this.width + x) * 4);
  }
  rect(x, y, w, h, color) {
    for (let py = y | 0; py < (y | 0) + (h | 0); py++)
      for (let px = x | 0; px < (x | 0) + (w | 0); px++) this.pixel(px, py, color);
  }
  color(x, y) { return [...this.data.slice((y * this.width + x) * 4, (y * this.width + x) * 4 + 4)]; }
  blit(source, x, y, flip = false) {
    for (let sy = 0; sy < source.height; sy++) for (let sx = 0; sx < source.width; sx++) {
      const color = source.color(sx, sy);
      if (color[3]) this.pixel(x + (flip ? source.width - sx - 1 : sx), y + sy, color);
    }
  }
  copy() { const result = new Bitmap(this.width, this.height); result.data.set(this.data); return result; }
}
function draw(width, height, painter) {
  const bitmap = new Bitmap(width, height);
  useContext({ fillStyle: P.outline, fillRect(x, y, w, h) { bitmap.rect(x, y, w, h, this.fillStyle); } });
  painter(bitmap);
  return bitmap;
}
const crcTable = Array.from({ length: 256 }, (_, number) => {
  let value = number;
  for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function chunk(name, data) {
  const type = Buffer.from(name), size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([type, data])) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, type, data, checksum]);
}
function png(bitmap) {
  const header = Buffer.alloc(13), stride = bitmap.width * 4;
  header.writeUInt32BE(bitmap.width, 0); header.writeUInt32BE(bitmap.height, 4);
  header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc((stride + 1) * bitmap.height);
  for (let y = 0; y < bitmap.height; y++) rows.set(bitmap.data.slice(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
let images = 0, animations = 0;
const previews = new Map();
const oneShot = new Set(['player/cat_jump', 'player/cat_spin', 'objects/checkpoint_lamp', 'items/flower_collect', 'fx/air_puff', 'fx/dust', 'fx/poof']);
function save(name, frames, durationsMs = null, anchor = null, hitbox = null) {
  const sheet = new Bitmap(frames[0].width * frames.length, frames[0].height);
  frames.forEach((frame, index) => sheet.blit(frame, index * frame.width, 0));
  const file = join(root, `${name}.png`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, png(sheet)); images++;
  const group = name.split('/')[0];
  if (!previews.has(group)) previews.set(group, []);
  previews.get(group).push(sheet);
  if (durationsMs) {
    const info = { frameWidth: frames[0].width, frameHeight: frames[0].height, frames: frames.length, durationsMs, loop: !oneShot.has(name), anchor };
    if (hitbox) info.hitbox = hitbox;
    writeFileSync(join(root, `${name}.json`), `${JSON.stringify(info, null, 2)}\n`);
    animations++;
  }
}
const catBox = { x: 3, y: 2, width: 10, height: 14 };
const cat = (legs) => draw(16, 16, () => sprite([...CAT.slice(0, 14), ...LEGS[legs]], CAT_MAP, 0, 0));
const stand = cat('stand'), breathe = stand.copy();
for (let y = 10; y <= 12; y++) for (let x = 7; x <= 10; x++) breathe.pixel(x, y, stand.color(x, y + 1));
breathe.pixel(0, 12, [0, 0, 0, 0]); breathe.pixel(1, 11, P.outline);
save('player/cat_idle', [stand, breathe], [600, 600], { x: 8, y: 16 }, catBox);
const run1 = cat('run1'), run2 = cat('run2'), run3 = run1.copy(), run4 = run2.copy();
run3.pixel(2, 15, [0, 0, 0, 0]); run3.pixel(3, 15, P.outline); run3.pixel(13, 15, P.outline);
run4.pixel(4, 15, P.outline); run4.pixel(5, 15, P.outline); run4.pixel(12, 15, [0, 0, 0, 0]);
save('player/cat_run', [run1, run2, run3, run4], [90, 90, 90, 90], { x: 8, y: 16 }, catBox);
save('player/cat_jump', [cat('jump'), cat('run2')], [120, 120], { x: 8, y: 16 }, catBox);
const land = stand.copy();
for (let x = 4; x <= 13; x++) land.pixel(x, 1, [0, 0, 0, 0]);
land.rect(1, 14, 14, 1, P.catOrange); land.pixel(1, 15, P.outline); land.pixel(14, 15, P.outline);
save('player/cat_land', [land]);
const back = stand.copy();
for (let y = 7; y <= 9; y++) for (const x of [7, 11]) back.pixel(x, y, P.catOrange);
back.rect(5, 6, 2, 5, P.catStripe); back.rect(10, 6, 2, 5, P.catStripe);
const opposite = new Bitmap(16, 16); opposite.blit(stand, 0, 0, true);
const front = stand.copy(); front.pixel(0, 12, [0, 0, 0, 0]); front.pixel(2, 12, P.outline);
save('player/cat_spin', [stand, back, opposite, front], [50, 50, 50, 50], { x: 8, y: 16 }, catBox);
function ground(top, side = 'middle', variant = 0) {
  return draw(16, 16, (b) => {
    groundTile(0, 0, top);
    if (top) b.rect(0, 0, 16, 1, P.outline);
    if (side === 'left') b.rect(0, top ? 1 : 0, 1, 16, P.outline);
    if (side === 'right') b.rect(15, top ? 1 : 0, 1, 16, P.outline);
    if (variant) {
      if (top) { b.rect(4 + variant, 2, 3, 1, P.grassDark); b.rect(11 - variant, 7, 2, 1, P.brickDark); }
      else { b.rect(5 + variant, 10, 2, 2, P.brickDark); b.rect(11 - variant, 4, 2, 1, P.brickDark); }
    }
  });
}
save('tiles/ground', [ground(true, 'left'), ground(true), ground(true, 'right'), ground(false, 'left'), ground(false), ground(false, 'right')]);
save('tiles/ground_variants', [ground(true, 'middle', 1), ground(true, 'middle', 2), ground(false, 'middle', 1), ground(false, 'middle', 2)]);
save('tiles/platform', ['left', 'middle', 'right'].map((side, index) => draw(16, 12, (b) => {
  b.rect(0, 1, 16, 4, P.grass); b.rect(0, 5, 16, 1, P.grassDark);
  b.rect(0, 6, 16, 4, P.wood); b.rect(0, 10, 16, 1, P.woodDark);
  b.rect(0, 0, 16, 1, P.outline); b.rect(0, 11, 16, 1, P.outline);
  if (side === 'left') b.rect(0, 1, 1, 10, P.outline);
  if (side === 'right') b.rect(15, 1, 1, 10, P.outline);
  b.rect(index === 1 ? 7 : 9, 6, 1, 4, P.woodDark);
})));
save('hazards/spikes', [draw(16, 9, () => spikes(0, 1))]);
const shut = draw(20, 36, () => pot(2, 22, 1, false));
const open = draw(20, 36, () => pot(2, 22, 1, true));
const half = shut.copy(); half.rect(14, 8, 3, 3, P.mouth); half.pixel(14, 7, P.cream); half.pixel(14, 11, P.cream);
save('hazards/chomper_pot', [shut, half, open], [350, 175, 350], { x: 10, y: 36 }, { x: 4, y: 3, width: 12, height: 33 });
const lampFrame = (on) => draw(32, 50, (b) => {
  lamp(12, 50, on);
  for (let y = 0; y < 50; y++) for (let x = 0; x < 32; x++) if (b.color(x, y)[3] < 255) b.pixel(x, y, [0, 0, 0, 0]);
});
save('objects/checkpoint_lamp', [lampFrame(false), lampFrame(true)], [600, 600], { x: 16, y: 50 });
const glow = new Bitmap(32, 32);
for (let y = 0; y < 32; y++) {
  const dy = y - 16;
  if (Math.abs(dy) <= 14) { const half = Math.floor(Math.sqrt(14 * 14 - dy * dy)); glow.rect(16 - half, y, half * 2 + 1, 1, P.lampGlow); }
}
save('objects/checkpoint_lamp_glow', [glow]);
const flag = draw(22, 50, () => goalFlag(1, 50)), flagMid = flag.copy(), flagEnd = flag.copy();
for (let y = 3; y <= 15; y++) for (let x = 16; x < 22; x++) {
  flagMid.pixel(x, y, [0, 0, 0, 0]); flagEnd.pixel(x, y, [0, 0, 0, 0]);
}
flagMid.rect(16, 3, 3, 1, P.outline); flagMid.rect(16, 4, 2, 10, P.flag);
flagMid.rect(18, 4, 1, 10, P.outline); flagMid.rect(16, 14, 3, 1, P.outline);
flagEnd.rect(16, 3, 6, 1, P.outline); flagEnd.rect(16, 4, 5, 7, P.flag);
flagEnd.rect(21, 4, 1, 7, P.outline); flagEnd.rect(16, 11, 3, 3, P.flag);
flagEnd.rect(19, 11, 1, 3, P.outline); flagEnd.rect(16, 14, 4, 1, P.outline);
save('objects/goal_flag', [flag, flagMid, flagEnd], [150, 150, 150], { x: 1, y: 50 });
save('objects/sign_board', [draw(24, 24, (b) => {
  b.rect(2, 0, 20, 1, P.outline); b.rect(1, 1, 22, 22, P.outline);
  b.rect(0, 2, 24, 20, P.outline); b.rect(1, 1, 22, 22, P.panel);
  b.rect(2, 2, 20, 19, P.cream); b.rect(2, 20, 20, 2, P.panelShade);
  b.rect(4, 19, 6, 1, P.wood); b.rect(14, 5, 5, 1, P.panelShade);
})]);
save('objects/sign_post', [draw(3, 12, (b) => { b.rect(0, 0, 3, 12, P.outline); b.rect(1, 0, 1, 12, P.woodDark); })]);
save('items/flower', [draw(9, 9, () => sprite(FLOWER, FLOWER_MAP, 0, 0))]);
const petals = [[4, 1], [1, 4], [7, 4], [4, 7]];
save('items/flower_collect', [0, 1, 2, 3].map((frame) => draw(15, 15, (b) => {
  for (const [index, [x, y]] of petals.entries()) {
    const dx = x - 4, dy = y - 4;
    const px = 7 + dx + Math.sign(dx || (index % 2 ? 1 : -1)) * frame;
    const py = 7 + dy + Math.sign(dy || (index % 2 ? -1 : 1)) * frame;
    b.rect(px, py, frame < 2 ? 2 : 1, frame < 2 ? 2 : 1, P.flowerPetal);
  }
  if (frame < 2) b.rect(7, 7, 2, 2, P.flowerCenter);
})), [60, 60, 60, 60], { x: 7, y: 7 });
const puff = draw(13, 6, () => sprite(AIR_PUFF, AIR_PUFF_MAP, 0, 0)), puff2 = puff.copy();
puff2.rect(5, 3, 3, 2, [0, 0, 0, 0]);
const puff3 = draw(13, 6, (b) => { b.rect(0, 3, 3, 1, P.puffEdge); b.rect(4, 1, 3, 1, P.cloud); b.rect(9, 3, 4, 1, P.puffEdge); });
save('fx/air_puff', [puff, puff2, puff3], [100, 100, 100], { x: 6, y: 6 });
save('fx/dust', [0, 1, 2].map((frame) => draw(6, 4, (b) => {
  b.rect(frame, 2, 2, 1, P.cream); b.rect(4 - frame, 1, 1, 1, P.panelShade);
  if (frame < 2) b.pixel(1, 3, P.cream);
})), [80, 80, 80], { x: 3, y: 4 });
save('fx/poof', [0, 1, 2, 3].map((frame) => draw(16, 16, (b) => {
  const radius = [2.5, 4, 5.5, 6.5][frame];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const distance = Math.hypot(x - 7.5, y - 7.5);
    if (Math.abs(distance - radius) < 0.85 && (x * 3 + y * 5 + frame) % 8 > frame) b.pixel(x, y, P.cream);
  }
  if (frame < 3) { b.rect(5 - frame, 9 + frame, 2, 2, P.catOrange); b.rect(10 + frame, 5 - frame, 2, 1, P.catStripe); }
})), [70, 70, 70, 70], { x: 8, y: 8 });
for (const [group, sheets] of previews) {
  const preview = new Bitmap(Math.max(...sheets.map((sheet) => sheet.width)) * 4 + 16,
    sheets.reduce((height, sheet) => height + sheet.height * 4 + 12, 8));
  preview.rect(0, 0, preview.width, preview.height, P.villa);
  let top = 8;
  for (const sheet of sheets) {
    for (let y = 0; y < sheet.height; y++) for (let x = 0; x < sheet.width; x++) {
      const color = sheet.color(x, y);
      if (color[3]) preview.rect(8 + x * 4, top + y * 4, 4, 4, color);
    }
    top += sheet.height * 4 + 12;
  }
  writeFileSync(join(root, `_preview_${group}_4x.png`), png(preview));
}
console.log(`Built ${images} P1 PNG files and ${animations} animation JSON files in assets/generated/`);
