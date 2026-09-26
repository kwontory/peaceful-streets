import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fonts } from "../src/font-data.js";
import { textMask } from "../src/text.js";

// 화면에 나오는 글자: 영문·숫자·기호, 번역 문구 전체, 코드·HTML 속 한글이 아닌 특수 기호(▶ ♪ × 등)
function usedChars() {
  const chars = new Set();
  for (let code = 0x20; code < 0x7f; code++) chars.add(String.fromCharCode(code));
  for (const value of Object.values(JSON.parse(readFileSync("locales/ko.json", "utf8")))) for (const char of value) chars.add(char);
  const files = readdirSync("src").filter((name) => name.endsWith(".js") && name !== "font-data.js").map((name) => `src/${name}`);
  for (const path of [...files, "index.html"]) {
    for (const char of readFileSync(path, "utf8")) if (char.codePointAt(0) > 0x7e && !/[\p{Script=Hangul}\s]/u.test(char)) chars.add(char);
  }
  return chars;
}

test("every character the game shows is in all three pixel fonts", () => {
  const chars = usedChars();
  for (const [name, font] of Object.entries(fonts)) {
    const missing = [...chars].filter((char) => !font.glyphs[char]);
    assert.deepEqual(missing, [], `${name}: 글자 데이터에 없음. subset-fonts.py → npm run assets:font 순서로 다시 만든다`);
  }
});

test("glyph bitmaps have the size their header says", () => {
  for (const [name, font] of Object.entries(fonts)) {
    for (const [char, entry] of Object.entries(font.glyphs)) {
      assert.ok(Number.isInteger(entry[0]) && entry[0] >= 0, `${name} ${char}: 폭`);
      if (entry.length === 1) continue;
      const [, , top, w, h, bits] = entry;
      assert.equal(Buffer.from(bits, "base64").length, Math.ceil(w * h / 8), `${name} ${char}: 픽셀 수`);
      // text.js 는 윗선 위 2px 부터 size + 4 칸만 그린다
      assert.ok(top >= -2 && top + h <= font.size + 2, `${name} ${char}: 글자가 그리는 칸을 벗어남`);
    }
  }
});

test("text masks use advances and kerning in whole pixels", () => {
  const plain = textMask("가", {});
  assert.equal(plain.width, fonts.regular.glyphs["가"][0]);
  assert.equal(plain.height, 16);
  assert.ok(plain.on.includes(1));
  const padded = textMask("가", { pad: 1 });
  assert.equal(padded.width, plain.width + 2);
  assert.equal(textMask("가", { small: true }).height, 14);
  const [pair, kern] = Object.entries(fonts.regular.kerning)[0];
  const [a, b] = [...pair];
  assert.equal(textMask(pair, {}).width, fonts.regular.glyphs[a][0] + fonts.regular.glyphs[b][0] + kern);
});
