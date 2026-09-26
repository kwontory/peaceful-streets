import { createGame, resetStage, step } from "./game.js";
import { createAudio } from "./audio.js";
import { canvasScale, createDisplaySettings } from "./display.js";
import { loadLocale, t } from "./locale.js";
import { render, menuHitboxes } from "./render.js";
import { settingsMenu } from "./settings-menu.js";
import { preloadAssets } from "./assets.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const status = document.querySelector("#status");
const held = new Set();
const touchPointers = new Map();
const game = createGame();
const audio = createAudio();
const display = createDisplaySettings();
const ui = { screen: "title", selection: 0, bannerTime: 0, settingsReturn: "title", touch: matchMedia("(pointer: coarse)").matches, soundEnabled: audio.isEnabled(), compact: display.isCompact() };
let jumpQueued = false;

const menus = {
  title: ["start", "settings"],
  pause: ["resume", "restart", "settings", "title"],
  clear: ["retry", "title"],
};
const controlled = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Enter", "Escape", "KeyA", "KeyD", "KeyW", "KeyR", "KeyM"]);
const controls = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", Space: "jump", Enter: "select", Escape: "pause", KeyR: "restart", KeyM: "mute" };
const announce = (key) => { status.textContent = t(key); };
const touchHeld = (control) => [...touchPointers.values()].includes(control);
const updateMuteButton = () => document.querySelector('[data-control="mute"]').setAttribute("aria-pressed", String(!audio.isEnabled()));
const menuActions = (screen) => screen === "settings" ? settingsMenu(ui.soundEnabled, ui.compact).map((item) => item.action) : menus[screen];

function toggleSound() {
  ui.soundEnabled = audio.setEnabled(!audio.isEnabled());
  announce(ui.soundEnabled ? "audio.on" : "audio.off");
  updateMuteButton();
}

function toggleScale() {
  ui.compact = display.setCompact(!display.isCompact());
  fit();
  announce(ui.compact ? "settings.scaleSmall" : "settings.scaleAuto");
}

function start() {
  resetStage(game);
  ui.screen = "banner";
  ui.bannerTime = 2.5;
  ui.selection = 0;
  jumpQueued = false;
  announce("stage.1-1.name");
}

function choose() {
  const action = menuActions(ui.screen)?.[ui.selection];
  if (action === "start" || action === "restart" || action === "retry") start();
  else if (action === "resume") ui.screen = "play";
  else if (action === "sound") toggleSound();
  else if (action === "scale") toggleScale();
  else if (action === "settings") {
    ui.settingsReturn = ui.screen;
    ui.screen = "settings";
    ui.selection = 0;
  } else if (action === "back") {
    ui.screen = ui.settingsReturn;
    ui.selection = 0;
  } else if (action === "title") {
    ui.screen = "title";
    ui.selection = 0;
  }
}

function press(control) {
  audio.unlock();
  if (control === "mute") { toggleSound(); return; }
  if (control === "pause") {
    if (ui.screen === "play" || ui.screen === "banner") { ui.screen = "pause"; ui.selection = 0; }
    else if (ui.screen === "pause") ui.screen = "play";
    else if (ui.screen === "settings") { ui.screen = ui.settingsReturn; ui.selection = 0; }
    return;
  }
  if (control === "restart" && ["play", "banner", "pause", "clear"].includes(ui.screen)) { start(); return; }
  const actions = menuActions(ui.screen);
  if (actions) {
    const count = actions.length;
    if (control === "up") ui.selection = (ui.selection + count - 1) % count;
    if (control === "down") ui.selection = (ui.selection + 1) % count;
    if (control === "jump" || control === "select") choose();
    return;
  }
  if (control === "up" || control === "jump") jumpQueued = true;
}

window.addEventListener("keydown", (event) => {
  if (!controlled.has(event.code)) return;
  event.preventDefault();
  held.add(event.code);
  if (!event.repeat) press(controls[event.code]);
});
window.addEventListener("keyup", (event) => held.delete(event.code));
function clearInput() { held.clear(); touchPointers.clear(); jumpQueued = false; }
window.addEventListener("blur", clearInput);
document.addEventListener("visibilitychange", () => { if (document.hidden) clearInput(); });

document.querySelectorAll("#touch-controls button").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    const control = button.dataset.control;
    touchPointers.set(event.pointerId, control);
    press(control);
  });
  const release = (event) => touchPointers.delete(event.pointerId);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});

