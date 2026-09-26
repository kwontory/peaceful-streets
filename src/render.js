import { stage } from "./stage.js";
import { t } from "./locale.js";
import { createTextRenderer } from "./text.js";
import { settingsMenu } from "./settings-menu.js";
import { advanceCamera } from "./camera.js";
import { drawFrame, drawNineSlice, useSpriteContext } from "./sprites.js";
import { imageFor } from "./assets.js";
const hasImage = (key) => imageFor(key) !== null;
import {
  P, W, H, T, GROUND_Y, useContext, rect, panel, sprite,
  CAT, CAT_MAP, LEGS, FLOWER, FLOWER_MAP, CLOCK, CLOCK_MAP, AIR_PUFF, AIR_PUFF_MAP,
  drawSky, cloud, drawFar, drawMid, groundTile, platform, spikes, pit, lamp, goalFlag, pot,
} from "./art.js";

const DIM = "rgba(47,42,58,0.55)";
const BANNER_SLIDE = 0.25; // 시작 배너가 위로 빠지는 시간(초)

let drawText, textCtx;
let touchMode = false; // 터치 기기면 안내 문구를 터치용으로 바꾼다 (ui.touch)

// 이번 프레임에 그린 메뉴 항목의 위치 (게임 좌표). 터치로 메뉴를 직접 누를 때 main.js 가 쓴다.
export const menuHitboxes = [];

// 연출 전용 상태. 게임 규칙에는 영향을 주지 않는다.
// 방향·달리기·착지는 game 이 가진 값을 그대로 쓴다. 카메라는 화면 연출이라 여기서 계산한다.
const fx = {
  last: 0, time: 0, cam: null,
  wasGrounded: true,
  deaths: 0, blink: 0, elapsed: 0, collectedSeen: [], litSeen: [], tagBounce: [],
  airJumpSeen: 0, clouds: [],
  countPop: 0, // 꽃을 먹으면 HUD 숫자가 잠깐 튀어 오른다
  iris: null, // 화면 전환: { t, duration } 고양이 위치에서 원이 열린다
  lastPos: { x: 0, y: 0 },
  particles: [],
  effects: [], // 스프라이트 효과: { key, x, y, t, frameTime, frames }
};

// 스프라이트 효과 하나를 띄운다. 이미지가 없으면(null 반환) 부르는 쪽이 기존 점 효과를 쓴다
const EFFECTS = { poof: [4, 0.07], flower_collect: [4, 0.06], dust: [3, 0.08] };
function effect(key, x, y) {
  const [frames, frameTime] = EFFECTS[key];
  const item = { key, x, y, t: 0, frameTime, frames };
  fx.effects.push(item);
  return item;
}

// 지형을 16px 타일 격자로 바꿔 둔다. 외곽선은 빈 칸과 맞닿은 변에만 그린다
// (사각형마다 외곽선을 그리면 계단 블록의 옆선이 땅속까지 이어진다).
const COLS = Math.ceil(stage.width / T), ROWS = Math.ceil(H / T);
const GROUND_ROW = GROUND_Y / T;
const filled = new Set();
for (const solid of stage.solids) {
  for (let y = solid.y; y < Math.min(H, solid.y + solid.height); y += T) {
    for (let x = solid.x; x < solid.x + solid.width; x += T) filled.add(`${x / T},${y / T}`);
  }
}
const isFilled = (c, r) => r < ROWS && filled.has(`${c},${r}`);

function puff(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    fx.particles.push({ x, y, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 60 - 10, life: 0.35 + Math.random() * 0.25, color });
  }
}

