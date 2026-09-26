import test from "node:test";
import assert from "node:assert/strict";
import { createAudio } from "../src/audio.js";

test("audio starts after a user action and respects the saved mute setting", () => {
  const saved = new Map([["peaceful-streets.sound", "off"]]);
  const storage = {
    getItem: (key) => saved.get(key),
    setItem: (key, value) => saved.set(key, value),
  };
  const instances = [];
  class AudioContextStub {
    constructor() { this.state = "running"; this.currentTime = 0; this.notes = []; instances.push(this); }
    createOscillator() {
      const note = { frequency: { setValueAtTime: (value) => { note.pitch = value; } }, connect: (gain) => gain, start: () => {}, stop: () => {} };
      this.notes.push(note);
      return note;
    }
    createGain() {
      return { gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => this.destination };
    }
  }
  const audio = createAudio({ AudioContextClass: AudioContextStub, storage });
  audio.unlock();
  audio.play("jump");
  assert.equal(instances.length, 0, "saved mute prevents audio initialization");

  audio.setEnabled(true);
  assert.equal(saved.get("peaceful-streets.sound"), "on");
  assert.equal(instances.length, 1);
  audio.play("flower");
  assert.deepEqual(instances[0].notes.map((note) => note.pitch), [660, 880]);

  audio.setEnabled(false);
  audio.play("clear");
  assert.equal(instances[0].notes.length, 2, "muted effects schedule no tones");

  const fresh = createAudio({ AudioContextClass: AudioContextStub, storage: null });
  fresh.play("jump");
  assert.equal(instances.length, 1, "a game frame cannot open audio before user input");
  fresh.unlock();
  fresh.play("jump");
  assert.equal(instances[1].notes.length, 2);
});
