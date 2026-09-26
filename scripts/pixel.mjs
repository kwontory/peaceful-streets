// 에셋 생성 스크립트 공용 도구: 픽셀 비트맵, 코드 그림을 비트맵에 그리기, PNG 저장
import { deflateSync } from 'node:zlib';
import { P, useContext } from '../src/art.js';

export const rgba = (value) => {
  if (Array.isArray(value)) return value;
  if (value.startsWith('#')) return [...value.slice(1).match(/../g).map((part) => parseInt(part, 16)), 255];
  const [r, g, b, a] = value.match(/[\d.]+/g).map(Number);
  return [r, g, b, Math.round(a * 255)];
};
export class Bitmap {
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
export function draw(width, height, painter) {
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
export function png(bitmap) {
  const header = Buffer.alloc(13), stride = bitmap.width * 4;
  header.writeUInt32BE(bitmap.width, 0); header.writeUInt32BE(bitmap.height, 4);
  header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc((stride + 1) * bitmap.height);
  for (let y = 0; y < bitmap.height; y++) rows.set(bitmap.data.slice(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
