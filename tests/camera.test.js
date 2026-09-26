import test from "node:test";
import assert from "node:assert/strict";
import { advanceCamera } from "../src/camera.js";

const dt = 1 / 60;
const camera = (state, player, moving = true) => advanceCamera(state, player, 1200, 480, dt, moving);

test("alternating direction every 0.2 seconds keeps the camera steady", () => {
  const state = { cam: null };
  const player = { x: 500, width: 10, vx: 0, face: 1 };
  camera(state, player);
  const positions = [];
  for (let frame = 0; frame < 144; frame++) {
    const direction = Math.floor(frame / 12) % 2 ? -1 : 1;
    player.face = direction;
    player.vx += Math.sign(direction * 155 - player.vx) * Math.min(Math.abs(direction * 155 - player.vx), 1800 * dt);
    player.x += player.vx * dt;
    positions.push(camera(state, player));
  }
  assert.ok(Math.max(...positions) - Math.min(...positions) <= 8);
  assert.equal(state.look, 24);
});

test("a sustained reversal changes the look over at least 1.5 seconds", () => {
  const state = { cam: null };
  const player = { x: 500, width: 10, vx: 155, face: 1 };
  camera(state, player);
  for (let frame = 0; frame < 40; frame++) { player.x += player.vx * dt; camera(state, player); }
  player.face = -1;
  player.vx = -155;
  for (let frame = 0; frame < 17; frame++) { player.x += player.vx * dt; camera(state, player); }
  assert.equal(state.look, 24);
  player.x += player.vx * dt;
  camera(state, player);
  assert.ok(state.look < 24);
  for (let frame = 18; frame < 108; frame++) { player.x += player.vx * dt; camera(state, player); }
  assert.ok(state.look > -24);
  for (let frame = 108; frame < 114; frame++) { player.x += player.vx * dt; camera(state, player); }
  assert.equal(state.look, -24);
});

test("standing turn, pause, and respawn do not move the camera unexpectedly", () => {
  const state = { cam: null };
  const player = { x: 500, width: 10, vx: 0, face: 1 };
  const original = camera(state, player);
  player.face = -1;
  for (let frame = 0; frame < 60; frame++) camera(state, player);
  assert.equal(camera(state, player), original);
  assert.equal(state.look, 24);
  player.x = 600;
  assert.equal(camera(state, player, false), original);
  state.cam = null;
  assert.equal(camera(state, player), 341);
  assert.equal(state.look, -24);
});
