// Peaceful Streets 목업 공용 코드: 팔레트, 픽셀 텍스트, 패널, 스프라이트.
// mockup.js(정적 화면)와 play.js(플레이 화면)가 함께 쓴다. 값은 docs/DESIGN.md 와 일치시킨다.
// 사용하는 쪽에서 ctx 와 S(문자열)를 채운다.

const W = 480, H = 270, T = 16;

// ── 팔레트 (docs/DESIGN.md 와 동일) ──────────────────────────
const P = {
  outline: '#3d2b33',
  cream: '#fff4e0', panel: '#fbe8c8', panelShade: '#e8c9a0',
  focus: '#ffcf4a', dim: 'rgba(47,42,58,0.55)',

  sky1: '#bfe6ff', sky2: '#d9f1ff', sky3: '#fde7d6', cloud: '#ffffff', puffEdge: '#d6e4f2',

  farWall: '#c6d3ea', farRoof: '#b3bfdc', farWin: '#dce6f5', hill: '#d3e4ee', hill2: '#c9dce9',

  midWall: '#f6d7c3', midWall2: '#fbe6d0', midRoof: '#e99a8b', midRoof2: '#8fb5d9',
  midWin: '#fff2c2', midFrame: '#c79a86', tree: '#a6d49a', treeDark: '#86bf7c',
  pole: '#b59c94', treeLight: '#c2e4b5',
  // 가까운 집 세부 (외곽선 없이, 밝고 채도 낮게)
  villa: '#ecdbe6', villaTop: '#dcc6d6', roofDark: '#d98576', roofDark2: '#78a0c8',
  shade: 'rgba(120,80,90,0.13)', door: '#d8ad96', tank: '#aacce8', tankDark: '#8fb5d9',
  ac: '#e6e2ec', awning: '#9fd6c7', signBoard: '#f3bfae', fence: '#ecd6c2', fenceCap: '#dcbca4',
  bgPot: '#e5b39b', bgFlower: '#f6b1c5', laundry1: '#ffe7a3', laundry2: '#c9e6f7', laundry3: '#f9c9d6',

  grass: '#8fd17a', grassDark: '#5fa865',
  brick: '#e0a276', brickDark: '#bf7a55', soil: '#8a5242',

  water: '#7cc4ee', waterLight: '#c4e8fb',

  hazard: '#e8433f', hazardDark: '#9c1c34', hazardLight: '#ffb3a3', // 흑백에서도 배경보다 확실히 어둡게
  pot: '#d4622f', potDark: '#9e3f22', leaf: '#5fa865', mouth: '#6b2536',

  catOrange: '#ffb35c', catStripe: '#e88a3a', catWhite: '#fff8ee', catPink: '#ff8fa3',
  flowerPetal: '#ff9ec4', flowerCenter: '#ffd84d',
  lampOff: '#8a8398', lampOn: '#ffe27a', lampGlow: 'rgba(255,226,122,0.35)',
  flag: '#7fd3b8', wood: '#c9895b', woodDark: '#9a6040',
};

let S = {}; // 문자열 (locales/ko.json)
const t = (k) => S[k] ?? k;

let ctx = null; // 사용하는 쪽에서 캔버스 2D 컨텍스트를 넣는다

// ── 기본 그리기 도구 ────────────────────────────────────────
const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); };

// 모서리 1px 깎은 둥근 패널 (9-slice 대용)
function panel(x, y, w, h, fill = P.cream, shade = P.panelShade) {
  rect(x + 2, y, w - 4, 1, P.outline);
  rect(x + 2, y + h - 1, w - 4, 1, P.outline);
  rect(x, y + 2, 1, h - 4, P.outline);
  rect(x + w - 1, y + 2, 1, h - 4, P.outline);
  rect(x + 1, y + 1, 1, 1, P.outline);
  rect(x + w - 2, y + 1, 1, 1, P.outline);
  rect(x + 1, y + h - 2, 1, 1, P.outline);
  rect(x + w - 2, y + h - 2, 1, 1, P.outline);
  rect(x + 2, y + 1, w - 4, h - 2, fill);
  rect(x + 1, y + 2, w - 2, h - 4, fill);
  rect(x + 2, y + h - 3, w - 4, 1, shade);
  rect(x + 1, y + h - 4, 1, 1, shade);
  rect(x + w - 2, y + h - 4, 1, 1, shade);
}

