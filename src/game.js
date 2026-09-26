import { stage } from "./stage.js";

export const movement = {
  maxSpeed: 155,
  groundAcceleration: 1800,
  airAcceleration: 1100,
  friction: 2000,
  gravity: 950,
  jumpVelocity: -350,
  airJumps: 1,            // 공중에서 한 번 더 뛸 수 있는 횟수 (2단 점프)
  airJumpVelocity: -300,  // 두 번째 점프는 조금 낮게
  jumpCutVelocity: -140,  // 오르는 중에 점프를 떼면 이 속도로 줄여 낮게 뛴다
  coyoteTime: 0.09,
  jumpBufferTime: 0.1,
};

const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);

export function createGame() {
  return {
    player: { x: stage.spawn.x, y: stage.spawn.y, width: 10, height: 14, vx: 0, vy: 0, face: 1, runTime: 0, landedTime: 0 },
    grounded: false,
    coyote: 0,
    jumpBuffer: 0,
    cleared: false,
    deaths: 0,
    elapsed: 0,
    activeCheckpoint: -1,
    checkpointsActive: stage.checkpoints.map(() => false),
    flowersCollected: stage.flowers.map(() => false),
    notification: null,
    notificationTime: 0,
    pot: { x: stage.pot.maxX, dir: -1 },
    airJumpsLeft: movement.airJumps,
    airJumpTime: 0, // 공중 점프 직후 연출용 (초)
    events: [],
  };
}

export function resetPlayer(game) {
  const spawn = game.activeCheckpoint < 0 ? stage.spawn : stage.checkpoints[game.activeCheckpoint].spawn;
  Object.assign(game.player, { x: spawn.x, y: spawn.y, vx: 0, vy: 0, runTime: 0, landedTime: 0 });
  game.grounded = false;
  game.coyote = 0;
  game.jumpBuffer = 0;
  game.cleared = false;
  game.airJumpsLeft = movement.airJumps;
  game.airJumpTime = 0;
}

export function resetStage(game) {
  Object.assign(game, createGame());
}

export function step(game, input = {}, dt = 1 / 60) {
  game.events.length = 0;
  if (game.cleared) return "cleared";
  const p = game.player;
  game.elapsed += dt;
  game.notificationTime = Math.max(0, game.notificationTime - dt);
  if (!game.notificationTime) game.notification = null;

  const direction = Number(Boolean(input.right)) - Number(Boolean(input.left));
  if (direction) p.face = direction;
  const acceleration = game.grounded ? movement.groundAcceleration : movement.airAcceleration;
  p.vx = approach(p.vx, direction * movement.maxSpeed, (direction ? acceleration : movement.friction) * dt);
  game.jumpBuffer = input.jumpPressed ? movement.jumpBufferTime : Math.max(0, game.jumpBuffer - dt);
  game.coyote = game.grounded ? movement.coyoteTime : Math.max(0, game.coyote - dt);
  game.airJumpTime = Math.max(0, game.airJumpTime - dt);
  if (game.jumpBuffer > 0 && game.coyote > 0) {
    p.vy = movement.jumpVelocity;
    game.events.push("jump");
    game.grounded = false;
    game.coyote = 0;
    game.jumpBuffer = 0;
  } else if (input.jumpPressed && !game.grounded && game.airJumpsLeft > 0) {
    // 2단 점프: 땅 점프(코요테 포함)를 못 할 때 공중에서 누르면 한 번 더
    p.vy = movement.airJumpVelocity;
    game.events.push("doubleJump");
    game.airJumpsLeft--;
    game.airJumpTime = 0.3;
    game.jumpBuffer = 0;
  }
  // 짧게 누르면 낮게: jumpHeld 를 넘기지 않으면(테스트 등) 끝까지 누른 것으로 본다
  const jumpHeld = input.jumpHeld ?? true;
  if (!jumpHeld && p.vy < movement.jumpCutVelocity) p.vy = movement.jumpCutVelocity;

  p.x += p.vx * dt;
  for (const solid of stage.solids) {
    if (!overlaps(p, solid)) continue;
    if (p.vx > 0) p.x = solid.x - p.width;
    else if (p.vx < 0) p.x = solid.x + solid.width;
    p.vx = 0;
  }
  p.x = Math.max(0, Math.min(stage.width - p.width, p.x));

  const previousBottom = p.y + p.height;
  const wasGrounded = game.grounded;
  p.vy += movement.gravity * dt;
  p.y += p.vy * dt;
  game.grounded = false;
  for (const solid of stage.solids) {
    if (!overlaps(p, solid)) continue;
    if (p.vy > 0) {
      p.y = solid.y - p.height;
      game.grounded = true;
    } else if (p.vy < 0) p.y = solid.y + solid.height;
    p.vy = 0;
  }
  if (p.vy >= 0) for (const platform of stage.platforms) {
    if (previousBottom > platform.y + 1 || !overlaps(p, platform)) continue;
    p.y = platform.y - p.height;
    p.vy = 0;
    game.grounded = true;
  }
  p.landedTime = game.grounded && !wasGrounded ? 0.12 : Math.max(0, p.landedTime - dt);
  if (game.grounded) game.airJumpsLeft = movement.airJumps;
  p.runTime = game.grounded && Math.abs(p.vx) > 10 ? p.runTime + dt : 0;

  game.pot.x += game.pot.dir * stage.pot.speed * dt;
  if (game.pot.x <= stage.pot.minX) { game.pot.x = stage.pot.minX; game.pot.dir = 1; }
  if (game.pot.x >= stage.pot.maxX) { game.pot.x = stage.pot.maxX; game.pot.dir = -1; }
  // 식인식물 머리와 화분 몸통을 함께 판정하되, 그림 가장자리는 2px 여유를 둔다.
  const potBox = { x: game.pot.x + 2, y: stage.pot.y - 19, width: 12, height: stage.pot.height + 19 };

  if (stage.hazards.some((hazard) => overlaps(p, hazard)) || overlaps(p, potBox) || p.y > stage.height + 24) {
    game.events.push("hurt");
    game.deaths++;
    resetPlayer(game);
    return "restart";
  }

  let reachedCheckpoint = false;
  stage.checkpoints.forEach((checkpoint, index) => {
    if (overlaps(p, checkpoint) && !game.checkpointsActive[index]) {
      game.checkpointsActive[index] = true;
      game.activeCheckpoint = index;
      game.notification = "checkpoint.reached";
      game.notificationTime = 1.5;
      game.events.push("checkpoint");
      reachedCheckpoint = true;
    }
  });
  stage.flowers.forEach((flower, index) => {
    if (!game.flowersCollected[index] && overlaps(p, { ...flower, width: 9, height: 9 })) {
      game.flowersCollected[index] = true;
      game.events.push("flower");
    }
  });
  if (overlaps(p, stage.goal)) {
    game.cleared = true;
    game.events.push("clear");
    return "cleared";
  }
  return reachedCheckpoint ? "checkpoint" : "playing";
}
