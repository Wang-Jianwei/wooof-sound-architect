/**
 * 音频分析模块
 * 使用 Web Audio API 分析音频文件的音高、音量、时长
 */

export interface AudioAnalysisResult {
  /** 音频时长（秒） */
  duration: number;
  /** 平均音量（0-1） */
  volume: number;
  /** 检测到的音高（Hz），无法检测时返回 null */
  pitch: number | null;
  /** 音高对应的音符名称，无法检测时返回 null */
  note: string | null;
  /** 采样数据 */
  waveformData: Float32Array;
  /** 频谱数据 */
  frequencyData: Uint8Array;
  /** 分析时间戳 */
  analyzedAt: number;
}

export interface AnalysisOptions {
  /** FFT 大小（默认为 2048） */
  fftSize?: number;
  /** 平滑时间常数（0-1，默认为 0.8） */
  smoothingTimeConstant?: number;
  /** 音高检测的最小频率（Hz，默认为 50） */
  minFrequency?: number;
  /** 音高检测的最大频率（Hz，默认为 5000） */
  maxFrequency?: number;
}

export class AudioAnalyzer {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private options: Required<AnalysisOptions>;

  /**
   * 音符频率映射（A4 = 440Hz）
   */
  private static readonly NOTE_NAMES = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ];

  constructor(audioContext: AudioContext, options: AnalysisOptions = {}) {
    this.audioContext = audioContext;
    this.options = {
      fftSize: options.fftSize ?? 2048,
      smoothingTimeConstant: options.smoothingTimeConstant ?? 0.8,
      minFrequency: options.minFrequency ?? 50,
      maxFrequency: options.maxFrequency ?? 5000,
    };

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.options.fftSize;
    this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant;
  }

  /**
   * 从文件创建音频缓冲区
   */
  async loadAudioFile(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    return this.audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * 从 URL 创建音频缓冲区
   */
  async loadAudioFromUrl(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return this.audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * 分析音频缓冲区
   */
  async analyze(audioBuffer: AudioBuffer): Promise<AudioAnalysisResult> {
    const duration = audioBuffer.duration;

    // 创建源节点
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;

    // 连接到分析器
    source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    // 准备数据数组
    const waveformData = new Float32Array(this.analyser.fftSize);
    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

    // 播放并立即采样（用于分析）
    source.start(0);

    // 等待一小段时间以确保数据可用，然后暂停
    await new Promise((resolve) => setTimeout(resolve, 50));
    source.stop();

    // 获取波形数据
    this.analyser.getFloatTimeDomainData(waveformData);

    // 获取频谱数据
    this.analyser.getByteFrequencyData(frequencyData);

    // 计算音量
    const volume = this.calculateVolume(waveformData);

    // 检测音高
    const pitch = this.detectPitch(waveformData);
    const note = pitch ? this.frequencyToNote(pitch) : null;

    return {
      duration,
      volume,
      pitch,
      note,
      waveformData: waveformData.slice(),
      frequencyData: frequencyData.slice(),
      analyzedAt: Date.now(),
    };
  }

  /**
   * 快速分析：仅分析音频的特定片段
   */
  analyzeSegment(
    audioBuffer: AudioBuffer,
    startTime: number,
    duration: number
  ): AudioAnalysisResult {
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.min(
      startSample + Math.floor(duration * sampleRate),
      audioBuffer.length
    );

    // 获取音频数据（使用左声道或单声道）
    const channelData =
      audioBuffer.numberOfChannels > 1
        ? this.mixChannels(audioBuffer)
        : audioBuffer.getChannelData(0);

    const segmentData = channelData.slice(startSample, endSample);

    // 计算音量
    const volume = this.calculateVolume(segmentData);

    // 检测音高
    const pitch = this.detectPitch(segmentData);
    const note = pitch ? this.frequencyToNote(pitch) : null;

    // 获取频谱数据
    const frequencyData = this.calculateSpectrum(segmentData, sampleRate);

    return {
      duration: audioBuffer.duration,
      volume,
      pitch,
      note,
      waveformData: segmentData,
      frequencyData,
      analyzedAt: Date.now(),
    };
  }

  /**
   * 实时分析当前播放的音频
   */
  analyzeRealtime(): Omit<AudioAnalysisResult, 'duration'> {
    const waveformData = new Float32Array(this.analyser.fftSize);
    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

    // 获取当前波形数据
    this.analyser.getFloatTimeDomainData(waveformData);

    // 获取当前频谱数据
    this.analyser.getByteFrequencyData(frequencyData);

    // 计算音量
    const volume = this.calculateVolume(waveformData);

    // 检测音高
    const pitch = this.detectPitch(waveformData);
    const note = pitch ? this.frequencyToNote(pitch) : null;

    return {
      volume,
      pitch,
      note,
      waveformData: waveformData.slice(),
      frequencyData: frequencyData.slice(),
      analyzedAt: Date.now(),
    };
  }

  /**
   * 计算音量（RMS - Root Mean Square）
   */
  private calculateVolume(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / data.length);
    // 归一化到 0-1 范围
    return Math.min(rms * Math.sqrt(2), 1);
  }

  /**
   * 使用自相关算法检测音高
   */
  private detectPitch(data: Float32Array): number | null {
    const sampleRate = this.audioContext.sampleRate;
    const bufferSize = data.length;

    // 自相关计算
    const autocorr = new Float32Array(bufferSize);
    for (let lag = 0; lag < bufferSize; lag++) {
      let sum = 0;
      for (let i = 0; i < bufferSize - lag; i++) {
        sum += data[i] * data[i + lag];
      }
      autocorr[lag] = sum;
    }

    // 找到第一个峰值（跳过lag=0的最大值）
    let maxVal = -Infinity;
    let maxLag = -1;

    const minLag = Math.floor(sampleRate / this.options.maxFrequency);
    const maxAllowedLag = Math.floor(sampleRate / this.options.minFrequency);

    for (let lag = minLag; lag < Math.min(maxAllowedLag, bufferSize); lag++) {
      // 检查是否为局部峰值
      if (
        autocorr[lag] > autocorr[lag - 1] &&
        autocorr[lag] > autocorr[lag + 1] &&
        autocorr[lag] > maxVal
      ) {
        // 使用抛物线插值提高精度
        const alpha = autocorr[lag - 1];
        const beta = autocorr[lag];
        const gamma = autocorr[lag + 1];
        const peakOffset = (alpha - gamma) / (2 * (alpha - 2 * beta + gamma));
        const refinedLag = lag + peakOffset;

        maxVal = beta;
        maxLag = refinedLag;
        break; // 使用第一个有效峰值
      }
    }

    if (maxLag <= 0) {
      return null;
    }

    // 计算频率
    const frequency = sampleRate / maxLag;

    // 过滤不合理的频率
    if (
      frequency < this.options.minFrequency ||
      frequency > this.options.maxFrequency
    ) {
      return null;
    }

    return frequency;
  }

  /**
   * 计算频谱（简化版，用于离线分析）
   */
  private calculateSpectrum(
    data: Float32Array,
    _sampleRate: number
  ): Uint8Array {
    const fftSize = Math.pow(
      2,
      Math.floor(Math.log2(data.length))
    );
    const frequencyBins = fftSize / 2;
    const spectrum = new Uint8Array(frequencyBins);

    // 简单的 FFT 近似（使用现有的 AnalyserNode 逻辑）
    // 实际应用中可以使用更精确的 FFT 库
    const tempAnalyser = this.audioContext.createAnalyser();
    tempAnalyser.fftSize = fftSize;

    // 这里简化处理，返回基于能量的近似值
    for (let i = 0; i < frequencyBins; i++) {
      let energy = 0;
      const startIdx = Math.floor((i * data.length) / frequencyBins);
      const endIdx = Math.floor(((i + 1) * data.length) / frequencyBins);

      for (let j = startIdx; j < endIdx && j < data.length; j++) {
        energy += data[j] * data[j];
      }

      // 转换为 dB 并归一化到 0-255
      const db = 10 * Math.log10(energy / (endIdx - startIdx) + 1e-10);
      spectrum[i] = Math.max(0, Math.min(255, (db + 100) * 2.55));
    }

    return spectrum;
  }

  /**
   * 混合多声道为单声道
   */
  private mixChannels(audioBuffer: AudioBuffer): Float32Array {
    const length = audioBuffer.length;
    const mixed = new Float32Array(length);
    const numChannels = audioBuffer.numberOfChannels;

    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        sum += audioBuffer.getChannelData(ch)[i];
      }
      mixed[i] = sum / numChannels;
    }

    return mixed;
  }

  /**
   * 将频率转换为音符名称
   */
  frequencyToNote(frequency: number): string {
    // A4 = 440Hz 作为参考
    const A4 = 440;
    const semitones = 12 * Math.log2(frequency / A4);
    const noteIndex = Math.round(semitones) + 69; // MIDI 音符编号

    const octave = Math.floor(noteIndex / 12) - 1;
    const noteName = AudioAnalyzer.NOTE_NAMES[noteIndex % 12];

    return `${noteName}${octave}`;
  }

  /**
   * 将音符名称转换为频率
   */
  static noteToFrequency(note: string): number {
    const A4 = 440;
    const octave = parseInt(note.slice(-1), 10);
    const noteName = note.slice(0, -1);
    const noteIndex = AudioAnalyzer.NOTE_NAMES.indexOf(noteName);

    if (noteIndex === -1 || isNaN(octave)) {
      throw new Error(`Invalid note format: ${note}`);
    }

    const semitonesFromA4 = noteIndex + (octave - 4) * 12 - 9;
    return A4 * Math.pow(2, semitonesFromA4 / 12);
  }

  /**
   * 获取 AnalyserNode（用于连接其他音频节点）
   */
  getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  /**
   * 更新分析选项
   */
  setOptions(options: AnalysisOptions): void {
    if (options.fftSize !== undefined) {
      this.options.fftSize = options.fftSize;
      this.analyser.fftSize = options.fftSize;
    }
    if (options.smoothingTimeConstant !== undefined) {
      this.options.smoothingTimeConstant = options.smoothingTimeConstant;
      this.analyser.smoothingTimeConstant = options.smoothingTimeConstant;
    }
    if (options.minFrequency !== undefined) {
      this.options.minFrequency = options.minFrequency;
    }
    if (options.maxFrequency !== undefined) {
      this.options.maxFrequency = options.maxFrequency;
    }
  }
}

/**
 * 便捷的独立分析函数
 */
export async function analyzeAudioFile(
  file: File,
  options?: AnalysisOptions
): Promise<AudioAnalysisResult> {
  const audioContext = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const analyzer = new AudioAnalyzer(audioContext, options);
  const audioBuffer = await analyzer.loadAudioFile(file);
  return analyzer.analyze(audioBuffer);
}

export async function analyzeAudioUrl(
  url: string,
  options?: AnalysisOptions
): Promise<AudioAnalysisResult> {
  const audioContext = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const analyzer = new AudioAnalyzer(audioContext, options);
  const audioBuffer = await analyzer.loadAudioFromUrl(url);
  return analyzer.analyze(audioBuffer);
}

export default AudioAnalyzer;