// 픽셀 폰트 텍스트: 오프스크린에 그린 뒤 알파를 이진화해 안티앨리어싱 제거,
// 외곽선은 마스크를 8방향으로 찍어서 만든다. scale 은 정수 확대.
const textCache = new Map();
function textSprite(str, { font = 'Galmuri11', size = 12, bold = false, color = P.outline, outline = null }) {
  const key = [str, font, size, bold, color, outline].join('|');
  if (textCache.has(key)) return textCache.get(key);
  // Galmuri 는 글리프 윗줄이 'top' 기준선보다 위에서 시작하므로 위쪽 여백 TOP 이 필요하다.
  // (여백이 없으면 ㄷ→ㄴ, ㅁ→ㅂ 처럼 첫 행이 잘린다)
  const TOP = 2;
  const pad = outline ? 1 : 0;
  const m = document.createElement('canvas').getContext('2d');
  const f = `${bold ? 700 : 400} ${size}px ${font}`;
  m.font = f;
  const w = Math.ceil(m.measureText(str).width) + pad * 2;
  const h = size + TOP + 2 + pad * 2;
  const mask = document.createElement('canvas');
  mask.width = w; mask.height = h;
  const mc = mask.getContext('2d');
  mc.font = f; mc.textBaseline = 'top'; mc.fillStyle = '#000';
  mc.fillText(str, pad, pad + TOP);
  const img = mc.getImageData(0, 0, w, h);
  const on = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) on[i] = img.data[i * 4 + 3] >= 128 ? 1 : 0;

  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const oc = out.getContext('2d');
  const od = oc.createImageData(w, h);
  const put = (i, hex) => {
    const n = parseInt(hex.slice(1), 16);
    od.data[i * 4] = n >> 16; od.data[i * 4 + 1] = (n >> 8) & 255; od.data[i * 4 + 2] = n & 255; od.data[i * 4 + 3] = 255;
  };
  if (outline) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (on[y * w + x]) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && on[ny * w + nx]) { near = true; break; }
      }
      if (near) put(y * w + x, outline);
    }
  }
  for (let i = 0; i < w * h; i++) if (on[i]) put(i, color);
  oc.putImageData(od, 0, 0);
  textCache.set(key, out);
  return out;
}
function text(str, x, y, opts = {}) {
  const s = textSprite(str, opts);
  const k = opts.scale || 1;
  let dx = x;
  if (opts.align === 'center') dx = x - (s.width * k) / 2;
  if (opts.align === 'right') dx = x - s.width * k;
  ctx.drawImage(s, dx | 0, y | 0, s.width * k, s.height * k);
  return s.width * k;
}

// 문자열 배열 스프라이트
function sprite(rows, map, x, y, flip = false) {
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      const c = map[ch];
      if (!c) return;
      rect(x + (flip ? row.length - 1 - i : i), y + j, 1, 1, c);
    });
  });
}

// ── 스프라이트 ─────────────────────────────────────────────
// 플레이어: 주황 줄무늬 고양이 (16×16, 임시 캐릭터). 기본은 오른쪽을 본다(꼬리가 왼쪽).
// 왼쪽으로 갈 때만 좌우 반전해 그린다.
const CAT = [
  '................',
  '.....o.......o..',
  '....oao.....oao.',
  '....oaao...oaao.',
  '...oaaaaoooaaao.',
  '..oaaabaaabaaaao',
  '..oaaaaaaaaaaaao',
  '..oaaakaaaakaaao',
  '..oaaakaaaakaaao',
  '..oppaaawwaappao',
  '...oaaawwwwaaao.',
  '.o..oooaaaaooo..',
  'oao..oawwwwao...',
  '.oaoooawwwwao...',
  '..oaaaaaaaaao...',
  '..oo.oo.oo.oo...',
];
const CAT_MAP = { o: P.outline, a: P.catOrange, b: P.catStripe, w: P.catWhite, k: P.outline, p: P.catPink };

