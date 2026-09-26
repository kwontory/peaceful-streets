// P2 배경과 표지판 판자를 게임의 코드 그림(src/art.js)에서 PNG로 만든다.
// 사용: npm run assets:p2 → assets/generated/backgrounds/, assets/generated/objects/sign_board.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { P, W, useContext, drawFar, drawMid, cloud, panel } from '../src/art.js';
import { Bitmap, png, rgba } from './pixel.mjs';

const root = new URL('../assets/generated/', import.meta.url).pathname;

// 게임 좌표 (ox, oy) 부터 width×height 만큼을 비트맵으로 옮겨 그린다.
// 반투명 색(배경 그늘 P.shade 등)은 캔버스처럼 아래 색과 섞어 불투명한 한 색으로 칠한다.
function capture(width, height, ox, oy, painter) {
  const bitmap = new Bitmap(width, height);
  const fill = (x, y, w, h, color) => {
    const [r, g, b, a] = rgba(color);
    if (a === 255) return bitmap.rect(x, y, w, h, color);
    for (let py = y | 0; py < (y | 0) + (h | 0); py++) for (let px = x | 0; px < (x | 0) + (w | 0); px++) {
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const [br, bg, bb, ba] = bitmap.color(px, py);
      if (!ba) { bitmap.pixel(px, py, [r, g, b, a]); continue; }
      const k = a / 255;
      bitmap.pixel(px, py, [Math.round(r * k + br * (1 - k)), Math.round(g * k + bg * (1 - k)), Math.round(b * k + bb * (1 - k)), 255]);
    }
  };
  useContext({ fillStyle: P.outline, fillRect(x, y, w, h) { fill(x - ox, y - oy, w, h, this.fillStyle); } });
  painter();
  return bitmap;
}

function save(name, bitmap, info = null) {
  const file = join(root, `${name}.png`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, png(bitmap));
  if (info) writeFileSync(join(root, `${name}.json`), `${JSON.stringify(info, null, 2)}\n`);
  console.log(`${name}.png ${bitmap.width}×${bitmap.height}`);
}

// 먼 배경: y 60~240. 가까운 집 사이 빈틈으로 아래쪽 먼 벽이 보이므로 바닥(224) 아래까지 담는다
save('backgrounds/far', capture(W, 180, 0, 60, drawFar));
// 가까운 배경: y 74~224 (전봇대 꼭대기부터 바닥까지)
save('backgrounds/mid', capture(W, 150, 0, 74, drawMid));

// 구름 3개: 게임에서 쓰는 폭 48 / 36 / 56 을 64×16 칸 가운데에
const CLOUD_WIDTHS = [48, 36, 56];
const clouds = new Bitmap(64 * CLOUD_WIDTHS.length, 16);
CLOUD_WIDTHS.forEach((w, i) => clouds.blit(capture(64, 16, 0, 0, () => cloud((64 - w) / 2, 4, w)), i * 64, 0));
save('backgrounds/clouds', clouds, { frameWidth: 64, frameHeight: 16, frames: 3, durationsMs: [0, 0, 0], loop: false, anchor: { x: 32, y: 4 } });

// 표지판 판자: 9-slice(모서리 8px). 늘려도 줄무늬가 생기지 않게 무늬 없이, 게임 패널과 같은 모양
save('objects/sign_board', capture(24, 24, 0, 0, () => panel(0, 0, 24, 24, P.panel, P.panelShade)));
