/**
 * Zero-asset Web Audio API ambient reading soundscapes synthesizer.
 * Runs 100% offline with 0KB downloaded audio files.
 */

class SoundscapeSynthesizer {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.isPlaying = false;
    this.activeType = null;
    this.volume = 0.5;
    this.cleanupNodes = [];
    this.listeners = new Set();
  }

  init() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }

  getState() {
    return {
      isPlaying: this.isPlaying,
      activeType: this.activeType,
      volume: this.volume,
    };
  }

  setVolume(val) {
    const clamped = Math.max(0, Math.min(1, val));
    this.volume = clamped;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(clamped, this.audioCtx.currentTime, 0.05);
    }
    this.notify();
  }

  stop() {
    this.cleanupNodes.forEach((node) => {
      try {
        if (typeof node.stop === "function") node.stop();
        if (typeof node.disconnect === "function") node.disconnect();
      } catch {
        // Ignored
      }
    });
    this.cleanupNodes = [];
    this.isPlaying = false;
    this.activeType = null;
    this.notify();
  }

  play(type) {
    if (this.isPlaying && this.activeType === type) {
      this.stop();
      return;
    }

    this.stop();
    this.init();
    if (!this.audioCtx || !this.masterGain) return;

    this.activeType = type;
    this.isPlaying = true;

    if (type === "rain") {
      this.startRain();
    } else if (type === "fireplace") {
      this.startFireplace();
    } else if (type === "library") {
      this.startLibrary();
    }

    this.notify();
  }

  // Generate pink noise buffer
  createPinkNoiseBuffer(seconds = 3) {
    const bufferSize = this.audioCtx.sampleRate * seconds;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  startRain() {
    // Continuous rain noise loop
    const noiseBuffer = this.createPinkNoiseBuffer(4);
    const source = this.audioCtx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    // Filter to simulate falling rain
    const lowpass = this.audioCtx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(850, this.audioCtx.currentTime);

    const highpass = this.audioCtx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(250, this.audioCtx.currentTime);

    // Subtle gentle swell modulation
    const lfo = this.audioCtx.createOscillator();
    lfo.frequency.setValueAtTime(0.2, this.audioCtx.currentTime);
    const lfoGain = this.audioCtx.createGain();
    lfoGain.gain.setValueAtTime(150, this.audioCtx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(lowpass.frequency);

    const rainGain = this.audioCtx.createGain();
    rainGain.gain.setValueAtTime(0.7, this.audioCtx.currentTime);

    source.connect(lowpass);
    lowpass.connect(highpass);
    highpass.connect(rainGain);
    rainGain.connect(this.masterGain);

    source.start();
    lfo.start();

    this.cleanupNodes.push(source, lfo, lfoGain, lowpass, highpass, rainGain);
  }

  startFireplace() {
    // Low rumble base
    const noiseBuffer = this.createPinkNoiseBuffer(4);
    const rumbleSource = this.audioCtx.createBufferSource();
    rumbleSource.buffer = noiseBuffer;
    rumbleSource.loop = true;

    const lowpass = this.audioCtx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(160, this.audioCtx.currentTime);

    const rumbleGain = this.audioCtx.createGain();
    rumbleGain.gain.setValueAtTime(0.9, this.audioCtx.currentTime);

    rumbleSource.connect(lowpass);
    lowpass.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);
    rumbleSource.start();

    // Wood crackle impulses generator
    const crackleInterval = setInterval(() => {
      if (!this.isPlaying || this.activeType !== "fireplace" || !this.audioCtx) return;
      if (Math.random() < 0.45) {
        try {
          const crackBuffer = this.audioCtx.createBuffer(1, Math.floor(this.audioCtx.sampleRate * 0.015), this.audioCtx.sampleRate);
          const data = crackBuffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.25));
          }
          const crackSource = this.audioCtx.createBufferSource();
          crackSource.buffer = crackBuffer;

          const crackGain = this.audioCtx.createGain();
          const popVolume = 0.2 + Math.random() * 0.5;
          crackGain.gain.setValueAtTime(popVolume, this.audioCtx.currentTime);

          const bandpass = this.audioCtx.createBiquadFilter();
          bandpass.type = "bandpass";
          bandpass.frequency.setValueAtTime(1200 + Math.random() * 1800, this.audioCtx.currentTime);
          bandpass.Q.setValueAtTime(2, this.audioCtx.currentTime);

          crackSource.connect(bandpass);
          bandpass.connect(crackGain);
          crackGain.connect(this.masterGain);

          crackSource.start();
        } catch {
          // Ignored
        }
      }
    }, 120);

    this.cleanupNodes.push(rumbleSource, lowpass, rumbleGain, {
      stop: () => clearInterval(crackleInterval),
      disconnect: () => {},
    });
  }

  startLibrary() {
    // Warm low-frequency ambient murmurs
    const noiseBuffer = this.createPinkNoiseBuffer(5);
    const source = this.audioCtx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const lowpass = this.audioCtx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(420, this.audioCtx.currentTime);

    // Warm resonant tone (hum)
    const humOsc = this.audioCtx.createOscillator();
    humOsc.type = "sine";
    humOsc.frequency.setValueAtTime(110, this.audioCtx.currentTime); // Low A

    const humGain = this.audioCtx.createGain();
    humGain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);

    const libGain = this.audioCtx.createGain();
    libGain.gain.setValueAtTime(0.4, this.audioCtx.currentTime);

    source.connect(lowpass);
    lowpass.connect(libGain);
    libGain.connect(this.masterGain);

    humOsc.connect(humGain);
    humGain.connect(this.masterGain);

    source.start();
    humOsc.start();

    this.cleanupNodes.push(source, lowpass, humOsc, humGain, libGain);
  }
}

export const soundscapes = new SoundscapeSynthesizer();
