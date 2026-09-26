// 픽셀 폰트를 글자별 픽셀 데이터(src/font-data.js)로 바꾼다.
// 게임은 브라우저 글꼴 엔진을 쓰지 않고 이 데이터로 글자를 그린다.
// (삼성 인터넷 등은 캔버스 fillText 에서 웹폰트를 무시하고 사용자 설정 글꼴로 그린다)
//
// 입력: assets/fonts/ps-pixel/*.woff (scripts/subset-fonts.py 결과, SIL OFL 1.1)
// 문구를 새로 넣었다면: subset-fonts.py → 이 스크립트 순서로 다시 실행한다.
//     node scripts/build-font-atlas.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const ROOT = new URL('../', import.meta.url);
const FONTS = [
  // 이름, 파일, 픽셀 크기 (src/text.js 와 같은 크기만 쓴다)
  ['regular', 'PSPixel11.woff', 12],
  ['bold', 'PSPixel11-Bold.woff', 12],
  ['small', 'PSPixel9.woff', 10],
];

function readWoff(buffer) {
  const tables = {};
  for (let i = 0; i < buffer.readUInt16BE(12); i++) {
    const at = 44 + i * 20;
    const tag = buffer.toString('latin1', at, at + 4);
    const offset = buffer.readUInt32BE(at + 4), compressed = buffer.readUInt32BE(at + 8), length = buffer.readUInt32BE(at + 12);
    const data = buffer.subarray(offset, offset + compressed);
    tables[tag] = compressed < length ? inflateSync(data) : data;
  }
  return tables;
}

function readCmap(cmap) {
  const map = new Map();
  const count = cmap.readUInt16BE(2);
  let best = null;
  for (let i = 0; i < count; i++) {
    const platform = cmap.readUInt16BE(4 + i * 8), encoding = cmap.readUInt16BE(6 + i * 8), offset = cmap.readUInt32BE(8 + i * 8);
    const format = cmap.readUInt16BE(offset);
    if (platform === 3 && encoding === 10 && format === 12) best = offset;
    else if (platform === 3 && encoding === 1 && format === 4 && best === null) best = offset;
  }
  const format = cmap.readUInt16BE(best);
  if (format === 12) {
    for (let i = 0; i < cmap.readUInt32BE(best + 12); i++) {
      const at = best + 16 + i * 12;
      const start = cmap.readUInt32BE(at), end = cmap.readUInt32BE(at + 4), glyph = cmap.readUInt32BE(at + 8);
      for (let code = start; code <= end; code++) map.set(code, glyph + code - start);
    }
  } else {
    const segments = cmap.readUInt16BE(best + 6) / 2;
    const ends = best + 14, starts = ends + segments * 2 + 2, deltas = starts + segments * 2, ranges = deltas + segments * 2;
    for (let s = 0; s < segments; s++) {
      const end = cmap.readUInt16BE(ends + s * 2), start = cmap.readUInt16BE(starts + s * 2);
      const delta = cmap.readInt16BE(deltas + s * 2), range = cmap.readUInt16BE(ranges + s * 2);
      for (let code = start; code <= end && code !== 0xffff; code++) {
        let glyph;
        if (range === 0) glyph = (code + delta) & 0xffff;
        else {
          glyph = cmap.readUInt16BE(ranges + s * 2 + range + (code - start) * 2);
          if (glyph) glyph = (glyph + delta) & 0xffff;
        }
        if (glyph) map.set(code, glyph);
      }
    }
  }
  return map;
}

// 글리프 윤곽선: [[{x, y, on}], ...] (폰트 단위, y 위쪽이 +)
function readContours(tables, glyph) {
  const { loca, glyf, head } = tables;
  const long = head.readInt16BE(50) === 1;
  const start = long ? loca.readUInt32BE(glyph * 4) : loca.readUInt16BE(glyph * 2) * 2;
  const end = long ? loca.readUInt32BE(glyph * 4 + 4) : loca.readUInt16BE(glyph * 2 + 2) * 2;
  if (start === end) return [];
  const g = glyf.subarray(start, end);
  const contourCount = g.readInt16BE(0);
  if (contourCount < 0) {
    // 복합 글리프: 부품을 옮겨 붙인다 (확대·회전은 픽셀 폰트에 없음)
    const contours = [];
    let at = 10, more = true;
    while (more) {
      const flags = g.readUInt16BE(at), part = g.readUInt16BE(at + 2);
      at += 4;
      let dx, dy;
      if (flags & 1) { dx = g.readInt16BE(at); dy = g.readInt16BE(at + 2); at += 4; }
      else { dx = g.readInt8(at); dy = g.readInt8(at + 1); at += 2; }
      if (!(flags & 2)) throw new Error(`glyph ${glyph}: point-matched components are not supported`);
      if (flags & (8 | 0x40 | 0x80)) throw new Error(`glyph ${glyph}: scaled components are not supported`);
      for (const contour of readContours(tables, part)) contours.push(contour.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })));
      more = Boolean(flags & 0x20);
    }
    return contours;
  }
  const ends = Array.from({ length: contourCount }, (_, i) => g.readUInt16BE(10 + i * 2));
  const pointCount = ends.at(-1) + 1;
  let at = 10 + contourCount * 2;
  at += 2 + g.readUInt16BE(at);
  const flags = [];
  while (flags.length < pointCount) {
    const flag = g[at++];
    flags.push(flag);
    if (flag & 8) for (let r = g[at++]; r > 0; r--) flags.push(flag);
  }
  const coords = (shortBit, sameBit) => {
    let value = 0;
    return flags.map((flag) => {
      if (flag & shortBit) { const d = g[at++]; value += flag & sameBit ? d : -d; }
      else if (!(flag & sameBit)) { value += g.readInt16BE(at); at += 2; }
      return value;
    });
  };
  const xs = coords(2, 16), ys = coords(4, 32);
  const contours = [];
  let first = 0;
  for (const last of ends) {
    contours.push(xs.slice(first, last + 1).map((x, i) => ({ x, y: ys[first + i], on: Boolean(flags[first + i] & 1) })));
    first = last + 1;
  }
  return contours;
}

