import test from "node:test";
import assert from "node:assert/strict";
import { createGame, resetStage, step } from "../src/game.js";
import { stage } from "../src/stage.js";

function advance(game, frames, input = {}) {
  let result;
  for (let i = 0; i < frames; i++) result = step(game, input);
  return result;
}

test("player lands, jumps, and returns to the ground", () => {
  const game = createGame();
  advance(game, 20);
  assert.equal(game.grounded, true);
  const groundY = game.player.y;
  step(game, { jumpPressed: true });
  assert.ok(game.player.y < groundY);
  advance(game, 60);
  assert.equal(game.player.y, groundY);
  assert.equal(game.grounded, true);
});

test("a hazard resets the player", () => {
  const game = createGame();
  game.player.x = stage.hazards[0].x;
  game.player.y = 210;
  assert.equal(step(game, {}), "restart");
  assert.deepEqual(game.events, ["hurt"]);
  assert.equal(game.deaths, 1);
  assert.equal(game.player.x, stage.spawn.x);
});

test("checkpoint activates and death immediately respawns there", () => {
  const game = createGame();
  game.player.x = stage.checkpoints[0].x;
  game.player.y = 210;
  assert.equal(step(game, {}), "checkpoint");
  assert.deepEqual(game.events, ["checkpoint"]);
  assert.equal(game.activeCheckpoint, 0);
  assert.deepEqual(game.checkpointsActive, [true, false]);
  game.player.x = stage.hazards[1].x;
  game.player.y = 210;
  assert.equal(step(game, {}), "restart");
  assert.equal(game.player.x, stage.checkpoints[0].spawn.x);
  assert.equal(game.checkpointsActive[0], true);
  resetStage(game);
  assert.equal(game.player.x, stage.spawn.x);
  assert.equal(game.activeCheckpoint, -1);
  assert.deepEqual(game.checkpointsActive, [false, false]);
});

test("flowers stay collected after a checkpoint respawn and reset with the stage", () => {
  const game = createGame();
  game.player.x = stage.flowers[0].x;
  game.player.y = stage.flowers[0].y;
  step(game, {});
  assert.equal(game.flowersCollected[0], true);
  game.player.x = stage.hazards[0].x;
  game.player.y = 210;
  step(game, {});
  assert.equal(game.flowersCollected[0], true);
  resetStage(game);
  assert.equal(game.flowersCollected[0], false);
});

test("moving pot is hazardous and one-way platforms do not block upward jumps", () => {
  const game = createGame();
  game.player.x = game.pot.x;
  game.player.y = stage.pot.y;
  assert.equal(step(game, {}), "restart");
  game.player.x = stage.platforms[0].x;
  game.player.y = stage.platforms[0].y + 12;
  game.player.vy = -100;
  step(game, {});
  assert.ok(game.player.y < stage.platforms[0].y + 12);
});

test("chomper head is hazardous while passing above it is safe", () => {
  const game = createGame();
  game.player.x = game.pot.x + 3;
  game.player.y = 176;
  assert.equal(step(game, {}), "playing");
  game.player.x = game.pot.x + 3;
  game.player.y = 190;
  assert.equal(step(game, {}), "restart");
  assert.equal(game.deaths, 1);
});

test("flowers above the chomper remain clear of its head and collectible", () => {
  for (const index of [6, 7]) {
    const flower = stage.flowers[index];
    assert.ok(flower.y + 9 < stage.pot.y - 21);
    const game = createGame();
    game.player.x = flower.x;
    game.player.y = flower.y;
    assert.equal(step(game, {}), "playing");
    assert.equal(game.flowersCollected[index], true);
  }
});

