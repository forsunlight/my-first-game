export class GameAudio {
  private context: AudioContext | null = null;
  muted = false;
  unlock() {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended')
        void this.context.resume().catch(() => {});
    } catch {
      /* Audio is optional; combat remains playable. */
    }
  }
  tone(type: 'laser' | 'shot' | 'swing' | 'hit' | 'win' | 'hurt', volume = 1) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.muted) return;
    const osc = ctx.createOscillator(),
      gain = ctx.createGain(),
      now = ctx.currentTime;
    const settings = {
      laser: [760, 210, 0.1],
      shot: [190, 55, 0.1],
      swing: [220, 70, 0.13],
      hit: [1150, 550, 0.055],
      win: [440, 880, 0.45],
      hurt: [95, 45, 0.15],
    }[type];
    osc.type =
      type === 'laser' ? 'sawtooth' : type === 'hit' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(settings[0], now);
    osc.frequency.exponentialRampToValueAtTime(settings[1], now + settings[2]);
    gain.gain.setValueAtTime(0.045 * volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + settings[2]);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + settings[2]);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  dispose() {
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