// 곡선은 잘게 쪼갠 직선으로 (Galmuri 는 모두 직선이라 실제로는 쓰이지 않는다)
function edges(contours) {
  const lines = [];
  for (const contour of contours) {
    const points = [];
    const n = contour.length;
    const startIndex = contour.findIndex((p) => p.on);
    const base = startIndex < 0 ? { x: (contour[0].x + contour[1].x) / 2, y: (contour[0].y + contour[1].y) / 2 } : contour[startIndex];
    points.push(base);
    let control = null;
    for (let k = 1; k <= n; k++) {
      const p = contour[((startIndex < 0 ? 0 : startIndex) + k) % n];
      if (p.on) {
        if (control) quad(points, control, p);
        else points.push(p);
        control = null;
      } else {
        if (control) {
          const mid = { x: (control.x + p.x) / 2, y: (control.y + p.y) / 2 };
          quad(points, control, mid);
        }
        control = p;
      }
    }
    if (control) quad(points, control, base);
    for (let i = 0; i < points.length - 1; i++) lines.push([points[i], points[i + 1]]);
  }
  return lines;
}
function quad(points, c, end) {
  const from = points.at(-1);
  for (let t = 1; t <= 8; t++) {
    const u = t / 8;
    points.push({ x: (1 - u) ** 2 * from.x + 2 * (1 - u) * u * c.x + u * u * end.x, y: (1 - u) ** 2 * from.y + 2 * (1 - u) * u * c.y + u * u * end.y });
  }
}

// 픽셀 중심이 윤곽 안인지 (nonzero). 결과 좌표: x 오른쪽, y 는 윗선(textBaseline top)에서 아래로
function rasterize(lines, unitsPerPixel, ascent) {
  if (!lines.length) return null;
  const toPx = (p) => ({ x: p.x / unitsPerPixel, y: (ascent - p.y) / unitsPerPixel });
  const segments = lines.map(([a, b]) => [toPx(a), toPx(b)]);
  const xs = segments.flatMap(([a, b]) => [a.x, b.x]), ys = segments.flatMap(([a, b]) => [a.y, b.y]);
  const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  const rows = [];
  for (let y = y0; y < y1; y++) {
    const cy = y + 0.5;
    const row = [];
    for (let x = x0; x < x1; x++) {
      const cx = x + 0.5;
      let winding = 0;
      for (const [a, b] of segments) {
        if ((a.y <= cy) === (b.y <= cy)) continue;
        const ix = a.x + (cy - a.y) * (b.x - a.x) / (b.y - a.y);
        if (ix > cx) winding += a.y < b.y ? 1 : -1;
      }
      row.push(winding !== 0 ? 1 : 0);
    }
    rows.push(row);
  }
  // 빈 가장자리 잘라내기
  let top = 0, bottom = rows.length, left = 0, right = x1 - x0;
  while (top < bottom && !rows[top].includes(1)) top++;
  while (bottom > top && !rows[bottom - 1].includes(1)) bottom--;
  if (top === bottom) return null;
  const column = (x) => rows.slice(top, bottom).some((row) => row[x]);
  while (!column(left)) left++;
  while (!column(right - 1)) right--;
  return { x: x0 + left, y: y0 + top, w: right - left, h: bottom - top, rows: rows.slice(top, bottom).map((row) => row.slice(left, right)) };
}