// 게임 상태 변화를 보고 연출(먼지, 깜빡임, 착지)을 만든다
function watch(game, ui, dt) {
  const p = game.player;
  const restarted = game.elapsed < fx.elapsed;
  fx.elapsed = game.elapsed;
  if (restarted) {
    fx.particles = [];
    fx.deaths = game.deaths;
    fx.collectedSeen = [];
    fx.litSeen = [];
    fx.tagBounce = [];
    fx.clouds = [];
    fx.effects = [];
    fx.cam = null;
    fx.iris = { t: 0, duration: 0.55 };
  }
  if (game.deaths > fx.deaths) {
    fx.deaths = game.deaths;
    fx.cam = null;
    if (hasImage("poof")) effect("poof", fx.lastPos.x + 5 - 8, Math.min(fx.lastPos.y + 7, H - 8) - 8);
    else {
      puff(fx.lastPos.x + 5, Math.min(fx.lastPos.y + 7, H - 8), P.cream, 10);
      puff(fx.lastPos.x + 5, Math.min(fx.lastPos.y + 7, H - 8), P.catOrange, 6);
    }
    fx.blink = 0.5;
    fx.iris = { t: 0, duration: 0.4 };
    puff(p.x + 5, p.y + 10, P.cream, 6);
  }
  game.flowersCollected.forEach((got, i) => {
    if (!got || fx.collectedSeen[i]) return;
    const f = stage.flowers[i];
    if (hasImage("flower_collect")) effect("flower_collect", f.x + 4 - 7, f.y + 4 - 7);
    else puff(f.x + 4, f.y + 4, P.flowerPetal, 6);
    fx.countPop = 0.25;
  });
  fx.collectedSeen = [...game.flowersCollected];
  game.checkpointsActive.forEach((on, i) => {
    if (on && !fx.litSeen[i]) { fx.tagBounce[i] = 0.4; puff(stage.checkpoints[i].x + 8, stage.checkpoints[i].y + 8, P.lampOn, 8); }
  });
  fx.litSeen = [...game.checkpointsActive];
  fx.tagBounce = fx.tagBounce.map((v) => Math.max(0, v - dt));

  if (ui.screen !== "play") return;
  // 2단 점프: 발밑에 구름을 남기고 흰 조각이 퍼진다
  if (game.airJumpTime > fx.airJumpSeen + 0.05) {
    fx.clouds.push({ x: p.x + 5, y: p.y + p.height, life: 0.3 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      fx.particles.push({ x: p.x + 5, y: p.y + p.height, vx: Math.cos(a) * 60, vy: Math.sin(a) * 30 + 10, life: 0.3, color: P.cloud });
    }
  }
  fx.airJumpSeen = game.airJumpTime ?? 0;
  for (const c of fx.clouds) c.life -= dt;
  fx.clouds = fx.clouds.filter((c) => c.life > 0);
  // 착지·도약·달리기 먼지: 먼지 스프라이트가 있으면 그것을, 없으면 점 효과
  const dust = (x, count) => hasImage("dust") ? effect("dust", x - 3, p.y + p.height - 4) : puff(x, p.y + p.height, P.cream, count);
  if (game.grounded && !fx.wasGrounded) dust(p.x + 5, 4);
  if (!game.grounded && fx.wasGrounded && p.vy < 0) dust(p.x + 5, 3);
  fx.wasGrounded = game.grounded;
  fx.blink = Math.max(0, fx.blink - dt);
  if (game.grounded && Math.abs(p.vx) > 100 && Math.random() < (hasImage("dust") ? 0.04 : 0.08)) dust(p.x + 5 - p.face * 4, 1);
  for (const q of fx.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 200 * dt; q.life -= dt; }
  fx.particles = fx.particles.filter((q) => q.life > 0);
  for (const e of fx.effects) e.t += dt;
  fx.effects = fx.effects.filter((e) => e.t < e.frames * e.frameTime);
  fx.lastPos = { x: p.x, y: p.y };
}

// 카메라 계산은 그림과 분리한다. fx.cam = null이면 시작·부활 위치에 바로 맞춘다.
function updateCamera(game, moving, dt) {
  return advanceCamera(fx, game.player, stage.width, W, dt, moving);
}

// 픽셀 원 전환: 원 바깥을 레터박스 색으로 덮는다. 가장자리를 2px 줄 단위로 끊어 픽셀아트처럼
const IRIS_COLOR = "#2f2a3a";
function drawIris(cx, cy) {
  const iris = fx.iris;
  if (!iris) return;
  const k = Math.min(1, iris.t / iris.duration);
  const eased = 1 - (1 - k) ** 3;
  const radius = Math.round(eased * Math.hypot(W, H) / 2 / 2) * 2 + (k < 1 ? 6 : 0);
  for (let y = 0; y < H; y += 2) {
    const dy = y + 1 - cy;
    if (Math.abs(dy) >= radius) { rect(0, y, W, 2, IRIS_COLOR); continue; }
    const half = Math.floor(Math.sqrt(radius * radius - dy * dy) / 2) * 2;
    rect(0, y, Math.max(0, cx - half), 2, IRIS_COLOR);
    rect(cx + half, y, Math.max(0, W - cx - half), 2, IRIS_COLOR);
  }
}

function drawParallax(camera) {
  drawSky();
  const layer = (factor, draw) => {
    const offset = Math.round(camera * factor) % W;
    ctxRef.save();
    ctxRef.translate(-offset, 0); draw();
    ctxRef.translate(W, 0); draw();
    ctxRef.restore();
  };
  // 배경 이미지가 있으면 이미지로, 없으면 코드 그림으로. 구름은 64×16 칸 가운데에 그려져 있다
  const clouds = [[40, 30, 48], [210, 50, 36], [360, 24, 56]];
  layer(0.1, () => clouds.forEach(([x, y, w], i) => { if (!drawFrame("bg_clouds", i, x - (64 - w) / 2, y - 4)) cloud(x, y, w); }));
  layer(0.25, () => { if (!drawFrame("bg_far", 0, 0, 60)) drawFar(); });
  layer(0.5, () => { if (!drawFrame("bg_mid", 0, 0, 74)) drawMid(); });
}

// 지면 타일 한 칸 (스프라이트). 시트 순서: 윗면 왼·가운데·오른, 속 왼·가운데·오른.
// 이미지의 첫 줄이 외곽선이라 1px 위에 그려 기존 높이(외곽선 y-1, 풀 y)와 맞춘다.
function groundSprite(c, r, x, y, top, left, right) {
  const col = left ? 0 : right ? 2 : 1;
  if (col === 1 && (c * 7 + r * 13) % 5 === 0) return drawFrame("ground_variants", (top ? 0 : 2) + ((c + r) % 2), x, y - 1);
  return drawFrame("ground", (top ? 0 : 3) + col, x, y - 1);
}

function drawTerrain(camera) {
  const c0 = Math.max(0, Math.floor(camera / T)), c1 = Math.min(COLS - 1, Math.floor((camera + W) / T));
  for (let c = c0; c <= c1; c++) if (!isFilled(c, GROUND_ROW)) pit(c, 1, GROUND_Y);
  if (hasImage("ground")) {
    for (let c = c0; c <= c1; c++) for (let r = 0; r < ROWS; r++) {
      if (isFilled(c, r)) groundSprite(c, r, c * T, r * T, !isFilled(c, r - 1), c > 0 && !isFilled(c - 1, r), c < COLS - 1 && !isFilled(c + 1, r));
    }
    return;
  }
  for (let c = c0; c <= c1; c++) for (let r = 0; r < ROWS; r++) {
    if (isFilled(c, r)) groundTile(c * T, r * T, !isFilled(c, r - 1));
  }
  for (let c = c0; c <= c1; c++) for (let r = 0; r < ROWS; r++) {
    if (!isFilled(c, r)) continue;
    const x = c * T, y = r * T;
    if (!isFilled(c, r - 1)) rect(x, y - 1, T, 1, P.outline);
    if (c > 0 && !isFilled(c - 1, r)) rect(x - 1, y, 1, T, P.outline);
    if (c < COLS - 1 && !isFilled(c + 1, r)) rect(x + T, y, 1, T, P.outline);
  }
}

// 체크포인트 이름표: 가로등 위에 늘 떠 있다. 켜지면 노랗게 바뀌며 한 번 튄다.
function checkpointTag(cx, lampTop, on, bounce) {
  const label = t("checkpoint.label");
  const w = drawText(label, -1000, -1000, { small: true }) + 10;
  const hop = bounce > 0 ? -Math.round(Math.sin((1 - bounce / 0.4) * Math.PI) * 5) : 0;
  const bob = Math.floor(fx.time * 2) % 2;
  const y = lampTop - 22 + bob + hop;
  const x = Math.round(cx - w / 2);
  panel(x, y, w, 15, on ? P.focus : P.cream, on ? P.lampOn : P.panelShade);
  drawText(label, cx, y + 1, { small: true, align: "center" });
  // 아래를 가리키는 꼬리
  rect(cx - 3, y + 15, 7, 1, P.outline);
  rect(cx - 2, y + 14, 5, 2, on ? P.focus : P.cream);
  rect(cx - 2, y + 16, 5, 1, P.outline);
  rect(cx - 1, y + 16, 3, 1, on ? P.focus : P.cream);
  rect(cx, y + 17, 1, 1, P.outline);
}

function sign(x) {
  const lines = (touchMode ? ["touch.tutorialMove", "touch.tutorialJump", "tutorial.doubleJump"] : ["tutorial.move", "tutorial.jump", "tutorial.doubleJump"]).map(t);
  const w = Math.max(64, ...lines.map((line) => drawText(line, -1000, -1000, { small: true }) + 12));
  // 왼쪽 끝은 고정하고 글자 폭만큼 오른쪽으로 늘린다 (화면 밖으로 잘리지 않게)
  const cx = x - 4 + Math.round(w / 2);
  if (!drawFrame("sign_post", 0, cx - 1, GROUND_Y - 12)) rect(cx - 1, GROUND_Y - 12, 3, 12, P.woodDark);
  if (!drawNineSlice("sign_board", x - 4, GROUND_Y - 54, w, 44, 8)) panel(x - 4, GROUND_Y - 54, w, 44, P.panel, P.panelShade);
  lines.forEach((line, i) => drawText(line, cx, GROUND_Y - 51 + i * 13, { small: true, align: "center", color: i === 2 ? P.midFrame : P.outline }));
}

// 고양이 스프라이트: 상태에 맞는 동작과 프레임. (x, y) 는 충돌 상자 왼쪽, 발바닥 높이
function drawCatSprite(x, y, { grounded, running, facing, landed, vy, spinTime }) {
  const left = Math.round(x) - 3, top = Math.round(y) - 16, flip = facing < 0;
  if (spinTime > 0.1) return drawFrame("cat_spin", Math.floor((0.3 - spinTime) / 0.05), left, top, flip);
  if (landed > 0) return drawFrame("cat_land", 0, left, top, flip);
  if (!grounded) return drawFrame("cat_jump", vy < 0 ? 0 : 1, left, top, flip);
  if (running > 0) return drawFrame("cat_run", Math.floor(running / 0.09) % 4, left, top, flip);
  return drawFrame("cat_idle", Math.floor(fx.time / 0.6) % 2, left, top, flip);
}

function drawCat(x, y, { grounded = true, running = 0, facing = 1, landed = 0, vy = 0, spinTime = 0 } = {}) {
  if (drawCatSprite(x, y, { grounded, running, facing, landed, vy, spinTime })) return;
  // 이미지가 없을 때: 코드 그림 (2단 점프 회전은 좌우 뒤집기로 흉내 낸다)
  if (spinTime > 0.1 && Math.floor((0.3 - spinTime) / 0.05) % 2) facing = -facing;
  let legs = LEGS.stand, bob = 0;
  if (!grounded) legs = LEGS.jump;
  else if (running > 0) {
    const frame = Math.floor(running * 10) % 2;
    legs = frame ? LEGS.run1 : LEGS.run2;
    bob = frame ? 0 : -1;
  }
  const rows = CAT.slice(0, 14).concat(legs);
  const sx = Math.round(x) - 3, sy = Math.round(y) - 16 + bob;
  // 착지 찌그러짐: 머리 한 줄을 빼고 한 칸 아래로
  if (landed > 0) sprite(rows.slice(0, 5).concat(rows.slice(6)), CAT_MAP, sx, sy + 1, facing < 0);
  else sprite(rows, CAT_MAP, sx, sy, facing < 0);
}

// 보너스 꽃 둘레의 반짝임: 두 점이 번갈아 십자로 빛난다
function sparkle(cx, cy) {
  const phase = Math.floor(fx.time * 4) % 4;
  const spots = [[-8, -6], [7, -3], [-6, 6], [8, 5]];
  for (const [i, [dx, dy]] of spots.entries()) {
    if (i % 2 !== phase % 2) continue;
    const big = phase >= 2;
    rect(cx + dx, cy + dy, 1, 1, P.cloud);
    if (big) { rect(cx + dx - 1, cy + dy, 3, 1, P.flowerCenter); rect(cx + dx, cy + dy - 1, 1, 3, P.flowerCenter); rect(cx + dx, cy + dy, 1, 1, P.cloud); }
  }
}

// 가로등: 켜지면 뒤에 빛. 스프라이트 맨 아래 줄이 바닥에 닿게 그린다 (왼쪽 위 = x-12, 바닥-50)
function drawLamp(x, groundY, on) {
  if (!hasImage("checkpoint_lamp")) return lamp(x, groundY, on);
  if (on) drawFrame("checkpoint_lamp_glow", 0, x + 4 - 16, groundY - 38 - 16);
  drawFrame("checkpoint_lamp", on ? 1 : 0, x - 12, groundY - 50);
}
// 식인식물 화분: 닫힘 350ms → 반쯤 175ms → 벌림 350ms. 그림은 오른쪽을 보므로 왼쪽으로 갈 때 뒤집는다
function drawPot(x, y, dir) {
  if (!hasImage("chomper_pot")) return pot(x, y, dir, Math.floor(fx.time / 0.35) % 2 === 0);
  const cycle = fx.time % 0.875;
  drawFrame("chomper_pot", cycle < 0.35 ? 0 : cycle < 0.525 ? 1 : 2, x - 2, y - 22, dir < 0);
  // 이동 표시: 진행 방향 반대쪽에 선
  const lx = dir < 0 ? x + 20 : x - 14;
  rect(lx, y + 4, 6, 1, P.outline); rect(lx + (dir < 0 ? 2 : -2), y + 8, 8, 1, P.outline); rect(lx, y + 12, 5, 1, P.outline);
}

function drawWorld(game, camera) {
  drawParallax(camera);
  ctxRef.save();
  ctxRef.translate(-camera, 0);
  sign(stage.signX);
  stage.checkpoints.forEach((cp, i) => {
    drawLamp(cp.x + 4, cp.y + cp.height, game.checkpointsActive[i]);
    checkpointTag(cp.x + 8, cp.y + cp.height - 47, game.checkpointsActive[i], fx.tagBounce[i] ?? 0);
  });
  drawTerrain(camera);
  for (const ledge of stage.platforms) {
    const n = ledge.width / T;
    if (!hasImage("platform")) { platform(ledge.x / T, ledge.y / T, n); continue; }
    for (let i = 0; i < n; i++) drawFrame("platform", i === 0 ? 0 : i === n - 1 ? 2 : 1, ledge.x + i * T, ledge.y - 1);
  }
  // 가시는 그림 위치(spikeRows, 타일 단위)로 그린다. hazards 는 그보다 2px 작은 판정 상자다.
  for (const [column, count] of stage.spikeRows) for (let i = 0; i < count; i++) {
    const x = (column + i) * T;
    if (!drawFrame("spikes", 0, x, GROUND_Y - 9)) spikes(x, GROUND_Y - 8);
  }
  const flagX = stage.goal.x + 2, flagGround = stage.goal.y + stage.goal.height;
  if (!drawFrame("goal_flag", Math.floor(fx.time / 0.15) % 3, flagX - 1, flagGround - 50)) goalFlag(flagX, flagGround);
  stage.flowers.forEach((f, i) => {
    if (game.flowersCollected[i]) return;
    const fy = f.y + (Math.floor(fx.time * 2 + f.x / T) % 2);
    if (!drawFrame("flower", 0, f.x, fy)) sprite(FLOWER, FLOWER_MAP, f.x, fy);
    if (f.bonus) sparkle(f.x + 4, f.y + 4); // 2단 점프 보너스 꽃은 반짝여 눈에 띄게
  });
  drawPot(Math.round(game.pot.x), stage.pot.y, game.pot.dir);

  const p = game.player;
  const hidden = fx.blink > 0 && Math.floor(fx.blink * 12) % 2;
  for (const c of fx.clouds) {
    const cx = Math.round(c.x - 6), cy = Math.round(c.y - 1 + (0.3 - c.life) * 10);
    if (drawFrame("air_puff", Math.min(2, Math.floor((0.3 - c.life) / 0.1)), cx, cy)) continue;
    if (c.life < 0.1 && Math.floor(c.life * 40) % 2) continue;
    sprite(AIR_PUFF, AIR_PUFF_MAP, cx, cy);
  }
  if (!hidden) drawCat(p.x, p.y + p.height, { grounded: game.grounded, running: p.runTime, facing: p.face, landed: p.landedTime, vy: p.vy, spinTime: game.airJumpTime ?? 0 });
  for (const e of fx.effects) drawFrame(e.key, Math.floor(e.t / e.frameTime), e.x, e.y);
  for (const q of fx.particles) {
    const size = q.life > 0.2 ? 2 : 1;
    rect(Math.round(q.x), Math.round(q.y), size, size, q.color);
  }

  ctxRef.restore();
}

function drawTitleScene() {
  drawParallax(0);
  if (hasImage("ground")) {
    for (let c = 0; c < W / T; c++) for (let r = GROUND_ROW; r < ROWS; r++) groundSprite(c, r, c * T, r * T, r === GROUND_ROW, false, false);
  } else {
    for (let x = 0; x < W; x += T) groundTile(x, GROUND_Y, true), groundTile(x, GROUND_Y + T, false), groundTile(x, GROUND_Y + 2 * T, false);
    rect(0, GROUND_Y - 1, W, 1, P.outline);
  }
  drawLamp(W / 2 - 64, GROUND_Y, true);
  drawCat(W / 2 - 3, GROUND_Y, { facing: 1 });
}

const formatTime = (seconds) => {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

function hud(game, showName) {
  const name = `${stage.number}  ${t(stage.nameKey)}`;
  // 꽃: 모은 개수 / 스테이지 전체. 다 모으면 노랗게 바뀌고 반짝인다
  const got = game.flowersCollected.filter(Boolean).length, total = stage.flowers.length;
  const count = `${got} / ${total}`;
  const complete = got === total;
  fx.countPop = Math.max(0, fx.countPop - 1 / 60);
  const hop = fx.countPop > 0 ? -Math.round(Math.sin((1 - fx.countPop / 0.25) * Math.PI) * 3) : 0;
  const time = formatTime(game.elapsed);
  const light = { color: P.cream, outline: P.outline };
  if (showName) drawText(name, 8, 6, light);
  let x = W - 8;
  x -= drawText(time, x, 6, { ...light, align: "right" });
  sprite(CLOCK, CLOCK_MAP, x - 13, 8);
  x -= 13 + 10;
  x -= drawText(count, x, 6 + hop, { color: complete ? P.focus : P.cream, outline: P.outline, align: "right" });
  sprite(FLOWER, FLOWER_MAP, x - 12, 8 + hop);
  if (complete) sparkle(x - 8, 12);
}

function menu(keys, selected, y, gap = 22) {
  const bump = Math.floor(fx.time * 3) % 2;
  keys.forEach((key, index) => {
    const label = t(key);
    const top = y + index * gap;
    const labelWidth = drawText(label, -1000, -1000);
    menuHitboxes.push({ index, x: W / 2 - labelWidth / 2 - 20, y: top - 2, width: labelWidth + 40, height: gap }); // 항목끼리 겹치지 않게 간격만큼
    if (index === selected) {
      const width = drawText(label, -1000, -1000);
      rect(W / 2 - width / 2 - 6, top - 1, width + 12, 16, P.focus);
      drawText("▶", W / 2 - width / 2 - 16 + bump, top);
    }
    drawText(label, W / 2, top, { align: "center" });
  });
}

function banner(ui) {
  const slide = ui.screen === "banner" && ui.bannerTime < BANNER_SLIDE ? (BANNER_SLIDE - ui.bannerTime) / BANNER_SLIDE : 0;
  const y = Math.round(92 - slide * 140);
  panel(W / 2 - 90, y, 180, 48);
  drawText(stage.number, W / 2, y + 6, { small: true, align: "center", color: P.midFrame });
  drawText(t(stage.nameKey), W / 2, y + 18, { bold: true, scale: 2, align: "center" });
}

function clearScreen(game, ui) {
  rect(0, 0, W, H, DIM);
  drawText(t("clear.title"), W / 2, 44, { bold: true, color: P.focus, outline: P.outline, scale: 2, align: "center" });
  const got = game.flowersCollected.filter(Boolean).length;
  const complete = got === stage.flowers.length;
  const shift = complete ? 16 : 0; // 전부 모았으면 배지 한 줄만큼 아래로
  panel(W / 2 - 80, 84, 160, 130 + shift);
  const row = (icon, map, label, value, y) => {
    sprite(icon, map, W / 2 - 62, y + 3);
    drawText(t(label), W / 2 - 48, y);
    drawText(value, W / 2 + 62, y, { align: "right" });
  };
  row(CLOCK, CLOCK_MAP, "clear.time", formatTime(game.elapsed), 96);
  row(FLOWER, FLOWER_MAP, "clear.flowers", `${got} / ${stage.flowers.length}`, 114);
  if (complete) {
    const label = t("clear.allFlowers");
    const w = drawText(label, -1000, -1000, { small: true }) + 12;
    panel(Math.round(W / 2 - w / 2), 130, w, 15, P.focus, P.lampOn);
    drawText(label, W / 2, 131, { small: true, align: "center" });
    sparkle(Math.round(W / 2 - w / 2) - 2, 137);
    sparkle(Math.round(W / 2 + w / 2) + 2, 137);
  }
  rect(W / 2 - 62, 134 + shift, 124, 1, P.panelShade);
  menu(["clear.retry", "pause.toTitle"], ui.selection, 144 + shift, 20);
  drawText(t("clear.nextUnavailable"), W / 2, 190 + shift, { small: true, align: "center", color: P.midFrame });
}

// ── 타이틀 로고 ──────────────────────────────────────────
// 단어마다 색을 바꾸고(크림 → 꽃 분홍), 한 칸(3px) 아래에 진한 그림자, 양 끝에 2배 꽃
const LOGO_COLORS = [P.cream, P.flowerPetal];
function spriteScaled(rows, map, x, y, k) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (map[ch]) rect(x + i * k, y + j * k, k, k, map[ch]); }));
}
function titleLogo(y) {
  const words = t("game.title").split(" ");
  const style = { bold: true, outline: P.outline, scale: 3 };
  const space = 12;
  const widths = words.map((word) => drawText(word, -1000, -1000, style));
  const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
  let x = Math.round(W / 2 - total / 2);
  words.forEach((word, i) => {
    drawText(word, x, y + 3, { ...style, color: P.outline });
    drawText(word, x, y, { ...style, color: LOGO_COLORS[i % LOGO_COLORS.length] });
    x += widths[i] + space;
  });
  const bob = Math.floor(fx.time * 2) % 2;
  const left = Math.round(W / 2 - total / 2) - 26, right = Math.round(W / 2 + total / 2) + 8;
  spriteScaled(FLOWER, FLOWER_MAP, left, y + 14 + bob, 2);
  spriteScaled(FLOWER, FLOWER_MAP, right, y + 14 + (1 - bob), 2);
}