// 터치로 메뉴 항목을 직접 눌러 고른다 (렌더러가 그린 위치를 게임 좌표로 비교)
canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch" && !ui.touch) { ui.touch = true; fit(); }
  if (!menuActions(ui.screen)) return;
  const box = canvas.getBoundingClientRect();
  const x = (event.clientX - box.left) * (canvas.width / box.width);
  const y = (event.clientY - box.top) * (canvas.height / box.height);
  const hit = menuHitboxes.find((item) => x >= item.x && x < item.x + item.width && y >= item.y && y < item.y + item.height);
  if (!hit) return;
  event.preventDefault();
  audio.unlock();
  ui.selection = hit.index;
  choose();
});

// 터치 가로 화면에서 버튼이 게임을 가리지 않도록, 옆 여백이 버튼 폭(132px)만큼 남게 조금 줄인다.
// 너무 작아지면(원래의 80% 미만) 줄이지 않고 버튼을 게임 위에 반투명으로 겹친다.
const SIDE_CONTROLS = 132;
function fit() {
  let raw = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height);
  const touchLandscape = ui.touch && window.innerWidth > window.innerHeight;
  let side = false;
  if (touchLandscape) {
    const reserved = Math.min((window.innerWidth - SIDE_CONTROLS * 2) / canvas.width, window.innerHeight / canvas.height);
    if ((window.innerWidth - canvas.width * raw) / 2 >= SIDE_CONTROLS) side = true;
    else if (reserved >= raw * 0.8) { raw = reserved; side = true; }
  }
  document.body.classList.toggle("controls-side", touchLandscape && side);
  document.body.classList.toggle("controls-overlay", touchLandscape && !side);
  const scale = canvasScale(raw, ui.compact);
  if (touchLandscape && !side && (window.innerWidth - canvas.width * scale) / 2 >= SIDE_CONTROLS) {
    document.body.classList.add("controls-side");
    document.body.classList.remove("controls-overlay");
  }
  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;
  // 터치 버튼이 게임 화면을 기준으로 자리 잡도록 위치를 CSS에 알린다 (HUD 한 줄 = 게임 24px)
  const box = canvas.getBoundingClientRect();
  const style = document.documentElement.style;
  style.setProperty("--game-hud-bottom", `${Math.round(box.top + 24 * scale)}px`);
  style.setProperty("--game-right-gap", `${Math.round(window.innerWidth - box.right)}px`);
}
window.addEventListener("resize", fit);

const tick = 1000 / 60;
let previous = 0;
let accumulated = 0;
function frame(now) {
  accumulated = Math.min(accumulated + (previous ? now - previous : 0), tick * 5);
  previous = now;
  while (accumulated >= tick) {
    if (ui.screen === "banner") {
      ui.bannerTime -= 1 / 60;
      if (ui.bannerTime <= 0) { ui.screen = "play"; announce("status.playing"); }
    } else if (ui.screen === "play") {
      const result = step(game, {
        left: held.has("ArrowLeft") || held.has("KeyA") || touchHeld("left"),
        right: held.has("ArrowRight") || held.has("KeyD") || touchHeld("right"),
        jumpPressed: jumpQueued,
        jumpHeld: held.has("Space") || held.has("ArrowUp") || held.has("KeyW") || touchHeld("jump") || touchHeld("up"),
      });
      game.events.forEach((event) => audio.play(event));
      jumpQueued = false;
      if (result === "restart") announce("status.restarted");
      if (result === "checkpoint") announce("checkpoint.reached");
      if (result === "cleared") { ui.screen = "clear"; ui.selection = 0; announce("status.cleared"); }
    }
    accumulated -= tick;
  }
  render(ctx, game, ui);
  requestAnimationFrame(frame);
}

async function boot() {
  await loadLocale();
  await Promise.all([
    preloadAssets(),
    document.fonts.load("400 12px PSPixel11"),
    document.fonts.load("700 12px PSPixel11"),
    document.fonts.load("400 10px PSPixel9"),
  ]);
  document.title = t("game.title");
  canvas.setAttribute("aria-label", t("game.canvasLabel"));
  document.querySelector("#touch-controls").setAttribute("aria-label", t("touch.controls"));
  document.querySelectorAll("#touch-controls button").forEach((button) => {
    button.setAttribute("aria-label", t(button.dataset.label));
    if (button.dataset.text) button.textContent = t(button.dataset.text);
  });
  updateMuteButton();
  document.querySelectorAll("p[data-text]").forEach((el) => { el.textContent = t(el.dataset.text); });
  fit();
  announce("game.title");
  requestAnimationFrame(frame);
}
boot();
