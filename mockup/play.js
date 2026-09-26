// Peaceful Streets — 플레이 화면 디자인 목업 (움직여 볼 수 있는 버전)
// 목적: 카메라 스크롤, 패럴랙스, 레이어 대비, HUD, 체크포인트 재시작 흐름을 실제로 움직이며 검토한다.
// 게임 코드가 아니다. 물리는 화면 검토용으로 단순하게 만들었고, 실제 구현은 src/ 가 담당한다.
// lib.js(팔레트·텍스트·스프라이트·배경 그리기)에 의존한다.

const cv = document.getElementById('screen');
ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

// 검토 도구에서 바꾸는 값 (play.html 이 갱신)
const review = window.PS_REVIEW || (window.PS_REVIEW = { view: 'normal', hud: 'A', grid: false, scale: 'auto' });

// ── 조작감 수치 (검토용 임시값) ─────────────────────────────
// src/game.js 의 movement 와 같은 값 (검토 페이지와 실제 게임의 조작감을 맞춘다)
const TUNE = {
  run: 155, accel: 1800, airAccel: 1100, friction: 2000,
  gravity: 950, jumpV: 350, jumpCutV: 140, maxFall: 420,
  coyote: 0.09, buffer: 0.1,
  airJumps: 1, airJumpV: 300, // 2단 점프
};

// ── 스테이지 1-1 (타일 단위) ────────────────────────────────
// 가르치는 순서: 이동 → 점프(작은 구덩이) → 가시 → 체크포인트 → 발판 → 굴러오는 화분 → 계단 → 도착
const COLS = 64, ROWS = 17, WORLD_W = COLS * T;
const GROUND_ROW = GROUND_Y / T; // 14
const LEVEL = {
  ground: [[0, 9], [12, 27], [32, 47], [50, 63]],     // 지면 열 범위
  blocks: [[16, 17, 1], [52, 53, 1], [54, 55, 2], [56, 57, 3]], // [시작열, 끝열, 높이]
  platforms: [[29, 11, 2], [41, 10, 3]],              // [열, 행, 폭] 위로만 올라서는 발판
  spikes: [[21, 2], [42, 2]],                         // [열, 개수] 지면 위
  lamps: [25, 46],                                    // 체크포인트 가로등 열
  flowers: [[16.5, 11], [20, 11], [21.5, 10], [23, 11], [29.5, 9], [30.5, 9], [36, 10], [38, 10],
    [41.5, 8], [42.5, 8], [43.5, 8], [52.5, 11], [54.5, 10], [56.5, 9], [58.5, 9]],
  bonusFlowers: [[6, 8], [13.5, 7]], // 2단 점프로만 닿는 보너스 꽃,
  pot: { from: 34, to: 39 },
  sign: 1, spawn: 3, goal: 60,
};

const solid = new Set();
for (const [a, b] of LEVEL.ground) for (let c = a; c <= b; c++) for (let r = GROUND_ROW; r < ROWS; r++) solid.add(c + ',' + r);
for (const [a, b, h] of LEVEL.blocks) for (let c = a; c <= b; c++) for (let r = GROUND_ROW - h; r < GROUND_ROW; r++) solid.add(c + ',' + r);
const isSolid = (c, r) => (c < 0 || c >= COLS) ? true : r >= ROWS ? false : solid.has(c + ',' + r);
const oneWay = (c, r) => LEVEL.platforms.some(([pc, pr, pw]) => r === pr && c >= pc && c < pc + pw);
const groundTopAt = (c) => { for (let r = 0; r < ROWS; r++) if (isSolid(c, r)) return r * T; return H + 100; };