// 다리 프레임: CAT 의 마지막 두 줄을 바꿔 끼운다 (CAT 과 같은 방향)
const LEGS = {
  stand: ['..oaaaaaaaaao...', '..oo.oo.oo.oo...'],
  run1: ['..oaaaaaaaaao...', '..oo...oo.oo....'],
  run2: ['..oaaaaaaaaao...', '....oo.oo...oo..'],
  jump: ['..oaaaaaaaaao...', '...ooo...ooo....'],
};

// 꽃 수집품 (9×9)
const FLOWER = [
  '...ooo...',
  '..oppo...',
  '.ooppooo.',
  'oppoyoppo',
  'opoyyyopo',
  'oppoyoppo',
  '.ooppooo.',
  '..oppo...',
  '...ooo...',
];
const FLOWER_MAP = { o: P.outline, p: P.flowerPetal, y: P.flowerCenter };

// 2단 점프 발밑 구름 (13×6). 외곽선 없이 하늘색 테두리만: 밟는 발판으로 보이지 않게.
const AIR_PUFF = [
  '...eee.eee...',
  '..ecccecccee.',
  '.eccccccccccc',
  'ecccccccccce.',
  '.eeecccceee..',
  '....eeee.....',
];
const AIR_PUFF_MAP = { e: P.puffEdge, c: P.cloud };

// 시계 아이콘 (9×9)
const CLOCK = [
  '..ooooo..',
  '.occccco.',
  'occcocco.',
  'occcoccco',
  'occcoooco',
  'occcccco.',
  '.occccco.',
  '..ooooo..',
];
const CLOCK_MAP = { o: P.outline, c: P.cream };


// ── 배경 레이어 ─────────────────────────────────────────────
function drawSky() {
  rect(0, 0, W, 90, P.sky1);
  rect(0, 90, W, 70, P.sky2);
  rect(0, 160, W, 110, P.sky3);
  // 계단식 경계 (그라데이션 대신 픽셀 디더 느낌)
  for (let x = 0; x < W; x += 4) { rect(x, 88 + (x % 8 ? 0 : 1), 2, 2, P.sky2); rect(x + 2, 158 + (x % 8 ? 1 : 0), 2, 2, P.sky3); }
}
function cloud(x, y, w) {
  rect(x + 4, y, w - 8, 6, P.cloud);
  rect(x, y + 4, w, 6, P.cloud);
  rect(x + 8, y - 3, w / 2, 4, P.cloud);
  rect(x + 2, y + 9, w - 4, 1, P.puffEdge); // 아래 그늘 한 줄
}
function drawFar() {
  // 먼 산 능선 두 겹 (가장 흐리게)
  for (let x = 0; x < W; x += 2) {
    // 주기를 480px(한 반복)에 맞춰, 이어 붙이는 곳에서 능선이 끊기지 않게 한다
    const k = (2 * Math.PI * x) / W;
    const h1 = 34 + Math.round(9 * Math.sin(k + 0.3) + 5 * Math.sin(3 * k + 1));
    const h2 = 18 + Math.round(7 * Math.sin(2 * k + 2));
    rect(x, 176 - h1, 2, h1, P.hill);
    rect(x, 186 - h2, 2, h2, P.hill2);
  }
  const base = 200;
  // 아파트 두 동: 창문 격자
  for (const [x, w, h] of [[30, 58, 78], [318, 66, 72]]) {
    rect(x, base - h, w, h + 40, P.farWall);
    rect(x - 2, base - h - 3, w + 4, 3, P.farRoof);
    for (let yy = base - h + 8; yy < base - 8; yy += 9) for (let xx = x + 6; xx < x + w - 6; xx += 9) rect(xx, yy, 4, 3, P.farWin);
  }
  // 낮은 집 실루엣: 뾰족 지붕과 옥상 물탱크를 섞는다
  const houses = [[4, 40, 50, 0], [96, 30, 60, 1], [128, 44, 38, 0], [176, 36, 56, 1], [214, 48, 46, 0],
    [264, 34, 62, 0], [392, 40, 58, 1], [436, 44, 42, 0]];
  for (const [x, w, h, flat] of houses) {
    rect(x, base - h, w, h + 40, P.farWall);
    if (flat) {
      rect(x - 1, base - h - 2, w + 2, 2, P.farRoof);
      rect(x + w - 14, base - h - 9, 9, 7, P.farRoof);
    } else {
      for (let i = 0; i < w / 2; i++) rect(x - 2 + i, base - h - Math.min(i, w / 2 - i) / 2 - 1, 2, Math.min(i, w / 2 - i) / 2 + 1, P.farRoof);
    }
    rect(x + 8, base - h + 10, 5, 6, P.farWin);
    if (w > 40) rect(x + w - 14, base - h + 10, 5, 6, P.farWin);
  }
  // 송신탑
  rect(262, 112, 2, 30, P.farRoof); rect(258, 120, 10, 1, P.farRoof); rect(259, 128, 8, 1, P.farRoof);
}

