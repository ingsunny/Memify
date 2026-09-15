// Focus sound is synthesised in the browser rather than streamed.
//
// This is a deliberate product decision: external audio would need a CDN
// the production CSP blocks (connectSrc is 'self'), would carry licensing
// obligations for a commercial product, and would break offline. Shaped
// noise and soft tones cost nothing, cannot 404, and are the sounds this
// category actually uses for concentration.
export type TrackId = "rain" | "brown" | "waves" | "night" | "hum";

export type Track = {
  id: TrackId;
  name: string;
  detail: string;
  pro: boolean;
};

export const tracks: Track[] = [
  {
    id: "rain",
    name: "Rainfall",
    detail: "Steady, soft, no thunder",
    pro: false,
  },
  { id: "brown", name: "Brown noise", detail: "Deep and even", pro: false },
  { id: "waves", name: "Slow waves", detail: "Long tidal swells", pro: true },
  { id: "night", name: "Night air", detail: "Distant, airy hiss", pro: true },
  { id: "hum", name: "Warm hum", detail: "Low drone under noise", pro: true },
];

const noiseBuffer = (ctx: AudioContext, kind: "white" | "brown") => {
  const length = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === "brown") {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
};

export class FocusAudio {
  private ctx: AudioContext | null = null;
  private nodes: AudioNode[] = [];
  private gain: GainNode | null = null;
  current: TrackId | null = null;

  private stopNodes() {
    for (const n of this.nodes) {
      try {
        (n as AudioBufferSourceNode).stop?.();
      } catch {
        /* already stopped */
      }
      n.disconnect();
    }
    this.nodes = [];
  }

  async play(id: TrackId, volume: number) {
    this.ctx ||= new AudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.stopNodes();
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = volume;
    out.connect(ctx.destination);
    this.gain = out;

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(
      ctx,
      id === "brown" || id === "waves" ? "brown" : "white",
    );
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    if (id === "rain") {
      filter.type = "bandpass";
      filter.frequency.value = 1100;
      filter.Q.value = 0.6;
    } else if (id === "brown") {
      filter.type = "lowpass";
      filter.frequency.value = 500;
    } else if (id === "waves") {
      filter.type = "lowpass";
      filter.frequency.value = 420;
      // A slow LFO on the gain gives the noise a tidal swell.
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 0.08;
      depth.gain.value = volume * 0.55;
      lfo.connect(depth).connect(out.gain);
      lfo.start();
      this.nodes.push(lfo, depth);
    } else if (id === "night") {
      filter.type = "highpass";
      filter.frequency.value = 2400;
    } else {
      filter.type = "lowpass";
      filter.frequency.value = 700;
      const drone = ctx.createOscillator();
      const droneGain = ctx.createGain();
      drone.type = "sine";
      drone.frequency.value = 96;
      droneGain.gain.value = volume * 0.16;
      drone.connect(droneGain).connect(out);
      drone.start();
      this.nodes.push(drone, droneGain);
    }
    source.connect(filter).connect(out);
    source.start();
    this.nodes.push(source, filter);
    this.current = id;
  }

  setVolume(volume: number) {
    if (this.gain) this.gain.gain.value = volume;
  }

  stop() {
    this.stopNodes();
    this.current = null;
  }

  // A short chime at the end of a Pomodoro interval.
  async chime() {
    this.ctx ||= new AudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    for (const [i, freq] of [660, 880].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.7);
    }
  }
}
