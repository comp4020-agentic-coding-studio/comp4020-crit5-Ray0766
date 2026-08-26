// WebAudio only, no assets. The context can't exist until a user gesture
// unlocks it (browsers block autoplay), so unlock() is a no-op after the
// first call and everything else here quietly does nothing before that.
const MASTER_VOLUME = 0.5;
const SHOOT_THROTTLE_SECONDS = 0.07;
const SILENCE_FLOOR = 0.0001;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function unlockAudio(): void {
  if (ctx) return;
  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;
  ctx = new AudioCtor();
  master = ctx.createGain();
  master.gain.value = MASTER_VOLUME;
  master.connect(ctx.destination);
}

function tone(
  type: OscillatorType,
  freqFrom: number,
  freqTo: number,
  duration: number,
  volume: number,
  startDelay = 0,
): void {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + startDelay;
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + duration);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, t0 + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noise(duration: number, volume: number, startDelay = 0): void {
  if (!ctx || !master) return;
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + startDelay;
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, t0 + duration);
  source.connect(gain);
  gain.connect(master);
  source.start(t0);
  source.stop(t0 + duration + 0.02);
}

let lastShootAt = -Infinity;

export function playShoot(level: number): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (t - lastShootAt < SHOOT_THROTTLE_SECONDS) return;
  lastShootAt = t;
  tone("square", 480 + level * 70, 160, 0.06, 0.04);
}

export function playMerge(): void {
  tone("square", 440, 880, 0.1, 0.05);
  tone("square", 660, 1320, 0.14, 0.05, 0.08);
}

export function playKill(): void {
  noise(0.22, 0.08);
  tone("triangle", 220, 45, 0.2, 0.06);
}

export function playCoreHit(): void {
  noise(0.35, 0.1);
  tone("sawtooth", 130, 40, 0.4, 0.07);
}

export function playEnding(): void {
  tone("sawtooth", 330, 80, 0.5, 0.08);
  tone("sawtooth", 165, 40, 0.9, 0.08, 0.3);
}