// 창문: 틀, 가운데 살, 창턱. curtain 은 반쯤 친 커튼, flowers 는 창가 화분.
function win(x, y, w, h, { curtain = false, cross = false, flowers = false } = {}) {
  rect(x - 1, y - 1, w + 2, h + 2, P.midFrame);
  rect(x, y, w, h, P.midWin);
  if (curtain) { rect(x, y, Math.floor(w / 2) - 1, h - 3, P.laundry3); rect(x + 1, y + h - 3, Math.floor(w / 2) - 3, 1, P.laundry3); }
  rect(x + Math.floor(w / 2), y, 1, h, P.midFrame);
  if (cross) rect(x, y + Math.floor(h / 2), w, 1, P.midFrame);
  rect(x - 2, y + h + 1, w + 4, 2, P.midFrame);
  if (flowers) {
    rect(x, y + h - 2, w, 3, P.tree);
    for (let i = 1; i < w - 1; i += 3) rect(x + i, y + h - 3, 2, 2, P.bgFlower);
  }
}
function door(x, g, w = 14, h = 20) {
  rect(x - 1, g - h - 1, w + 2, h + 1, P.midFrame);
  rect(x, g - h, w, h, P.door);
  rect(x + 2, g - h + 3, w - 4, 5, P.midWin);
  rect(x + w - 4, g - Math.floor(h / 2), 2, 1, P.midFrame);
  rect(x - 3, g - 2, w + 6, 2, P.shade);
}
// 박공 기와지붕: 한 줄씩 2px 좁혀 올리고 3줄마다 진한 기와 선
function gableRoof(x, top, w, c, dark) {
  const rows = Math.floor(w / 4);
  for (let r = 0; r < rows; r++) rect(x - 4 + r * 2, top - 1 - r, w + 8 - r * 4, 1, r % 3 === 0 ? dark : c);
  rect(x, top, w, 2, P.shade);
}
function tank(x, y) { // 옥상 물탱크
  rect(x + 2, y - 2, 1, 2, P.tankDark); rect(x + 11, y - 2, 1, 2, P.tankDark);
  rect(x, y - 11, 14, 9, P.tank);
  rect(x + 1, y - 12, 12, 1, P.tank);
  rect(x, y - 8, 14, 1, P.tankDark);
}
function acUnit(x, y) { // 에어컨 실외기
  rect(x, y, 10, 7, P.ac);
  rect(x + 2, y + 2, 4, 3, P.shade);
  rect(x + 7, y + 2, 2, 1, P.shade);
}
function bgPot(x, g) { // 문 앞 작은 화분
  rect(x - 1, g - 11, 8, 6, P.tree);
  rect(x + 1, g - 12, 2, 2, P.bgFlower);
  rect(x, g - 5, 6, 5, P.bgPot);
}
function lowWall(x, g, w) { // 담장
  rect(x, g - 14, w, 14, P.fence);
  rect(x - 1, g - 16, w + 2, 2, P.fenceCap);
  for (let i = 4; i < w; i += 10) rect(x + i, g - 10, 1, 4, P.shade);
}
function tree(x, y) {
  rect(x + 7, y + 14, 4, 14, P.pole);
  rect(x, y + 4, 18, 12, P.tree);
  rect(x + 3, y, 12, 18, P.tree);
  rect(x + 2, y + 12, 14, 4, P.treeDark);
  rect(x + 5, y + 3, 4, 2, P.treeLight);
  rect(x + 3, y + 6, 2, 2, P.treeLight);
}
function villa(x, g, w, h) { // 다세대 빌라: 평지붕, 물탱크, 2층 창문
  const top = g - h;
  rect(x, top, w, h, P.villa);
  rect(x - 2, top - 3, w + 4, 3, P.villaTop);
  tank(x + w - 22, top - 3);
  rect(x, top + 30, w, 1, P.shade);
  win(x + 8, top + 9, 14, 12, { cross: true });
  win(x + 30, top + 9, 14, 12, { curtain: true });
  win(x + 52, top + 9, 14, 12, { cross: true, flowers: true });
  win(x + 8, top + 38, 14, 12, { flowers: true });
  acUnit(x + w - 11, top + 40);
  door(x + 33, g);
  bgPot(x + 24, g);
}
function tiledHouse(x, g, w, h) { // 기와지붕 단독주택
  const top = g - h;
  rect(x, top, w, h, P.midWall2);
  gableRoof(x, top, w, P.midRoof, P.roofDark);
  win(x + 8, top + 10, 14, 12, { cross: true });
  win(x + w - 22, top + 10, 14, 12, { curtain: true });
  door(x + 24, g);
}
function shop(x, g, w, h) { // 동네 가게: 간판, 줄무늬 차양, 진열창
  const top = g - h;
  rect(x, top, w, h, P.midWall);
  rect(x - 2, top - 3, w + 4, 3, P.villaTop);
  rect(x + w - 16, top - 15, 1, 12, P.pole); rect(x + w - 21, top - 12, 11, 1, P.pole); // 안테나
  rect(x + 10, top + 6, w - 20, 11, P.signBoard);
  for (let i = x + 16; i < x + w - 16; i += 8) rect(i, top + 10, 4, 3, P.cream);
  const ay = top + 22;
  for (let i = 0; i < w + 4; i += 4) {
    const c = (i / 4) % 2 ? P.cream : P.awning;
    rect(x - 2 + i, ay, 4, 6, c);
    rect(x - 2 + i, ay + 6, 4, (i / 4) % 2 ? 1 : 2, c);
  }
  rect(x + 6, ay + 12, 34, g - ay - 16, P.midFrame);
  rect(x + 7, ay + 13, 32, g - ay - 18, P.midWin);
  rect(x + 7, g - 8, 32, 3, P.laundry1); // 진열대
  door(x + 52, g);
  bgPot(x + 70, g);
}
function gableHouse(x, g, w, h) { // 파란 지붕 집: 굴뚝, 커튼 창
  const top = g - h;
  rect(x + w - 18, top - 20, 7, 14, P.midFrame);
  rect(x, top, w, h, P.midWall);
  gableRoof(x, top, w, P.midRoof2, P.roofDark2);
  win(x + 8, top + 10, 14, 12, { curtain: true, flowers: true });
  win(x + w - 22, top + 10, 14, 12, { cross: true });
  door(x + 24, g);
}
function laundry(x1, x2, y) { // 빨랫줄
  for (let x = x1; x < x2; x++) rect(x, y + Math.round(3 * Math.sin(((x - x1) / (x2 - x1)) * Math.PI)), 1, 1, P.pole);
  const cloth = [[x1 + 5, 7, 9, P.laundry1], [x1 + 15, 6, 7, P.laundry2], [x1 + 24, 5, 8, P.laundry3]];
  for (const [cx, w, h, c] of cloth) rect(cx, y + 3, w, h, c);
}
function drawMid() {
  const g = GROUND_Y;
  villa(8, g, 80, 72);
  lowWall(90, g, 32);
  tree(94, g - 30);
  tiledHouse(126, g, 62, 46);
  shop(216, g, 84, 58);
  laundry(300, 332, g - 52);
  gableHouse(334, g, 62, 60);
  lowWall(398, g, 28);
  tree(402, g - 30);
  tiledHouse(430, g, 46, 40);
  // 전봇대와 전선 (변압기 포함)
  for (const px of [204, 468]) {
    rect(px, g - 92, 4, 92, P.pole);
    rect(px - 8, g - 86, 20, 2, P.pole);
    rect(px - 5, g - 78, 5, 8, P.ac);
  }
  for (let x = 0; x < W; x++) {
    const sag = (x - 204) * (x - 468) / 3000;
    rect(x, g - 85 + Math.max(0, -sag), 1, 1, P.pole);
  }
}

