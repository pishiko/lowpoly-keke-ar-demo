export class PlushAudio {
  constructor() { this.enabled = true; this.context = null; }
  unlock() {
    if (!this.enabled) return;
    try {
      this.context ??= new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    } catch { /* The rest of the app also works without an audio device. */ }
  }
  setEnabled(enabled) { this.enabled = enabled; if (enabled) this.unlock(); else this.context?.suspend().catch(() => {}); }
  play(name) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const sounds = { step: [260, 125, 0.12, 0.045], squish: [620, 155, 0.3, 0.12], jump: [280, 850, 0.28, 0.1], land: [150, 55, 0.19, 0.13], fall: [420, 120, 0.38, 0.09], getup: [200, 500, 0.35, 0.08], spin: [440, 1000, 0.4, 0.07], shutter: [1400, 300, 0.06, 0.045], recall: [400, 700, 0.2, 0.08] };
    const [start, end, duration, volume] = sounds[name] ?? sounds.squish;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = name === 'shutter' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain); gain.connect(this.context.destination);
    oscillator.start(now); oscillator.stop(now + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
