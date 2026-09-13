/** Optional, short, low-volume feedback. No audio context exists until opted in. */
export class Sounds {
  private context: AudioContext | null = null;
  private enabled = false;

  async toggle(): Promise<boolean> {
    this.enabled = !this.enabled;
    if (this.enabled) {
      try {
        this.context ??= new AudioContext();
        await this.context.resume();
      } catch {
        this.enabled = false;
      }
    }
    return this.enabled;
  }

  play(kind: 'click' | 'door' | 'spring'): void {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const duration = kind === 'spring' ? 0.23 : 0.10;
    oscillator.type = kind === 'door' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(kind === 'spring' ? 280 : kind === 'door' ? 120 : 640, now);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'spring' ? 120 : 70, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  dispose(): void {
    void this.context?.close();
  }
}