// ── 상태 ──────────────────────────────────────────────────
let game;
function newGame() {
  game = {
    time: 0, clock: 0, paused: false, pauseSel: 0, clear: null,
    flowers: LEVEL.flowers.map(([c, r]) => ({ x: c * T + 3, y: r * T + 3, got: false }))
      .concat(LEVEL.bonusFlowers.map(([c, r]) => ({ x: c * T + 3, y: r * T + 3, got: false, bonus: true }))),
    lamps: LEVEL.lamps.map((c) => ({ c, x: c * T + 4, on: false })),
    checkpoint: { x: LEVEL.spawn * T + 3 },
    pot: { x: LEVEL.pot.to * T, dir: -1 },
    particles: [], popups: [], clouds: [],
    cam: 0, look: 0, dead: 0, blink: 0,
    p: null,
  };
  game.p = spawnPlayer(game.checkpoint.x);
  game.cam = clampCam(game.p.x - W * 0.3);
}
function spawnPlayer(x) {
  const c = Math.floor((x + 5) / T);
  return { x, y: groundTopAt(c) - 14, w: 10, h: 14, vx: 0, vy: 0, onGround: true, face: 1, coyote: 0, buffer: 0, run: 0, landed: 0, airJumps: TUNE.airJumps, spin: 0 };
}
const clampCam = (x) => Math.max(0, Math.min(WORLD_W - W, x));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// ── 입력 ──────────────────────────────────────────────────
const held = new Set();
const pressed = new Set();
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', Space: 'jump', KeyZ: 'jump',
  ArrowDown: 'down', KeyS: 'down', Escape: 'pause', Enter: 'ok', KeyR: 'restart' };
function press(k) { if (!held.has(k)) pressed.add(k); held.add(k); }
function release(k) { held.delete(k); }
addEventListener('keydown', (e) => {
  const k = KEYMAP[e.code];
  if (!k) return;
  // 검토 패널의 버튼에 포커스가 있을 때 Enter 는 버튼에 양보
  if (e.code === 'Enter' && e.target.closest && e.target.closest('button')) return;
  e.preventDefault();
  if (!e.repeat) press(k);
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) release(k); });
addEventListener('blur', () => held.clear());
window.PS_INPUT = { press, release }; // 터치 버튼용