// ── 설정 화면 ────────────────────────────────────────────
// 조작 안내는 키 모양(키캡) + 설명, 소리는 스위치. 항목 순서는 settingsMenu() 를 따른다.
const SPEAKER = ['...o....', '..oo.o..', 'oooo..o.', 'oooo..o.', 'oooo..o.', '..oo.o..', '...o....'];
const SPEAKER_OFF = ['...o....', '..oo....', 'oooo.o.o', 'oooo..o.', 'oooo.o.o', '..oo....', '...o....'];
const ICON_MAP = { o: P.outline };

function keycap(x, y, label) {
  const w = drawText(label, -1000, -1000, { small: true }) + 8;
  panel(x, y, w, 14, P.panel, P.panelShade);
  drawText(label, x + w / 2, y, { small: true, align: "center" });
  return w;
}
// 키캡과 설명을 이어 붙인 한 줄. items: [["키", "키"], "설명"] 의 배열
function guideRow(x, y, groups) {
  for (const [keys, label] of groups) {
    for (const key of keys) x += keycap(x, y, key) + 2;
    x += 3 + drawText(label, x + 3, y + 1, { small: true });
    x += 14;
  }
}
function toggle(x, y, on) {
  rect(x + 1, y, 24, 12, P.outline);
  rect(x, y + 1, 26, 10, P.outline);
  rect(x + 1, y + 1, 24, 10, on ? P.flag : "#cbc4d4");
  const kx = on ? x + 14 : x + 2;
  rect(kx, y + 2, 10, 8, P.outline);
  rect(kx + 1, y + 2, 8, 7, P.cream);
}

