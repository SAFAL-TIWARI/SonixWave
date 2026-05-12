class FxModule {
  public input: GainNode;
  public output: GainNode;
  public wetGain: GainNode;
  public dryGain: GainNode;

  constructor(ctx: AudioContext, processChain: { in: AudioNode; out: AudioNode }) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();

    this.wetGain.gain.value = 0;
    this.dryGain.gain.value = 1;

    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);

    this.input.connect(processChain.in);
    processChain.out.connect(this.wetGain);
    this.wetGain.connect(this.output);
  }

  setMix(amount: number) {
    // amount from 0 to 1
    const ctx = this.wetGain.context;
    this.wetGain.gain.setTargetAtTime(amount, ctx.currentTime, 0.05);
    this.dryGain.gain.setTargetAtTime(1 - amount, ctx.currentTime, 0.05);
  }
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private suppressLocalAudioPlayback = false;

  // DSP Nodes
  public eqBands: BiquadFilterNode[] = [];
  public preampGain: GainNode | null = null;
  public masterGain: GainNode | null = null;
  public compressor: DynamicsCompressorNode | null = null;
  public analyser: AnalyserNode | null = null;

  // State
  private frequencies = [60, 230, 910, 3600, 14000];
  private isBypassed = false;
  private currentEqGains: number[] = [0, 0, 0, 0, 0];
  private currentMasterGain: number = 1.0; // 1.0 = 100%, 10.0 = 1000%
  private isClipping = false;

  // Effects State
  public fxModules: Record<string, FxModule> = {};
  public fxState = {
    distortion: 0,
    chorus: 0,
    delay: 0,
    reverb: 0,
  };

  constructor() {}

  public setSourcePlaybackMuted(muted: boolean) {
    this.suppressLocalAudioPlayback = muted;

    if (!this.stream) return;

    const audioTracks = this.stream.getAudioTracks();
    for (const track of audioTracks) {
      track
        .applyConstraints({
          suppressLocalAudioPlayback: muted,
        } as MediaTrackConstraints)
        .catch((err) => {
          console.warn("Unable to update local source playback suppression", err);
        });
    }
  }

  public async initialize(onStreamError?: () => void) {
    if (this.ctx) return;
    this.ctx = new AudioContext({ latencyHint: "interactive" });

    // Try to get system audio or microphone. For a web prototype, getDisplayMedia allows system audio sharing
    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // required by browsers to prompt for display media
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          suppressLocalAudioPlayback: this.suppressLocalAudioPlayback,
        } as MediaTrackConstraints,
      });
    } catch (e) {
      console.warn("Display media denied, falling back to microphone for testing.");
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      } catch (err) {
        console.error("Audio capture failed", err);
        if (onStreamError) onStreamError();
        return;
      }
    }

    if (!this.stream) return;

  this.setSourcePlaybackMuted(this.suppressLocalAudioPlayback);

    this.source = this.ctx.createMediaStreamSource(this.stream);

    // Build the DSP Chain
    this.preampGain = this.ctx.createGain();
    this.preampGain.gain.value = 1.0;

    // EQ Bands
    this.frequencies.forEach((freq) => {
      if (!this.ctx) return;
      const filter = this.ctx.createBiquadFilter();
      filter.type = freq === 60 ? "lowshelf" : freq === 14000 ? "highshelf" : "peaking";
      filter.frequency.value = freq;
      filter.gain.value = 0;
      this.eqBands.push(filter);
    });

    // Boost/Master Volume
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.currentMasterGain;

    // Limiter (Compressor to prevent harsh digital clipping)
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -3.0; // Engage at -3dB
    this.compressor.knee.value = 0.0; // Hard knee
    this.compressor.ratio.value = 20.0; // Hard wall
    this.compressor.attack.value = 0.002; // Very fast attack
    this.compressor.release.value = 0.1; // 100ms release

    // Analyser for UI visuals and bass-reactive background.
    // Higher FFT size gives better low-frequency resolution (bass separation).
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.82;

    this.initFx();

    this.connectChain();

    // Listen to stream end
    this.stream.getTracks().forEach((track) => {
      track.onended = () => {
        if (onStreamError) onStreamError();
        this.stop();
      };
    });
  }

  private initFx() {
    if (!this.ctx) return;

    // Distortion
    const distNode = this.ctx.createWaveShaper();
    distNode.curve = this.makeDistortionCurve(50);
    distNode.oversample = '4x';
    this.fxModules.distortion = new FxModule(this.ctx, { in: distNode, out: distNode });

    // Chorus / Flanger
    const chorusDelay = this.ctx.createDelay();
    chorusDelay.delayTime.value = 0.03;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1.5;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.005;
    osc.connect(lfoGain);
    lfoGain.connect(chorusDelay.delayTime);
    osc.start();
    this.fxModules.chorus = new FxModule(this.ctx, { in: chorusDelay, out: chorusDelay });

    // Delay
    const delayNode = this.ctx.createDelay();
    delayNode.delayTime.value = 0.3;
    const fbGain = this.ctx.createGain();
    fbGain.gain.value = 0.5;
    delayNode.connect(fbGain);
    fbGain.connect(delayNode);
    this.fxModules.delay = new FxModule(this.ctx, { in: delayNode, out: delayNode });

    // Reverb
    const convolver = this.ctx.createConvolver();
    convolver.buffer = this.createReverbIR(this.ctx, 2.5, 3);
    this.fxModules.reverb = new FxModule(this.ctx, { in: convolver, out: convolver });
  }

  private makeDistortionCurve(amount: number) {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private createReverbIR(ctx: AudioContext, duration: number, decay: number) {
    const length = ctx.sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let i = 0; i < length; i++) {
        const d = Math.pow(1 - i / length, decay);
        impulse.getChannelData(0)[i] = (Math.random() * 2 - 1) * d;
        impulse.getChannelData(1)[i] = (Math.random() * 2 - 1) * d;
    }
    return impulse;
  }

  private connectChain() {
    if (
      !this.source ||
      !this.preampGain ||
      !this.masterGain ||
      !this.compressor ||
      !this.analyser ||
      !this.ctx
    )
      return;

    this.source.disconnect();
    this.eqBands.forEach((b) => b.disconnect());
    this.preampGain.disconnect();
    this.masterGain.disconnect();
    this.compressor.disconnect();
    this.analyser.disconnect();

    if (this.isBypassed) {
      // Just passthrough
      this.source.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    } else {
      // Source -> Preamp -> EQ -> FX -> Enhancer/MasterGain -> Limiter -> Analyser -> Output
      this.source.connect(this.preampGain);

      let prevNode: AudioNode = this.preampGain;
      for (const eqNode of this.eqBands) {
        prevNode.connect(eqNode);
        prevNode = eqNode;
      }

      // Connect FX
      const fxChain = ['distortion', 'chorus', 'delay', 'reverb'];
      for (const fxName of fxChain) {
        const fx = this.fxModules[fxName];
        if (fx) {
          prevNode.connect(fx.input);
          prevNode = fx.output;
        }
      }

      prevNode.connect(this.masterGain);
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
  }

  public setBypass(bypassed: boolean) {
    this.isBypassed = bypassed;
    this.connectChain();
  }

  public setMasterBoost(percentage: number) {
    // percentage: 0 to 1000
    this.currentMasterGain = percentage / 100;
    if (this.masterGain) {
      // Smooth transition to avoid pops
      this.masterGain.gain.setTargetAtTime(
        this.currentMasterGain,
        this.ctx!.currentTime,
        0.05
      );
    }
  }

  public setEqBand(index: number, dbGain: number) {
    if (this.eqBands[index]) {
      this.currentEqGains[index] = dbGain;
      this.eqBands[index].gain.setTargetAtTime(dbGain, this.ctx!.currentTime, 0.05);
    }
  }

  public setFxAmount(fxName: keyof typeof this.fxState, amount: number) {
    this.fxState[fxName] = amount;
    if (this.fxModules[fxName]) {
      this.fxModules[fxName].setMix(amount / 100);
    }
  }

  public getVisualData(dataArray: Uint8Array<ArrayBuffer>): {
    clipping: boolean;
    peakReduction: number;
  } {
    if (!this.analyser || !this.compressor || !this.ctx)
      return { clipping: false, peakReduction: 0 };

    this.analyser.getByteFrequencyData(dataArray);

    // Simple clipping detection (if signal is hitting 0dB closely before limiter)
    // Actually, compressor reduction is a great metric
    const reduction = this.compressor.reduction; // This is a float in dB (0 to negative)

    // Safari / Older browsers reduction is an AudioParam instead of a number
    const reductionValue =
      typeof reduction === "number" ? reduction : (reduction as any).value || 0;

    const isClipping = reductionValue <= -1.0;

    return {
      clipping: isClipping,
      peakReduction: reductionValue,
    };
  }

  public stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.source = null;
    this.eqBands = [];
  }
}

export const audioEngine = new AudioEngine();
