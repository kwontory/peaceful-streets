// 승인된 픽셀아트 이미지 그리기 (docs/ASSET_SPEC.md, assets/sprites/)
// 이미지가 없으면 false 를 돌려주고, 부르는 쪽(render.js)이 기존 코드 그림으로 그린다.
import { imageFor } from "./assets.js";

// 에셋별 프레임 정보. assets/sprites/<분류>/<이름>.json 과 같아야 한다 (tests/sprites.test.js 가 확인).
export const SHEETS = {
  cat_idle: { w: 16, h: 16, frames: 2 },
  cat_run: { w: 16, h: 16, frames: 4 },
  cat_jump: { w: 16, h: 16, frames: 2 },
  cat_land: { w: 16, h: 16, frames: 1 },
  cat_spin: { w: 16, h: 16, frames: 4 },
  ground: { w: 16, h: 16, frames: 6 },
  ground_variants: { w: 16, h: 16, frames: 4 },
  platform: { w: 16, h: 12, frames: 3 },
  spikes: { w: 16, h: 9, frames: 1 },
  chomper_pot: { w: 20, h: 36, frames: 3 },
  checkpoint_lamp: { w: 32, h: 50, frames: 2 },
  checkpoint_lamp_glow: { w: 32, h: 32, frames: 1 },
  goal_flag: { w: 22, h: 50, frames: 3 },
  sign_board: { w: 24, h: 24, frames: 1 },
  sign_post: { w: 3, h: 12, frames: 1 },
  flower: { w: 9, h: 9, frames: 1 },
  flower_collect: { w: 15, h: 15, frames: 4 },
  air_puff: { w: 13, h: 6, frames: 3 },
  dust: { w: 6, h: 4, frames: 3 },
  poof: { w: 16, h: 16, frames: 4 },
  // P2 배경: 먼 배경은 게임 y 60, 가까운 배경은 y 74 에 그린다. 480px마다 이어 붙인다
  bg_far: { w: 480, h: 180, frames: 1 },
  bg_mid: { w: 480, h: 150, frames: 1 },
  bg_clouds: { w: 64, h: 16, frames: 3 },
};

let ctx = null;
export function useSpriteContext(context) { ctx = context; }

// 한 프레임을 (x, y) 왼쪽 위에 그린다. flip 이면 좌우 반전. 이미지가 없으면 false
export function drawFrame(key, frame, x, y, flip = false) {
  const image = imageFor(key), sheet = SHEETS[key];
  if (!image || !sheet) return false;
  const f = Math.max(0, Math.min(sheet.frames - 1, frame | 0));
  const dx = Math.round(x), dy = Math.round(y);
  if (flip) {
    ctx.save();
    ctx.translate(dx + sheet.w, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(image, f * sheet.w, 0, sheet.w, sheet.h, 0, 0, sheet.w, sheet.h);
    ctx.restore();
  } else {
    ctx.drawImage(image, f * sheet.w, 0, sheet.w, sheet.h, dx, dy, sheet.w, sheet.h);
  }
  return true;
}

// 9-slice: 모서리 corner px 는 그대로, 가운데와 변은 늘려서 w×h 로 그린다
export function drawNineSlice(key, x, y, w, h, corner) {
  const image = imageFor(key), sheet = SHEETS[key];
  if (!image || !sheet) return false;
  const c = corner, sw = sheet.w - c * 2, sh = sheet.h - c * 2, mw = w - c * 2, mh = h - c * 2;
  const cols = [[0, c, 0, c], [c, sw, c, mw], [c + sw, c, c + mw, c]];
  const rows = [[0, c, 0, c], [c, sh, c, mh], [c + sh, c, c + mh, c]];
  for (const [sx, sW, ox, dW] of cols) for (const [sy, sH, oy, dH] of rows) {
    if (dW > 0 && dH > 0) ctx.drawImage(image, sx, sy, sW, sH, Math.round(x) + ox, Math.round(y) + oy, dW, dH);
  }
  return true;
}