// 두세 개 중 하나를 고르는 칸 (오른쪽 끝 기준). 고른 칸은 민트, 나머지는 크림
function segmented(right, y, labels, chosen) {
  const widths = labels.map((label) => drawText(label, -1000, -1000, { small: true }) + 10);
  let x = right - widths.reduce((a, b) => a + b, 0) - (labels.length - 1);
  rect(x - 1, y, right - x + 2, 14, P.outline);
  labels.forEach((label, i) => {
    rect(x, y + 1, widths[i], 12, i === chosen ? P.flag : P.cream);
    drawText(label, x + widths[i] / 2, y, { small: true, align: "center", color: i === chosen ? P.outline : P.midFrame });
    x += widths[i] + 1;
  });
}

function settingsScreen(ui) {
  rect(0, 0, W, H, DIM);
  const px = W / 2 - 150, pw = 300;
  panel(px, 43, pw, 204);
  drawText(t("settings.title"), W / 2, 50, { bold: true, align: "center" });
  rect(px + 20, 69, pw - 40, 1, P.panelShade);

  // 조작 안내
  const left = px + 16;
  drawText(t("settings.controls"), left, 74, { small: true, color: P.midFrame });
  const jumpKey = touchMode ? t("touch.jumpButton") : "Space";
  guideRow(left, 90, [[touchMode ? ["◀", "▶"] : ["←", "→"], t("settings.guideMove")], [[jumpKey], t("settings.guideJump")]]);
  guideRow(left, 107, [[[jumpKey, jumpKey], t("settings.guideDouble")]]);
  guideRow(left, 124, touchMode
    ? [[["Ⅱ"], t("settings.guidePause")], [["♪"], t("settings.guideMute")]]
    : [[["Esc"], t("settings.guidePause")], [["M"], t("settings.guideMute")], [["R"], t("settings.guideRestart")]]);
  rect(px + 20, 145, pw - 40, 1, P.panelShade);

  // 선택 항목의 순서는 main.js와 같은 settingsMenu를 따른다.
  const items = settingsMenu(ui.soundEnabled, ui.compact).map((item) => item.action);
  const bump = Math.floor(fx.time * 3) % 2;
  items.forEach((action, index) => {
    const selected = index === ui.selection;
    if (action === "sound") {
      const y = 153, x = px + 20, w = pw - 40;
      menuHitboxes.push({ index, x, y: y - 3, width: w, height: 20 });
      if (selected) { rect(x, y - 2, w, 17, P.focus); drawText("▶", x - 12 + bump, y); }
      sprite(ui.soundEnabled ? SPEAKER : SPEAKER_OFF, ICON_MAP, x + 6, y + 3);
      drawText(t("settings.sound"), x + 22, y);
      const status = t(ui.soundEnabled ? "settings.on" : "settings.off");
      const tx = x + w - 34;
      toggle(tx, y + 1, ui.soundEnabled);
      drawText(status, tx - 6, y + 1, { small: true, align: "right" });
    } else if (action === "scale") {
      const y = 178, x = px + 20, w = pw - 40;
      menuHitboxes.push({ index, x, y: y - 3, width: w, height: 20 });
      if (selected) { rect(x, y - 2, w, 17, P.focus); drawText("▶", x - 12 + bump, y); }
      // 모니터 아이콘 (10×10)
      rect(x + 5, y + 2, 10, 7, P.outline);
      rect(x + 6, y + 3, 8, 5, P.cream);
      rect(x + 8, y + 9, 4, 1, P.outline);
      rect(x + 7, y + 10, 6, 1, P.outline);
      drawText(t("settings.scale"), x + 22, y);
      segmented(x + w - 6, y + 1, [t("settings.auto"), t("settings.small")], ui.compact ? 1 : 0);
    } else {
      const label = t("settings.back"), y = 207;
      const lw = drawText(label, -1000, -1000);
      menuHitboxes.push({ index, x: W / 2 - lw / 2 - 20, y: y - 3, width: lw + 40, height: 20 });
      if (selected) { rect(W / 2 - lw / 2 - 6, y - 1, lw + 12, 16, P.focus); drawText("▶", W / 2 - lw / 2 - 16 + bump, y); }
      drawText(label, W / 2, y, { align: "center" });
    }
  });
  drawText(t(touchMode ? "touch.menuHint" : "menu.hintSelect"), W / 2, 230, { small: true, align: "center", color: P.midFrame });
}