// ── 갱신 ──────────────────────────────────────────────────
const DT = 1 / 60;
function update() {
  const g = game;
  if (pressed.has('restart')) { newGame(); pressed.clear(); return; }

  if (g.clear) {
    g.clear.t += DT;
    const p = g.p;
    // 도착 후 제자리 폴짝
    p.vy += TUNE.gravity * DT; p.y += p.vy * DT;
    const top = groundTopAt(Math.floor((p.x + 5) / T)) - p.h;
    if (p.y >= top) { p.y = top; p.vy = -180; }
    if (g.clear.t > 0.8 && (pressed.has('jump') || pressed.has('ok'))) newGame();
    tickFx();
    pressed.clear();
    return;
  }
  if (pressed.has('pause')) { g.paused = !g.paused; g.pauseSel = 0; }
  if (g.paused) {
    if (pressed.has('down')) g.pauseSel = (g.pauseSel + 1) % 4;
    if (pressed.has('up')) g.pauseSel = (g.pauseSel + 3) % 4;
    if (pressed.has('ok') || pressed.has('jump')) {
      if (g.pauseSel === 0) g.paused = false;
      else if (g.pauseSel === 1) { newGame(); }
    }
    pressed.clear();
    return;
  }

  g.time += DT;
  g.clock += DT;
  const p = g.p;

  if (g.dead > 0) {
    g.dead -= DT;
    if (g.dead <= 0) {
      g.p = spawnPlayer(g.checkpoint.x);
      g.blink = 0.7;
      puff(g.p.x + 5, g.p.y + 10, P.cream, 8);
    }
    tickFx();
    pressed.clear();
    return;
  }
  if (g.blink > 0) g.blink -= DT;

  // 수평 이동
  const dir = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
  if (dir) {
    p.face = dir;
    const a = p.onGround ? TUNE.accel : TUNE.airAccel;
    p.vx += dir * a * DT;
    p.vx = Math.max(-TUNE.run, Math.min(TUNE.run, p.vx));
  } else if (p.onGround) {
    const f = TUNE.friction * DT;
    p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
  }

  // 점프: 코요테 타임 + 입력 버퍼 + 짧게 누르면 낮게 (↑/W 도 점프)
  const jumpHeld = held.has('jump') || held.has('up');
  if (pressed.has('jump') || pressed.has('up')) p.buffer = TUNE.buffer;
  p.coyote = p.onGround ? TUNE.coyote : p.coyote - DT;
  p.buffer -= DT;
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -TUNE.jumpV; p.buffer = 0; p.coyote = 0; p.onGround = false;
    puff(p.x + 5, p.y + p.h, P.cream, 3);
  } else if ((pressed.has('jump') || pressed.has('up')) && !p.onGround && p.airJumps > 0) {
    // 2단 점프: 발밑 구름 + 한 바퀴
    p.vy = -TUNE.airJumpV; p.airJumps--; p.buffer = 0; p.spin = 0.3;
    g.clouds.push({ x: p.x + 5, y: p.y + p.h, life: 0.3 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.particles.push({ x: p.x + 5, y: p.y + p.h, vx: Math.cos(a) * 60, vy: Math.sin(a) * 30 + 10, life: 0.3, color: P.cloud });
    }
  }
  p.spin = Math.max(0, p.spin - DT);
  if (!jumpHeld && p.vy < -TUNE.jumpCutV) p.vy = -TUNE.jumpCutV;
  p.vy = Math.min(TUNE.maxFall, p.vy + TUNE.gravity * DT);

  // X 이동과 충돌
  p.x += p.vx * DT;
  const r0 = Math.floor(p.y / T), r1 = Math.floor((p.y + p.h - 1) / T);
  if (p.vx > 0) {
    const c = Math.floor((p.x + p.w) / T);
    for (let r = r0; r <= r1; r++) if (isSolid(c, r)) { p.x = c * T - p.w; p.vx = 0; break; }
  } else if (p.vx < 0) {
    const c = Math.floor(p.x / T);
    for (let r = r0; r <= r1; r++) if (isSolid(c, r)) { p.x = (c + 1) * T; p.vx = 0; break; }
  }
  // Y 이동과 충돌
  const wasGround = p.onGround;
  const prevBottom = p.y + p.h;
  p.y += p.vy * DT;
  p.onGround = false;
  const c0 = Math.floor(p.x / T), c1 = Math.floor((p.x + p.w - 1) / T);
  if (p.vy >= 0) {
    const r = Math.floor((p.y + p.h) / T);
    for (let c = c0; c <= c1; c++) {
      if (isSolid(c, r) || (oneWay(c, r) && prevBottom <= r * T + 1)) {
        p.y = r * T - p.h; p.vy = 0; p.onGround = true; break;
      }
    }
  } else {
    const r = Math.floor(p.y / T);
    for (let c = c0; c <= c1; c++) if (isSolid(c, r)) { p.y = (r + 1) * T; p.vy = 0; break; }
  }
  if (p.onGround && !wasGround) { p.landed = 0.12; puff(p.x + 5, p.y + p.h, P.cream, 4); }
  if (p.onGround) p.airJumps = TUNE.airJumps;
  if (p.landed > 0) p.landed -= DT;
  p.run = p.onGround && Math.abs(p.vx) > 10 ? p.run + DT : 0;
  if (p.onGround && Math.abs(p.vx) > 60 && Math.random() < 0.08) puff(p.x + 5 - p.face * 4, p.y + p.h, P.cream, 1);

  // 화분 왕복
  const pot = g.pot;
  pot.x += pot.dir * 36 * DT;
  if (pot.x < LEVEL.pot.from * T) { pot.x = LEVEL.pot.from * T; pot.dir = 1; }
  if (pot.x > LEVEL.pot.to * T) { pot.x = LEVEL.pot.to * T; pot.dir = -1; }

  // 충돌 판정
  const box = { x: p.x, y: p.y, w: p.w, h: p.h };
  let hurt = p.y > H + 24;
  for (const [c, n] of LEVEL.spikes) {
    const top = groundTopAt(c);
    if (overlap(box, { x: c * T + 2, y: top - 6, w: n * T - 4, h: 6 })) hurt = true;
  }
  if (overlap(box, { x: pot.x + 1, y: GROUND_Y - 14, w: 14, h: 14 })) hurt = true;
  if (hurt && g.blink <= 0) die();

  for (const f of g.flowers) {
    if (!f.got && overlap(box, { x: f.x, y: f.y, w: 9, h: 9 })) {
      f.got = true;
      puff(f.x + 4, f.y + 4, P.flowerPetal, 6);
    }
  }
  for (const l of g.lamps) {
    if (!l.on && overlap(box, { x: l.x - 4, y: GROUND_Y - 48, w: 16, h: 48 })) {
      g.lamps.forEach((o) => { if (o.c < l.c) o.on = true; });
      l.on = true;
      l.bounce = 0.4;
      g.checkpoint = { x: l.x - 1 };
      puff(l.x + 4, GROUND_Y - 40, P.lampOn, 8);
    }
  }
  if (overlap(box, { x: LEVEL.goal * T + 2, y: GROUND_Y - 48, w: 22, h: 48 })) {
    g.clear = { t: 0 };
    p.vx = 0;
    puff(LEVEL.goal * T + 12, GROUND_Y - 40, P.flag, 12);
  }

  // 카메라: 진행 방향을 조금 더 보여준다
  g.look += ((p.face * 40) - g.look) * 0.04;
  const target = clampCam(p.x + 5 - W / 2 + g.look);
  g.cam += (target - g.cam) * 0.12;

  tickFx();
  pressed.clear();
}
function die() {
  const g = game, p = g.p;
  g.dead = 0.45;
  puff(p.x + 5, Math.min(p.y + 7, H - 8), P.cream, 10);
  puff(p.x + 5, Math.min(p.y + 7, H - 8), P.catOrange, 6);
  p.hidden = true;
}
function puff(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    game.particles.push({ x, y, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 60 - 10, life: 0.35 + Math.random() * 0.25, color });
  }
}
// 보너스 꽃 반짝임 (src/render.js 와 같은 모양)
function sparkle(cx, cy) {
  const phase = Math.floor(game.time * 4) % 4;
  const spots = [[-8, -6], [7, -3], [-6, 6], [8, 5]];
  spots.forEach(([dx, dy], i) => {
    if (i % 2 !== phase % 2) return;
    rect(cx + dx, cy + dy, 1, 1, P.cloud);
    if (phase >= 2) { rect(cx + dx - 1, cy + dy, 3, 1, P.flowerCenter); rect(cx + dx, cy + dy - 1, 1, 3, P.flowerCenter); rect(cx + dx, cy + dy, 1, 1, P.cloud); }
  });
}

