// Peaceful Streets — 정적 화면 목업 (엔진 없이 480×270 캔버스에 직접 그림)
// 목적: 해상도·팔레트·레이어 대비·HUD·메뉴·한글 픽셀 폰트를 브라우저에서 검증한다.
// 실제 게임 코드가 아니며, 팔레트와 치수는 docs/DESIGN.md 와 일치시킨다.


const cv = document.getElementById('screen');
ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ── 정수 배율 스케일링 ──────────────────────────────────────
// 2배 이상이면 정수 배율, 그보다 작은 창에서는 1배로 너무 작아지므로
// 비정수 배율(nearest)로 채운다. 픽셀 크기가 약간 고르지 않은 대신 읽을 수 있다.
function fit() {
  const raw = Math.min(innerWidth / W, innerHeight / H);
  const s = raw >= 2 ? Math.floor(raw) : Math.max(1, raw);
  cv.style.width = W * s + 'px';
  cv.style.height = H * s + 'px';
}
addEventListener('resize', fit);

function drawStage({ player = true, lampOn = true, props = true } = {}) {
  drawSky();
  cloud(40, 30, 48); cloud(210, 50, 36); cloud(360, 24, 56);
  drawFar();
  drawMid();

  // 지면: 0~11, 구덩이 12~14, 15~29
  const segs = [[0, 12], [15, 15]];
  pit(12, 3, GROUND_Y);
  for (const [s, n] of segs) {
    for (let i = s; i < s + n; i++) {
      groundTile(i * T, GROUND_Y, true);
      groundTile(i * T, GROUND_Y + T, false);
      groundTile(i * T, GROUND_Y + 2 * T, false);
    }
    edgeOutline(s * T, GROUND_Y, n * T, H - GROUND_Y);
  }
  if (props) {
  platform(11, 10, 3);
  platform(18, 8, 2);

  sign(20, GROUND_Y);
  lamp(8 * T + 4, GROUND_Y, lampOn);
  spikeRow(20, 2, GROUND_Y);
  pot(25 * T, GROUND_Y - 14);
  goalFlag(28 * T + 4, GROUND_Y);

  // 꽃 수집품
  for (const [x, y] of [[180, 136], [196, 128], [212, 136], [292, 104], [308, 104]]) sprite(FLOWER, FLOWER_MAP, x, y);

  }

  if (player) sprite(CAT, CAT_MAP, 6 * T, GROUND_Y - 16);
}

// ── HUD ───────────────────────────────────────────────────
// 위쪽 한 줄, 흰 글자 + 진한 외곽선. 배경 패널 없이 가볍게.
function drawHud() {
  const o = { color: P.cream, outline: P.outline };
  text(`1-1  ${t('stage.1-1.name')}`, 8, 6, o);
  // 오른쪽: 꽃 개수, 시간
  let x = W - 8;
  x -= text('0:42', x, 6, { ...o, align: 'right' });
  sprite(CLOCK, CLOCK_MAP, x - 13, 8);
  x -= 13 + 10;
  x -= text('× 12', x, 6, { ...o, align: 'right' });
  sprite(FLOWER, FLOWER_MAP, x - 12, 8);
}

// ── 화면별 ────────────────────────────────────────────────
function menu(items, cx, y, sel, gap = 18) {
  items.forEach((label, i) => {
    const yy = y + i * gap;
    if (i === sel) {
      const w = textSprite(label, {}).width;
      rect(cx - w / 2 - 6, yy - 2, w + 12, 16, P.focus);
      text('▶', cx - w / 2 - 16, yy, {});
    }
    text(label, cx, yy, { align: 'center' });
  });
}

