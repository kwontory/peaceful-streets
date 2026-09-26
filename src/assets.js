// Claude can add approved sprite paths here when replacing the code drawings.
// Keys are the names used by imageFor() in the renderer.
export const spriteManifest = {};

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
