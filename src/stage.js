// Stage 1-1 follows mockup/play.js LEVEL. Coordinates are logical 16px tiles.
const TILE = 16;
const groundRanges = [[0, 9], [12, 27], [32, 47], [50, 63]];
const blocks = [[16, 17, 1], [52, 53, 1], [54, 55, 2], [56, 57, 3]];
const platforms = [[29, 11, 2], [41, 10, 3]];
const spikeRows = [[21, 2], [42, 2]];
const flowerTiles = [[16.5, 11], [20, 11], [21.5, 10], [23, 11], [29.5, 9], [30.5, 9], [36, 10], [38, 10], [41.5, 8], [42.5, 8], [43.5, 8], [52.5, 11], [54.5, 10], [56.5, 9], [58.5, 9]];
// 2단 점프 보너스 꽃. 1단 점프 최고점(머리 y=148)보다 높고, 근처 블록·발판에서 1단으로는 닿지 않는다.
// [6, 8]: 표지판 앞에서 바로 연습(쉬움), [13.5, 7]: 첫 구덩이를 건넌 뒤 한 칸 더 높이(조금 어려움)
const bonusFlowerTiles = [[6, 8], [13.5, 7]];

const solids = [
  ...groundRanges.map(([start, end]) => ({ x: start * TILE, y: 224, width: (end - start + 1) * TILE, height: 48 })),
  ...blocks.map(([start, end, height]) => ({ x: start * TILE, y: 224 - height * TILE, width: (end - start + 1) * TILE, height: height * TILE })),
];

export const stage = {
  number: "1-1",
  nameKey: "stage.1-1.name",
  width: 64 * TILE,
  height: 270,
  spawn: { x: 3 * TILE + 3, y: 210 },
  goal: { x: 60 * TILE + 2, y: 176, width: 22, height: 48 },
  groundRanges,
  blocks,
  solids,
  platforms: platforms.map(([column, row, width]) => ({ x: column * TILE, y: row * TILE, width: width * TILE, height: 10 })),
  hazards: spikeRows.map(([column, count]) => ({ x: column * TILE + 2, y: 218, width: count * TILE - 4, height: 6 })),
  spikeRows,
  checkpoints: [25, 46].map((column) => ({ x: column * TILE, y: 176, width: 16, height: 48, spawn: { x: column * TILE + 3, y: 210 } })),
  flowers: [
    ...flowerTiles.map(([column, row]) => ({ x: column * TILE + 3, y: row * TILE + 3 })),
    ...bonusFlowerTiles.map(([column, row]) => ({ x: column * TILE + 3, y: row * TILE + 3, bonus: true })),
  ],
  pot: { minX: 34 * TILE, maxX: 39 * TILE, y: 210, width: 14, height: 14, speed: 36 },
  signX: TILE,
};
