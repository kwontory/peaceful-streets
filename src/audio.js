const STORAGE_KEY = "peaceful-streets.sound";

// Each note is [delay, frequency, duration]. Short, quiet tones keep the
// effects audible without covering the game or adding audio downloads.
const effects = {
  jump: [[0, 330, 0.08], [0.035, 440, 0.08]],
  doubleJump: [[0, 440, 0.07], [0.055, 660, 0.12]],
  flower: [[0, 660, 0.06], [0.065, 880, 0.1]],
  checkpoint: [[0, 440, 0.1], [0.11, 554, 0.1], [0.22, 660, 0.15]],
  hurt: [[0, 220, 0.08], [0.07, 165, 0.14]],
  clear: [[0, 523, 0.12], [0.13, 659, 0.12], [0.26, 784, 0.14], [0.41, 1047, 0.28]],
};

export function createAudio(options = {}) {
  const AudioContextClass = options.AudioContextClass ?? globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let storage = options.storage;
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { storage = null; }
  }
  let enabled = true;
  try { enabled = storage?.getItem(STORAGE_KEY) !== "off"; } catch { /* Private browsing may block storage. */ }
  let context = null;

  function unlock() {
    if (!enabled || !AudioContextClass) return;
    try {
      context ??= new AudioContextClass();
      if (context.state === "suspended") context.resume().catch(() => {});
    } catch { context = null; }
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    try { storage?.setItem(STORAGE_KEY, enabled ? "on" : "off"); } catch { /* Sound still works for this session. */ }
    if (enabled) unlock();
    return enabled;
  }

  function play(name) {
    if (!enabled || !effects[name]) return;
    if (!context || context.state !== "running") return;
    const start = context.currentTime;
    for (const [delay, frequency, duration] of effects[name]) {
      const at = start + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = name === "hurt" ? "triangle" : "square";
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.001, at);
      gain.gain.linearRampToValueAtTime(0.025, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(at);
      oscillator.stop(at + duration + 0.01);
    }
  }

  return { unlock, play, setEnabled, isEnabled: () => enabled };
}