// 체크포인트 이름표 (src/render.js 와 같은 모양)
function checkpointTag(cx, lampTop, on, bounce) {
  const label = t('checkpoint.label');
  const small = { font: 'Galmuri9', size: 10 };
  const w = textSprite(label, small).width + 10;
  const hop = bounce > 0 ? -Math.round(Math.sin((1 - bounce / 0.4) * Math.PI) * 5) : 0;
  const y = lampTop - 22 + (Math.floor(game.time * 2) % 2) + hop;
  const x = Math.round(cx - w / 2);
  panel(x, y, w, 15, on ? P.focus : P.cream, on ? P.lampOn : P.panelShade);
  text(label, cx, y + 1, { ...small, align: 'center' });
  rect(cx - 3, y + 15, 7, 1, P.outline);
  rect(cx - 2, y + 14, 5, 2, on ? P.focus : P.cream);
  rect(cx - 2, y + 16, 5, 1, P.outline);
  rect(cx - 1, y + 16, 3, 1, on ? P.focus : P.cream);
  rect(cx, y + 17, 1, 1, P.outline);
}
function tickFx() {
  for (const l of game.lamps) if (l.bounce) l.bounce = Math.max(0, l.bounce - DT);
  for (const q of game.particles) { q.x += q.vx * DT; q.y += q.vy * DT; q.vy += 200 * DT; q.life -= DT; }
  game.particles = game.particles.filter((q) => q.life > 0);
  for (const u of game.popups) u.t += DT;
  for (const c of game.clouds) c.life -= DT;
  game.clouds = game.clouds.filter((c) => c.life > 0);
  game.popups = game.popups.filter((u) => u.t < 1.2);
}