test("test stage has a reachable route to the goal", () => {
  const game = createGame();
  const jumps = [80, 195, 305, 415, 530, 645, 745, 785];
  const used = new Set();
  let result = "playing";
  for (let i = 0; i < 900 && result !== "cleared"; i++) {
    let jumpPressed = false;
    for (let j = 0; j < jumps.length; j++) {
      if (!used.has(j) && game.player.x >= jumps[j] && game.grounded) {
        used.add(j);
        jumpPressed = true;
        break;
      }
    }
    result = step(game, { right: true, jumpPressed });
  }
  assert.equal(result, "cleared");
  assert.deepEqual(game.events, ["clear"]);
  assert.equal(game.deaths, 0);
  assert.equal(game.activeCheckpoint, 1);
  assert.ok(game.elapsed > 0);
});

test("double jump: one extra jump in the air, restored on landing", () => {
  const game = createGame();
  advance(game, 20);
  step(game, { jumpPressed: true });
  advance(game, 12);
  assert.equal(game.grounded, false);
  const before = game.player.vy;
  step(game, { jumpPressed: true });
  assert.ok(game.player.vy < before, "air jump pushes upward");
  assert.equal(game.airJumpsLeft, 0);
  advance(game, 3);
  const vy = game.player.vy;
  step(game, { jumpPressed: true });
  assert.ok(game.player.vy > vy, "no third jump");
  advance(game, 120);
  assert.equal(game.grounded, true);
  assert.equal(game.airJumpsLeft, 1);
});

test("gameplay events distinguish the two jumps and a collected flower", () => {
  const game = createGame();
  advance(game, 20);
  step(game, { jumpPressed: true });
  assert.deepEqual(game.events, ["jump"]);
  advance(game, 2);
  assert.deepEqual(game.events, [], "events are cleared on the next frame");
  step(game, { jumpPressed: true });
  assert.deepEqual(game.events, ["doubleJump"]);
  game.player.x = stage.flowers[0].x;
  game.player.y = stage.flowers[0].y;
  step(game);
  assert.ok(game.events.includes("flower"));
  step(game);
  assert.ok(!game.events.includes("flower"), "already collected flowers do not chime again");
});

function peakTop(game, { doubleJump = false, holdFrames = Infinity } = {}) {
  advance(game, 20);
  let top = game.player.y;
  step(game, { jumpPressed: true, jumpHeld: true });
  for (let i = 1; i < 90; i++) {
    const press = doubleJump && game.player.vy >= -10 && game.airJumpsLeft > 0;
    step(game, { jumpPressed: press, jumpHeld: i < holdFrames || press });
    top = Math.min(top, game.player.y);
  }
  return top;
}

test("short tap jumps lower than holding the jump", () => {
  const held = peakTop(createGame());
  const tap = peakTop(createGame(), { holdFrames: 4 });
  assert.ok(tap > held + 20, `tap ${tap} should peak well below hold ${held}`);
});

test("bonus flowers need the double jump", () => {
  const bonus = stage.flowers.filter((f) => f.bonus);
  assert.equal(bonus.length, 2);
  const single = peakTop(createGame());
  const double = peakTop(createGame(), { doubleJump: true });
  for (const f of bonus) {
    assert.ok(single > f.y + 9, "single jump must not reach");
    assert.ok(double < f.y + 9, "double jump reaches");
  }
});

test("bonus flowers are reachable with a running double jump", () => {
  // 꽃 68px 앞에서 달리며 뛰고, 올라가는 속도가 줄어들 때(-100) 2단 점프
  for (const flower of stage.flowers.filter((f) => f.bonus)) {
    const index = stage.flowers.indexOf(flower);
    const game = createGame();
    game.player.x = Math.max(0, flower.x - 100);
    game.player.y = 210;
    let jumped = false, doubled = false, airborne = false;
    for (let i = 0; i < 160; i++) {
      let press = false;
      if (!jumped && game.grounded && game.player.x >= flower.x - 68) press = jumped = true;
      else if (jumped && !doubled && !game.grounded && game.player.vy >= -100) press = doubled = true;
      step(game, { right: true, jumpPressed: press, jumpHeld: true });
      if (!game.grounded) airborne = true;
      if (jumped && airborne && game.grounded) break;
    }
    assert.equal(game.flowersCollected[index], true, `flower at x=${flower.x}`);
    assert.equal(game.deaths, 0);
  }
});
