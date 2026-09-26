// Claude가 검수해 승인한 스프라이트 (docs/ASSET_SPEC.md 7장). 키는 renderer 의 imageFor()/drawFrame() 이름.
// 파일이 없거나 불러오기에 실패하면 기존 코드 그림으로 그린다.
export const spriteManifest = {
  air_puff: "assets/sprites/fx/air_puff.png",
  cat_idle: "assets/sprites/player/cat_idle.png",
  cat_jump: "assets/sprites/player/cat_jump.png",
  cat_land: "assets/sprites/player/cat_land.png",
  cat_run: "assets/sprites/player/cat_run.png",
  cat_spin: "assets/sprites/player/cat_spin.png",
  checkpoint_lamp: "assets/sprites/objects/checkpoint_lamp.png",
  checkpoint_lamp_glow: "assets/sprites/objects/checkpoint_lamp_glow.png",
  chomper_pot: "assets/sprites/hazards/chomper_pot.png",
  dust: "assets/sprites/fx/dust.png",
  flower: "assets/sprites/items/flower.png",
  flower_collect: "assets/sprites/items/flower_collect.png",
  goal_flag: "assets/sprites/objects/goal_flag.png",
  ground: "assets/sprites/tiles/ground.png",
  ground_variants: "assets/sprites/tiles/ground_variants.png",
  platform: "assets/sprites/tiles/platform.png",
  poof: "assets/sprites/fx/poof.png",
  sign_post: "assets/sprites/objects/sign_post.png",
  spikes: "assets/sprites/hazards/spikes.png",
};

const images = new Map();

export async function preloadAssets(manifest = spriteManifest, createImage = () => new Image()) {
  images.clear();
  const failed = [];
  await Promise.all(Object.entries(manifest).map(([key, src]) => new Promise((resolve) => {
    const image = createImage();
    image.onload = () => {
      if (image.naturalWidth > 0) images.set(key, image);
      else failed.push(key);
      resolve();
    };
    image.onerror = () => { failed.push(key); resolve(); };
    image.src = src;
  })));
  return { loaded: images.size, failed };
}

// A missing image returns null so the existing code drawing can be used.
export function imageFor(key) {
  return images.get(key) ?? null;
}