// kern: PairPos 포맷 1 (글자 쌍) 만. XAdvance 값만 쓴다
function readCoverage(table, offset) {
  const format = table.readUInt16BE(offset);
  const glyphs = [];
  if (format === 1) for (let i = 0; i < table.readUInt16BE(offset + 2); i++) glyphs.push(table.readUInt16BE(offset + 4 + i * 2));
  else for (let i = 0; i < table.readUInt16BE(offset + 2); i++) {
    const at = offset + 4 + i * 6;
    for (let g = table.readUInt16BE(at); g <= table.readUInt16BE(at + 2); g++) glyphs.push(g);
  }
  return glyphs;
}
const valueSize = (format) => [...format.toString(2)].filter((bit) => bit === '1').length * 2;
function readKerning(gpos) {
  const pairs = new Map();
  const lookupList = gpos.readUInt16BE(8);
  for (let l = 0; l < gpos.readUInt16BE(lookupList); l++) {
    const lookup = lookupList + gpos.readUInt16BE(lookupList + 2 + l * 2);
    if (gpos.readUInt16BE(lookup) !== 2) throw new Error(`GPOS lookup type ${gpos.readUInt16BE(lookup)} is not supported`);
    for (let s = 0; s < gpos.readUInt16BE(lookup + 4); s++) {
      const sub = lookup + gpos.readUInt16BE(lookup + 6 + s * 2);
      if (gpos.readUInt16BE(sub) !== 1) throw new Error('GPOS PairPos format 2 is not supported');
      const first = readCoverage(gpos, sub + gpos.readUInt16BE(sub + 2));
      const format1 = gpos.readUInt16BE(sub + 4), format2 = gpos.readUInt16BE(sub + 6);
      if (format1 & ~4 || format2) throw new Error('only XAdvance kerning is supported');
      first.forEach((left, i) => {
        const set = sub + gpos.readUInt16BE(sub + 10 + i * 2);
        const recordSize = 2 + valueSize(format1) + valueSize(format2);
        for (let r = 0; r < gpos.readUInt16BE(set); r++) {
          const at = set + 2 + r * recordSize;
          const key = `${left},${gpos.readUInt16BE(at)}`;
          if (!pairs.has(key)) pairs.set(key, gpos.readInt16BE(at + 2));
        }
      });
    }
  }
  return pairs;
}

function build(file, size) {
  const tables = readWoff(readFileSync(new URL(`assets/fonts/ps-pixel/${file}`, ROOT)));
  const unitsPerEm = tables.head.readUInt16BE(18);
  const unitsPerPixel = unitsPerEm / size;
  // 크롬 캔버스의 textBaseline = "top" 은 OS/2 typo 올림·내림을 글자 크기(em)에 맞춰 줄인 윗선이다
  // (12px: 10.29px, 10px: 9.09px). 픽셀 중심으로 칠하면 예전 fillText + 알파 128 자르기와 같아진다
  const typoAscent = tables['OS/2'].readInt16BE(68), typoDescent = tables['OS/2'].readInt16BE(70);
  const ascent = typoAscent * unitsPerEm / (typoAscent - typoDescent);
  const metrics = tables.hhea.readUInt16BE(34);
  const advance = (glyph) => tables.hmtx.readUInt16BE(Math.min(glyph, metrics - 1) * 4);
  const cmap = readCmap(tables.cmap);
  const pixels = (units, what) => {
    const value = units / unitsPerPixel;
    if (!Number.isInteger(value)) throw new Error(`${file}: ${what} ${units} is not a whole pixel`);
    return value;
  };

  const glyphs = {};
  const glyphChar = new Map();
  for (const [code, glyph] of [...cmap].sort((a, b) => a[0] - b[0])) {
    const char = String.fromCodePoint(code);
    glyphChar.set(glyph, char);
    const bitmap = rasterize(edges(readContours(tables, glyph)), unitsPerPixel, ascent);
    const entry = [pixels(advance(glyph), `advance of ${char}`)];
    if (bitmap) {
      const bits = bitmap.rows.flat();
      const bytes = new Uint8Array(Math.ceil(bits.length / 8));
      bits.forEach((bit, i) => { if (bit) bytes[i >> 3] |= 128 >> (i & 7); });
      entry.push(bitmap.x, bitmap.y, bitmap.w, bitmap.h, Buffer.from(bytes).toString('base64'));
    }
    glyphs[char] = entry;
  }
  const kerning = {};
  for (const [key, value] of readKerning(tables.GPOS)) {
    const [left, right] = key.split(',').map(Number);
    if (!value || !glyphChar.has(left) || !glyphChar.has(right)) continue;
    kerning[glyphChar.get(left) + glyphChar.get(right)] = pixels(value, `kerning ${key}`);
  }
  return { size, glyphs, kerning };
}

const fonts = Object.fromEntries(FONTS.map(([name, file, size]) => [name, build(file, size)]));
const source = `// 자동 생성 파일: node scripts/build-font-atlas.mjs (직접 고치지 않는다)
// PS Pixel(Galmuri 서브셋, SIL OFL 1.1 — assets/fonts/ps-pixel/OFL.md)의 글자 픽셀.
// 글자: [폭, 왼쪽, 위(윗선 기준), 너비, 높이, 픽셀 비트(base64)]. 빈 글자는 [폭]만.
export const fonts = ${JSON.stringify(fonts)};
`;
writeFileSync(new URL('src/font-data.js', ROOT), source);
for (const [name, font] of Object.entries(fonts))
  console.log(`${name}: ${Object.keys(font.glyphs).length} glyphs, ${Object.keys(font.kerning).length} kerning pairs`);
console.log(`src/font-data.js ${(source.length / 1024).toFixed(1)}KB`);
