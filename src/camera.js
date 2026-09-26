const LOOK_DISTANCE = 24;
const LOOK_SPEED = 30;
const TURN_DELAY = 0.3;
const DEAD_ZONE = 16;
const FOLLOW_RATE = 0.08;

const approach = (value, target, amount) => value < target
  ? Math.min(target, value + amount)
  : Math.max(target, value - amount);

// state.cam = null means a stage start or respawn: snap once, then follow smoothly.
export function advanceCamera(state, player, worldWidth, viewWidth, dt, moving) {
  const limit = Math.max(0, worldWidth - viewWidth);
  const clamp = (x) => Math.max(0, Math.min(limit, x));
  const face = player.face < 0 ? -1 : 1;
  const center = player.x + player.width / 2;

  if (state.cam === null || !Number.isFinite(state.cam)) {
    state.look = face * LOOK_DISTANCE;
    state.lookFace = face;
    state.travelFace = face;
    state.travelTime = 0;
    state.cam = clamp(center + state.look - viewWidth / 2);
    return Math.round(state.cam);
  }
  if (!moving) return Math.round(state.cam);

  // Face changes on a key press, even while standing. Require actual travel in
  // that direction before changing the camera's look direction.
  if (face !== state.travelFace) {
    state.travelFace = face;
    state.travelTime = 0;
  }
  if (player.vx * face > 10) state.travelTime += dt;
  else if (player.vx * face < -10) state.travelTime = 0;

  // Brief reversals should neither change the look nor tug the camera.
  if (state.travelTime < TURN_DELAY) return Math.round(state.cam);
  state.lookFace = face;

  state.look = approach(state.look, state.lookFace * LOOK_DISTANCE, LOOK_SPEED * dt);
  const offset = center + state.look - state.cam - viewWidth / 2;
  const excess = offset > DEAD_ZONE ? offset - DEAD_ZONE : offset < -DEAD_ZONE ? offset + DEAD_ZONE : 0;
  if (excess) {
    const follow = 1 - (1 - FOLLOW_RATE) ** (dt * 60);
    state.cam = clamp(state.cam + excess * follow);
  }
  return Math.round(state.cam);
}