let ctxRef;
export function render(ctx, game, ui) {
  if (textCtx !== ctx) { drawText = createTextRenderer(ctx); textCtx = ctx; }
  ctxRef = ctx;
  useContext(ctx);
  useSpriteContext(ctx);
  touchMode = Boolean(ui.touch);
  if (fx.lastScreen === "title" && ui.screen === "banner") fx.iris = { t: 0, duration: 0.55 };
  fx.lastScreen = ui.screen;
  menuHitboxes.length = 0;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const now = performance.now() / 1000;
  const dt = fx.last ? Math.min(0.05, now - fx.last) : 0;
  fx.last = now;
  fx.time += dt;

  // 타이틀에서 연 설정은 타이틀 장면 위에 띄운다
  const overTitle = ui.screen === "title" || (ui.screen === "settings" && ui.settingsReturn === "title");
  if (overTitle) drawTitleScene();
  if (ui.screen === "title") {
    titleLogo(40);
    panel(W / 2 - 60, 110, 120, 50);
    menu(["menu.start", "menu.settings"], ui.selection, 119, 18);
    drawText(t(touchMode ? "touch.menuHint" : "menu.hintSelect"), W / 2, 252, { small: true, color: P.cream, outline: P.outline, align: "center" });
    return;
  }

  if (!overTitle) {
    watch(game, ui, dt);
    const camera = updateCamera(game, ui.screen === "play", dt);
    drawWorld(game, camera);
    if (fx.iris) {
      fx.iris.t += dt;
      drawIris(Math.round(game.player.x + 5 - camera), Math.round(game.player.y + 7));
      if (fx.iris.t >= fx.iris.duration) fx.iris = null;
    }
    hud(game, ui.screen !== "banner");
  }

  if (ui.screen === "banner") banner(ui);
  else if (ui.screen === "pause") {
    rect(0, 0, W, H, DIM);
    panel(W / 2 - 70, 64, 140, 132);
    drawText(t("pause.title"), W / 2, 72, { bold: true, align: "center" });
    rect(W / 2 - 50, 91, 100, 1, P.panelShade);
    menu(["pause.resume", "pause.restart", "pause.settings", "pause.toTitle"], ui.selection, 101);
  } else if (ui.screen === "settings") settingsScreen(ui);
  else if (ui.screen === "clear") clearScreen(game, ui);
}
