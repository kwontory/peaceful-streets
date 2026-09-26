import { fonts } from "./font-data.js";

const cache = new Map();
const decoded = new Map();
const missing = new Set();

// 글자 픽셀은 브라우저 글꼴이 아니라 src/font-data.js 에서 읽는다.
// (삼성 인터넷 등은 캔버스에서 웹폰트를 무시하고 사용자 설정 글꼴로 그려 글자가 뭉개진다)
function glyphBits(font, char, entry) {
  const key = `${font.size}|${font === fonts.bold ? "b" : ""}|${char}`;
  if (!decoded.has(key)) {
    const bytes = atob(entry[5]);
    const bits = new Uint8Array(entry[3] * entry[4]);
    for (let i = 0; i < bits.length; i++) bits[i] = (bytes.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
    decoded.set(key, bits);
  }
  return decoded.get(key);
}

// 글자 모양만 0/1 로: 크롬 textBaseline top 윗선을 2px 아래에 둔 높이 size + 4 칸 (예전 fillText 결과와 같음)
export function textMask(value, { small = false, bold = false, pad = 0 } = {}) {
  const font = small ? fonts.small : bold ? fonts.bold : fonts.regular;
  const chars = [...value];
  let width = 0;
  chars.forEach((char, i) => {
    const entry = font.glyphs[char];
    if (!entry && !missing.has(char)) { missing.add(char); console.warn(`font-data.js 에 없는 글자: ${char}`); }
    width += (entry?.[0] ?? font.size / 2) + (font.kerning[char + (chars[i + 1] ?? "")] ?? 0);
  });
  width = Math.max(1, width + pad * 2);
  const height = font.size + 4 + pad * 2;
  const on = new Uint8Array(width * height);
  let pen = pad;
  chars.forEach((char, i) => {
    const entry = font.glyphs[char];
    if (entry?.length > 1) {
      const [, left, top, w, h] = entry;
      const bits = glyphBits(font, char, entry);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const px = pen + left + x, py = pad + 2 + top + y;
        if (bits[y * w + x] && px >= 0 && py >= 0 && px < width && py < height) on[py * width + px] = 1;
      }
    }
    pen += (entry?.[0] ?? font.size / 2) + (font.kerning[char + (chars[i + 1] ?? "")] ?? 0);
  });
  return { width, height, on };
}

export function textSprite(value, { small = false, bold = false, color = "#3d2b33", outline = null } = {}) {
  const key = [value, small, bold, color, outline].join("|");
  if (cache.has(key)) return cache.get(key);
  const { width, height, on } = textMask(value, { small, bold, pad: outline ? 1 : 0 });

  const result = document.createElement("canvas");
  result.width = width;
  result.height = height;
  const out = result.getContext("2d");
  const image = out.createImageData(width, height);
  function put(i, hex) {
    const rgb = Number.parseInt(hex.slice(1), 16);
    image.data.set([rgb >> 16, (rgb >> 8) & 255, rgb & 255, 255], i * 4);
  }
  if (outline) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (on[y * width + x]) continue;
      neighbors: for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < width && yy < height && on[yy * width + xx]) {
          put(y * width + x, outline);
          break neighbors;
        }
      }
    }
  }
  for (let i = 0; i < on.length; i++) if (on[i]) put(i, color);
  out.putImageData(image, 0, 0);
  cache.set(key, result);
  return result;
}

export function createTextRenderer(ctx) {
  return function text(value, x, y, options = {}) {
    const image = textSprite(value, options);
    const scale = options.scale ?? 1;
    let left = x;
    if (options.align === "center") left -= image.width * scale / 2;
    if (options.align === "right") left -= image.width * scale;
    ctx.drawImage(image, Math.round(left), Math.round(y), image.width * scale, image.height * scale);
    return image.width * scale;
  };
}

// DOM(점프 버튼, 세로 안내)에 넣는 픽셀 글자. 1 글자 픽셀 = 1 CSS px, 넘치면 띄어쓰기에서 줄바꿈
export function textElement(value, { color, bold = false, small = false, maxWidth = Infinity, lineGap = 3 } = {}) {
  const widthOf = (line) => textMask(line, { small, bold }).width;
  const lines = [];
  for (const paragraph of value.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (line && widthOf(next) > maxWidth) { lines.push(line); line = word; }
      else line = next;
    }
    lines.push(line);
  }
  const sprites = lines.map((line) => textSprite(line, { small, bold, color }));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(...sprites.map((sprite) => sprite.width));
  canvas.height = sprites.reduce((sum, sprite) => sum + sprite.height, 0) + lineGap * (sprites.length - 1);
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  canvas.className = "pixel-text";
  canvas.setAttribute("aria-hidden", "true");
  const out = canvas.getContext("2d");
  let y = 0;
  for (const sprite of sprites) {
    out.drawImage(sprite, Math.floor((canvas.width - sprite.width) / 2), y);
    y += sprite.height + lineGap;
  }
  return canvas;
}