// ── 그리기 ────────────────────────────────────────────────
function drawCat(p) {
  let legs = LEGS.stand, bob = 0;
  if (!p.onGround) legs = LEGS.jump;
  else if (p.run > 0) { const f = Math.floor(p.run * 10) % 2; legs = f ? LEGS.run1 : LEGS.run2; bob = f ? 0 : -1; }
  const rows = CAT.slice(0, 14).concat(legs);
  const sx = Math.round(p.x) - 3, sy = Math.round(p.y + p.h) - 16 + bob;
  if (p.landed > 0) {
    // 착지 찌그러짐: 머리 한 줄을 빼고 아래로 눌러 그린다
    sprite(rows.slice(0, 5).concat(rows.slice(6)), CAT_MAP, sx, sy + 1, p.face < 0);
  } else {
    const spin = p.spin > 0.1 ? (Math.floor((0.3 - p.spin) / 0.05) % 2 ? -1 : 1) : 1;
    sprite(rows, CAT_MAP, sx, sy, p.face * spin < 0);
  }
}

function drawTiles(cam) {
  const c0 = Math.max(0, Math.floor(cam / T)), c1 = Math.min(COLS - 1, Math.floor((cam + W) / T));
  // 구덩이 물
  for (let c = c0; c <= c1; c++) if (!isSolid(c, GROUND_ROW)) pit(c, 1, GROUND_Y);
  for (let c = c0; c <= c1; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (!isSolid(c, r)) continue;
      groundTile(c * T, r * T, !isSolid(c, r - 1));
    }
  }
  // 외곽선: 빈 칸과 맞닿은 변
  for (let c = c0; c <= c1; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (!isSolid(c, r)) continue;
      const x = c * T, y = r * T;
      if (!isSolid(c, r - 1)) rect(x, y - 1, T, 1, P.outline);
      if (c > 0 && !isSolid(c - 1, r)) rect(x - 1, y, 1, T, P.outline);
      if (c < COLS - 1 && !isSolid(c + 1, r)) rect(x + T, y, 1, T, P.outline);
    }
  }
}

function drawParallax(cam) {
  drawSky();
  const layer = (f, fn) => {
    const off = Math.round(cam * f) % W;
    ctx.save(); ctx.translate(-off, 0); fn(); ctx.translate(W, 0); fn(); ctx.restore();
  };
  layer(0.1, () => { cloud(40, 30, 48); cloud(210, 50, 36); cloud(360, 24, 56); });
  layer(0.25, drawFar);
  layer(0.5, drawMid);
}

