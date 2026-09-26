const cache = new Map();

export function createTextRenderer(ctx) {
  function sprite(value, { small = false, bold = false, color = "#3d2b33", outline = null } = {}) {
    const key = [value, small, bold, color, outline].join("|");
    if (cache.has(key)) return cache.get(key);
    const size = small ? 10 : 12;
    const family = small ? "Galmuri9" : "Galmuri11";
    const font = `${bold ? 700 : 400} ${size}px ${family}`;
    const measure = document.createElement("canvas").getContext("2d");
    measure.font = font;
    const pad = outline ? 1 : 0;
    const width = Math.max(1, Math.ceil(measure.measureText(value).width) + pad * 2);
    // Galmuri glyphs can rise above textBaseline=top; keep two clear pixels.
    const height = size + 4 + pad * 2;
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = width;
    maskCanvas.height = height;
    const mask = maskCanvas.getContext("2d");
    mask.font = font;
    mask.textBaseline = "top";
    mask.fillStyle = "#000";
    mask.fillText(value, pad, pad + 2);
    const pixels = mask.getImageData(0, 0, width, height).data;
    const on = new Uint8Array(width * height);
    for (let i = 0; i < on.length; i++) on[i] = pixels[i * 4 + 3] >= 128 ? 1 : 0;

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

  return function text(value, x, y, options = {}) {
    const image = sprite(value, options);
    const scale = options.scale ?? 1;
    let left = x;
    if (options.align === "center") left -= image.width * scale / 2;
    if (options.align === "right") left -= image.width * scale;
    ctx.drawImage(image, Math.round(left), Math.round(y), image.width * scale, image.height * scale);
    return image.width * scale;
  };
}
