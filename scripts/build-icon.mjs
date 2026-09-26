// 브라우저 탭 아이콘: 서 있는 고양이(16×16)를 2배로 키운 32×32 PNG.
// 사용: npm run assets:icon → assets/icon/favicon.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { CAT, CAT_MAP, LEGS, sprite } from '../src/art.js';
import { Bitmap, draw, png } from './pixel.mjs';

const cat = draw(16, 16, () => sprite(CAT.slice(0, 14).concat(LEGS.stand), CAT_MAP, 0, 0));
const icon = new Bitmap(32, 32);
for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
  const color = cat.color(x, y);
  if (color[3]) icon.rect(x * 2, y * 2, 2, 2, color);
}
const out = new URL('../assets/icon/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
writeFileSync(`${out}favicon.png`, png(icon));
console.log('assets/icon/favicon.png 32×32');