function drawWorld() {
  const g = game, cam = Math.round(g.cam);
  if (review.view === 'play') rect(0, 0, W, H, '#e9e5ee');
  else drawParallax(g.cam);

  ctx.save();
  ctx.translate(-cam, 0);
  sign(LEVEL.sign * T, GROUND_Y);
  for (const l of g.lamps) { lamp(l.x, GROUND_Y, l.on); checkpointTag(l.x + 4, GROUND_Y - 47, l.on, l.bounce || 0); }
  drawTiles(cam);
  for (const [c, r, w] of LEVEL.platforms) platform(c, r, w);
  for (const [c, n] of LEVEL.spikes) spikeRow(c, n, groundTopAt(c));
  goalFlag(LEVEL.goal * T + 4, GROUND_Y);
  for (const f of g.flowers) {
    if (f.got) continue;
    sprite(FLOWER, FLOWER_MAP, f.x, f.y + (Math.floor(g.time * 2 + f.x) % 2));
    if (f.bonus) sparkle(f.x + 4, f.y + 4);
  }
  pot(Math.round(g.pot.x), GROUND_Y - 14, g.pot.dir, Math.floor(g.time / 0.35) % 2 === 0);

  const p = g.p;
  for (const c of g.clouds) {
    if (c.life < 0.1 && Math.floor(c.life * 40) % 2) continue;
    sprite(AIR_PUFF, AIR_PUFF_MAP, Math.round(c.x - 6), Math.round(c.y - 1 + (0.3 - c.life) * 10));
  }
  const visible = !(g.dead > 0) && !(g.blink > 0 && Math.floor(g.blink * 12) % 2);
  if (visible) drawCat(p);

  for (const q of g.particles) rect(Math.round(q.x), Math.round(q.y), q.life > 0.2 ? 2 : 1, q.life > 0.2 ? 2 : 1, q.color);
  for (const u of g.popups) {
    if (u.t > 1 && Math.floor(u.t * 20) % 2) continue;
    text(u.text, u.x, u.y - Math.min(8, Math.floor(u.t * 16)), { font: 'Galmuri9', size: 10, color: P.cream, outline: P.outline, align: 'center' });
  }
  ctx.restore();

  if (review.grid) {
    const off = cam % T;
    for (let x = -off; x < W; x += T) rect(x, 0, 1, H, 'rgba(61,43,51,0.2)');
    for (let y = 0; y < H; y += T) rect(0, y, W, 1, 'rgba(61,43,51,0.2)');
  }
}

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const BANNER = 2.4;

function drawHud() {
  const g = game;
  const got = g.flowers.filter((f) => f.got).length;
  const name = `1-1  ${t('stage.1-1.name')}`;
  const showName = g.time > BANNER + 0.25;
  if (review.hud === 'B') {
    // B: 작은 크림 패널 위 진한 글자
    const hudPanel = (x, w) => panel(x, 4, w, 18);
    if (showName) { const w = textSprite(name, {}).width + 12; hudPanel(6, w); text(name, 12, 6, {}); }
    const timeW = textSprite(fmtTime(g.clock), {}).width;
    const cntW = textSprite(`× ${got}`, {}).width;
    const w = 6 + 9 + 3 + cntW + 10 + 9 + 3 + timeW + 6;
    hudPanel(W - 6 - w, w);
    let x = W - 6 - w + 6;
    sprite(FLOWER, FLOWER_MAP, x, 8); x += 12;
    x += text(`× ${got}`, x, 6, {}) + 10;
    sprite(CLOCK, CLOCK_MAP, x, 8); x += 12;
    text(fmtTime(g.clock), x, 6, {});
  } else {
    // A: 배경 패널 없이 크림 글자 + 외곽선
    const o = { color: P.cream, outline: P.outline };
    if (showName) text(name, 8, 6, o);
    let x = W - 8;
    x -= text(fmtTime(g.clock), x, 6, { ...o, align: 'right' });
    sprite(CLOCK, CLOCK_MAP, x - 13, 8);
    x -= 13 + 10;
    x -= text(`× ${got}`, x, 6, { ...o, align: 'right' });
    sprite(FLOWER, FLOWER_MAP, x - 12, 8);
  }
}

function drawBanner() {
  const tt = game.time;
  if (tt > BANNER + 0.25) return;
  // 머무르다가 위로 빠르게 빠진다
  const y = tt < BANNER ? 92 : Math.round(92 - ((tt - BANNER) / 0.25) * 140);
  panel(W / 2 - 90, y, 180, 48, P.cream);
  text('1-1', W / 2, y + 6, { font: 'Galmuri9', size: 10, align: 'center', color: P.midFrame });
  text(t('stage.1-1.name'), W / 2, y + 18, { bold: true, align: 'center', scale: 2 });
}