// ── 플레이 레이어 ───────────────────────────────────────────
// 지면 타일: 윗면 풀 + 벽돌 + 흙
function groundTile(x, y, top) {
  if (top) {
    rect(x, y, T, 5, P.grass);
    rect(x, y + 5, T, 1, P.grassDark);
    rect(x + 3, y - 1, 2, 1, P.grass); rect(x + 11, y - 1, 2, 1, P.grass);
    rect(x, y + 6, T, 10, P.brick);
    rect(x, y + 11, T, 1, P.brickDark);
    rect(x + 7, y + 6, 1, 5, P.brickDark);
    rect(x + 2, y + 12, 1, 4, P.brickDark);
    rect(x + 12, y + 12, 1, 4, P.brickDark);
  } else {
    rect(x, y, T, T, P.soil);
    rect(x + 3, y + 5, 2, 2, P.brickDark);
    rect(x + 10, y + 10, 2, 2, P.brickDark);
  }
}
function edgeOutline(x, y, w, h) {
  rect(x, y - 1, w, 1, P.outline);
  rect(x - 1, y, 1, h, P.outline);
  rect(x + w, y, 1, h, P.outline);
}
function platform(tx, ty, tw) {
  const x = tx * T, y = ty * T;
  for (let i = 0; i < tw; i++) {
    rect(x + i * T, y, T, 4, P.grass);
    rect(x + i * T, y + 4, T, 1, P.grassDark);
    rect(x + i * T, y + 5, T, 5, P.wood);
    rect(x + i * T, y + 9, T, 1, P.woodDark);
    rect(x + i * T + 7, y + 5, 1, 4, P.woodDark);
  }
  rect(x, y - 1, tw * T, 1, P.outline);
  rect(x - 1, y, 1, 10, P.outline);
  rect(x + tw * T, y, 1, 10, P.outline);
  rect(x, y + 10, tw * T, 1, P.outline);
}
// 가시 울타리: 가장 채도 높은 빨강 + 진한 외곽선
function spikes(x, y) {
  for (let s = 0; s < 2; s++) {
    const sx = x + s * 8;
    for (let r = 0; r < 8; r++) {
      const half = Math.floor(r / 2);
      rect(sx + 3 - half, y + r, half * 2 + 2, 1, r === 7 ? P.hazardDark : P.hazard);
      rect(sx + 3 - half - 1, y + r, 1, 1, P.outline);
      rect(sx + 3 + half + 2, y + r, 1, 1, P.outline);
    }
    rect(sx + 3, y - 1, 2, 1, P.outline);
    rect(sx + 3, y + 1, 1, 2, P.hazardLight);
  }
}
function spikeRow(tx, count, groundY) {
  for (let i = 0; i < count; i++) spikes(tx * T + i * T, groundY - 8);
}
// 굴러오는 화분 + 식인식물: 빨간 머리는 위험 색. 진행 방향으로 입을 벌렸다 닫는다.
const CHOMPER_OPEN = [
  '....oooooo....',
  '..oohhhhhhoo..',
  '.ohhchhhhhhho.',
  '.ohhhhhhchhhwo',
  'ohhhhchhhhowwo',
  'ohhhhhhhhommm.',
  'ohchhhhhommmm.',
  'ohhhhhhhhommm.',
  'ohhhhchhhhowwo',
  '.ohhhhhhchhhwo',
  '.odhhhhhhhhhdo',
  '..oddhhchhddo.',
  '...ooddddoo...',
  '.....oooo.....',
];
const CHOMPER_SHUT = [
  '....oooooo....',
  '..oohhhhhhoo..',
  '.ohhchhhhhhho.',
  '.ohhhhhhchhhho',
  'ohhhhchhhhhhho',
  'ohhhhhhhwwwwwo',
  'ohchhhhhoooooo',
  'ohhhhhhhwwwwwo',
  'ohhhhchhhhhhho',
  '.ohhhhhhchhhho',
  '.odhhhhhhhhhdo',
  '..oddhhchhddo.',
  '...ooddddoo...',
  '.....oooo.....',
];
const CHOMPER_MAP = { o: P.outline, h: P.hazard, d: P.hazardDark, c: P.cream, w: P.cream, m: P.mouth };
function pot(x, y, dir = -1, open = true) {
  // 줄기와 잎
  rect(x + 7, y - 8, 2, 8, P.leaf);
  rect(x + 2, y - 5, 5, 3, P.leaf); rect(x + 1, y - 4, 1, 1, P.leaf);
  rect(x + 9, y - 4, 5, 3, P.leaf); rect(x + 14, y - 3, 1, 1, P.leaf);
  sprite(open ? CHOMPER_OPEN : CHOMPER_SHUT, CHOMPER_MAP, x + 1, y - 21, dir < 0);
  // 화분
  rect(x - 1, y - 1, 18, 5, P.outline);
  rect(x, y, 16, 3, P.pot);
  rect(x + 1, y + 3, 14, 11, P.outline);
  rect(x + 2, y + 3, 12, 10, P.pot);
  rect(x + 2, y + 10, 12, 3, P.potDark);
  rect(x + 4, y + 5, 2, 3, P.hazardLight);
  // 이동 표시: 진행 방향 반대쪽에 선 (dir -1 = 왼쪽으로 이동)
  const lx = dir < 0 ? x + 20 : x - 14;
  rect(lx, y + 4, 6, 1, P.outline); rect(lx + (dir < 0 ? 2 : -2), y + 8, 8, 1, P.outline); rect(lx, y + 12, 5, 1, P.outline);
}
// 물웅덩이 구덩이
function pit(tx, tw, groundY) {
  const x = tx * T;
  rect(x, groundY + 10, tw * T, H - groundY - 10, P.water);
  for (let i = 0; i < tw * T; i += 6) rect(x + i, groundY + 10, 3, 1, P.waterLight);
  rect(x + 5, groundY + 16, 10, 1, P.waterLight);
}
// 가로등 체크포인트 (빨강 계열 금지 → 노란 불빛)
function lamp(x, groundY, on) {
  if (on) {
    // 빛: 계단식 픽셀 원 (arc 는 가장자리가 흐려진다)
    for (let dy = -14; dy <= 14; dy++) {
      const half = Math.floor(Math.sqrt(14 * 14 - dy * dy));
      rect(x + 4 - half, groundY - 38 + dy, half * 2, 1, P.lampGlow);
    }
  }
  rect(x + 2, groundY - 34, 4, 34, P.outline);
  rect(x + 3, groundY - 34, 2, 34, P.lampOff);
  rect(x - 1, groundY - 46, 10, 12, P.outline);
  rect(x, groundY - 45, 8, 10, on ? P.lampOn : P.cream);
  rect(x - 2, groundY - 47, 12, 2, P.outline);
  rect(x, groundY - 2, 8, 2, P.outline);
}
// 도착 깃발
function goalFlag(x, groundY) {
  rect(x, groundY - 48, 2, 48, P.outline);
  rect(x + 2, groundY - 47, 18, 12, P.outline);
  rect(x + 2, groundY - 46, 17, 10, P.flag);
  sprite(FLOWER, FLOWER_MAP, x + 6, groundY - 46);
}
// 튜토리얼 표지판
function sign(x, groundY) {
  const small = { font: 'Galmuri9', size: 10 };
  const lines = [t('tutorial.move'), t('tutorial.jump'), t('tutorial.doubleJump')];
  const w = Math.max(64, ...lines.map((l) => textSprite(l, small).width + 12));
  const cx = x - 4 + Math.round(w / 2); // 왼쪽 끝 고정, 오른쪽으로 늘림
  rect(cx - 1, groundY - 12, 3, 12, P.woodDark);
  panel(x - 4, groundY - 54, w, 44, P.panel, P.panelShade);
  lines.forEach((l, i) => text(l, cx, groundY - 51 + i * 13, { ...small, align: 'center', color: i === 2 ? P.midFrame : P.outline }));
}

const GROUND_Y = 224; // 지면 윗면 = 타일 14행 (16px 격자에 맞춤)
