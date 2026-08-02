/** Lightweight synthesized SFX (no asset files). */

let ctx: AudioContext | null = null;

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function beep(
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.08
) {
  try {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(c.destination);
    const t = c.currentTime;
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t);
    o.stop(t + dur);
  } catch {
    /* autoplay policy */
  }
}

export const sfx = {
  ok: () => beep(520, 0.08, "triangle", 0.06),
  build: () => {
    beep(180, 0.1, "square", 0.04);
    setTimeout(() => beep(240, 0.1, "square", 0.04), 80);
  },
  trade: () => beep(660, 0.12, "sine", 0.07),
  warn: () => beep(140, 0.18, "sawtooth", 0.05),
  chat: () => beep(880, 0.05, "sine", 0.03),
};
