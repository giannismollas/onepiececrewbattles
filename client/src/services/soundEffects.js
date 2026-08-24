// Web Audio API procedural sound synthesizer for pirate naval battles

class SoundEffectsManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volume = 0.6;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.muted = muted;
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
  }

  playCannon() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    
    // Sub-bass boom
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);

    gain.gain.setValueAtTime(0.8 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.6);

    // Noise blast
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + 0.5);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9 * this.volume, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);
    noise.stop(t + 0.5);
  }

  playBallista() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.25);

    gain.gain.setValueAtTime(0.6 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  playCatapult() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Launch whoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.2);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.5);

    gain.gain.setValueAtTime(0.5 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  playShieldClang() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const freqs = [520, 840, 1260, 1680];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      const initVol = (0.4 / (idx + 1)) * this.volume;
      gain.gain.setValueAtTime(initVol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  playEngineHit() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    this.playCannon();
    // Extra metallic crunch
    setTimeout(() => {
      this.playShieldClang();
    }, 80);
  }

  playDiceRoll() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const clicks = 6;
    for (let i = 0; i < clicks; i++) {
      setTimeout(() => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(300 + Math.random() * 400, t);

        gain.gain.setValueAtTime(0.15 * this.volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.04);
      }, i * 60 + Math.random() * 20);
    }
  }

  playTurnChime() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [440, 659.25];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.3 * this.volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.35);
      }, i * 140);
    });
  }

  playRepair() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [330, 440, 554.37, 659.25];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.25 * this.volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      }, i * 90);
    });
  }

  playVictory() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const fanfare = [
      { f: 523.25, d: 0.15 }, // C5
      { f: 659.25, d: 0.15 }, // E5
      { f: 783.99, d: 0.15 }, // G5
      { f: 1046.50, d: 0.45 } // C6
    ];

    let delay = 0;
    fanfare.forEach((note) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.f, t);

        gain.gain.setValueAtTime(0.45 * this.volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + note.d);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + note.d);
      }, delay);
      delay += note.d * 900;
    });
  }

  playDefeat() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const sorrow = [
      { f: 392.00, d: 0.25 }, // G4
      { f: 349.23, d: 0.25 }, // F4
      { f: 329.63, d: 0.25 }, // E4
      { f: 293.66, d: 0.60 }  // D4
    ];

    let delay = 0;
    sorrow.forEach((note) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(note.f, t);

        gain.gain.setValueAtTime(0.3 * this.volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + note.d);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + note.d);
      }, delay);
      delay += note.d * 900;
    });
  }

  playButtonClick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.03);

    gain.gain.setValueAtTime(0.15 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.03);
  }
}

export const soundEffects = new SoundEffectsManager();