const screens = {
  title() {
    // 타이틀은 장애물 없는 조용한 골목 + 가운데 고양이
    drawStage({ player: false, props: false });
    lamp(15 * T - 40, GROUND_Y, true);
    sprite(CAT, CAT_MAP, W / 2 - 8, GROUND_Y - 16);
    // 로고: Bold 12px 을 정수 3배
    const logoOpts = { bold: true, color: P.cream, outline: P.outline, scale: 3 };
    const lw = text(t('game.title'), W / 2, 40, { ...logoOpts, align: 'center' });
    panel(W / 2 - 60, 110, 120, 50);
    menu([t('menu.start'), t('menu.settings')], W / 2, 119, 0);
    text(t('menu.hintSelect'), W / 2, 252, { font: 'Galmuri9', size: 10, color: P.cream, outline: P.outline, align: 'center' });
  },
  banner() {
    drawStage();
    drawHud();
    // 스테이지 시작 배너: 3초 후 HUD 로 줄어든다
    panel(W / 2 - 90, 92, 180, 48, P.cream);
    text('1-1', W / 2, 98, { font: 'Galmuri9', size: 10, align: 'center', color: P.midFrame });
    text(t('stage.1-1.name'), W / 2, 110, { bold: true, align: 'center', scale: 2 });
  },
  play() {
    drawStage();
    drawHud();
    text(t('checkpoint.reached'), 8 * T + 8, GROUND_Y - 64, { font: 'Galmuri9', size: 10, color: P.cream, outline: P.outline, align: 'center' });
  },
  pause() {
    drawStage();
    drawHud();
    rect(0, 0, W, H, P.dim);
    panel(W / 2 - 70, 64, 140, 132);
    text(t('pause.title'), W / 2, 74, { bold: true, align: 'center' });
    rect(W / 2 - 50, 91, 100, 1, P.panelShade);
    menu([t('pause.resume'), t('pause.restart'), t('pause.settings'), t('pause.toTitle')], W / 2, 102, 0, 22);
  },
  clear() {
    drawStage();
    rect(0, 0, W, H, P.dim);
    text(t('clear.title'), W / 2, 50, { bold: true, color: P.focus, outline: P.outline, scale: 2, align: 'center' });
    panel(W / 2 - 80, 88, 160, 116);
    const row = (label, value, y, icon) => {
      if (icon) sprite(icon.rows, icon.map, W / 2 - 62, y + 2);
      text(label, W / 2 - 48, y, {});
      text(value, W / 2 + 62, y, { align: 'right' });
    };
    row(t('clear.time'), '0:42', 100, { rows: CLOCK, map: CLOCK_MAP });
    row(t('clear.flowers'), '12 / 15', 118, { rows: FLOWER, map: FLOWER_MAP });
    rect(W / 2 - 62, 138, 124, 1, P.panelShade);
    menu([t('clear.next'), t('clear.retry')], W / 2, 150, 0, 22);
  },
};

let current = new URLSearchParams(location.search).get('screen') || 'play';
let grid = new URLSearchParams(location.search).has('grid');
if (new URLSearchParams(location.search).has('clean')) document.getElementById('switcher').hidden = true;
const order = ['title', 'banner', 'play', 'pause', 'clear'];
const names = { title: '타이틀', banner: '시작 배너', play: '플레이', pause: '일시정지', clear: '클리어' };

function render() {
  ctx.clearRect(0, 0, W, H);
  screens[current]();
  if (grid) {
    for (let x = 0; x < W; x += T) rect(x, 0, 1, H, 'rgba(61,43,51,0.18)');
    for (let y = 0; y < H; y += T) rect(0, y, W, 1, 'rgba(61,43,51,0.18)');
  }
  document.getElementById('cur').textContent = names[current];
}

addEventListener('keydown', (e) => {
  const i = '12345'.indexOf(e.key);
  if (i >= 0) current = order[i];
  if (e.key === 'g' || e.key === 'G') grid = !grid;
  if (e.key === 'h' || e.key === 'H') { const sw = document.getElementById('switcher'); sw.hidden = !sw.hidden; }
  render();
});

(async () => {
  fit();
  S = await fetch('../locales/ko.json').then((r) => r.json());
  await Promise.all([
    document.fonts.load('400 12px Galmuri11'),
    document.fonts.load('700 12px Galmuri11'),
    document.fonts.load('10px Galmuri9'),
  ]);
  render();
  document.body.dataset.ready = '1';
})();