function menu(items, cx, y, sel, gap) {
  items.forEach((label, i) => {
    const yy = y + i * gap;
    if (i === sel) {
      const w = textSprite(label, {}).width;
      rect(cx - w / 2 - 6, yy - 1, w + 12, 16, P.focus);
      text('▶', cx - w / 2 - 16 + (Math.floor(game.time * 3) % 2), yy, {});
    }
    text(label, cx, yy, { align: 'center' });
  });
}

function drawPause() {
  rect(0, 0, W, H, P.dim);
  panel(W / 2 - 70, 64, 140, 132);
  text(t('pause.title'), W / 2, 72, { bold: true, align: 'center' });
  rect(W / 2 - 50, 91, 100, 1, P.panelShade);
  menu([t('pause.resume'), t('pause.restart'), t('pause.settings'), t('pause.toTitle')], W / 2, 101, game.pauseSel, 22);
}

function drawClear() {
  const c = game.clear;
  if (c.t < 0.6) return;
  rect(0, 0, W, H, P.dim);
  text(t('clear.title'), W / 2, 44, { bold: true, color: P.focus, outline: P.outline, scale: 2, align: 'center' });
  panel(W / 2 - 80, 84, 160, 100);
  const got = game.flowers.filter((f) => f.got).length;
  const row = (label, value, y, icon) => {
    sprite(icon.rows, icon.map, W / 2 - 62, y + 3);
    text(label, W / 2 - 48, y, {});
    text(value, W / 2 + 62, y, { align: 'right' });
  };
  row(t('clear.time'), fmtTime(game.clock), 96, { rows: CLOCK, map: CLOCK_MAP });
  row(t('clear.flowers'), `${got} / ${game.flowers.length}`, 114, { rows: FLOWER, map: FLOWER_MAP });
  rect(W / 2 - 62, 134, 124, 1, P.panelShade);
  menu([t('clear.retry')], W / 2, 146, 0, 22);
  text(t('clear.nextUnavailable'), W / 2, 166, { font: 'Galmuri9', size: 10, align: 'center', color: P.midFrame });
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  drawWorld();
  drawHud();
  drawBanner();
  if (game.paused) drawPause();
  if (game.clear) drawClear();
  cv.style.filter = review.view === 'gray' ? 'grayscale(1)' : '';
}

// ── 화면 배율 ─────────────────────────────────────────────
function fit() {
  // 캔버스 자신의 크기에 끌려가지 않도록 바깥 .stage 폭을 기준으로 잰다
  const maxW = cv.closest('.stage').clientWidth, maxH = Math.max(270, innerHeight - 40);
  let s;
  if (review.scale === 'auto') {
    const raw = Math.min(maxW / W, maxH / H);
    s = raw >= 2 ? Math.floor(raw) : Math.max(0.5, raw);
  } else {
    s = Math.min(Number(review.scale), maxW / W); // 좁은 화면에서는 넘치지 않게
  }
  cv.style.width = Math.round(W * s) + 'px';
  cv.style.height = Math.round(H * s) + 'px';
  if (window.PS_ONSCALE) window.PS_ONSCALE(s);
}
addEventListener('resize', fit);
window.PS_FIT = fit;

// ── 시작 ──────────────────────────────────────────────────
let last = 0, acc = 0;
function frame(now) {
  acc = Math.min(acc + (last ? (now - last) / 1000 : 0), DT * 5);
  last = now;
  while (acc >= DT) { update(); acc -= DT; }
  render();
  requestAnimationFrame(frame);
}

(async () => {
  S = window.PS_STRINGS || await fetch('../locales/ko.json').then((r) => r.json());
  await Promise.all([
    document.fonts.load('400 12px Galmuri11'),
    document.fonts.load('700 12px Galmuri11'),
    document.fonts.load('10px Galmuri9'),
  ]);
  newGame();
  fit();
  requestAnimationFrame(frame);
  document.body.dataset.ready = '1';
})();
