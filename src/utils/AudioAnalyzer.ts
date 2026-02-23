/**
 * 音频分析模块
 * 使用 Web Audio API 分析音频文件的音高、音量、时长、节拍和和弦
 * 
 * 功能特性：
 * - YIN 算法实现高精度音高检测
 * - 基于能量和频谱通量的节拍检测（BPM）
 * - 基于音高类的和弦识别
 * - 保持与现有代码的完全兼容
 */

// ============================================================================
// 类型定义
// ============================================================================

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
  /** 扩展分析结果（可选，向后兼容） */
  advanced?: AdvancedAnalysisResult;
}

/** 扩展分析结果 */
export interface AdvancedAnalysisResult {
  /** 检测到的 BPM */
  bpm: number | null;
  /** 节拍置信度 (0-1) */
  bpmConfidence: number;
  /** 检测到的和弦 */
  chord: ChordInfo | null;
  /** 音高置信度 (0-1) */
  pitchConfidence: number;
  /** 各音高类能量分布 */
  chromagram: Float32Array;
  /** 节拍位置（秒） */
  beatPositions: number[];
}

/** 和弦信息 */
export interface ChordInfo {
  /** 根音 */
  root: string;
  /** 和弦类型 */
  type: 'major' | 'minor' | 'diminished' | 'augmented' | 'suspended' | 'unknown';
  /** 完整和弦名称 */
  name: string;
  /** 组成音符 */
  notes: string[];
  /** 置信度 (0-1) */
  confidence: number;
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
  /** YIN 算法阈值（默认为 0.1，越小越严格） */
  yinThreshold?: number;
  /** 是否启用高级分析（默认为 false，保持向后兼容） */
  enableAdvanced?: boolean;
  /** BPM 检测范围最小值（默认为 60） */
  minBpm?: number;
  /** BPM 检测范围最大值（默认为 180） */
  maxBpm?: number;
}

/** 音高检测方法 */
export type PitchDetectionMethod = 'yin' | 'autocorrelation' | 'zero-crossing';

// ============================================================================
// 常量定义
// ============================================================================

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 和弦模板（音高类相对于根音的半音间隔） */
const CHORD_TEMPLATES: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
  suspended4: [0, 5, 7],
  suspended2: [0, 2, 7],
};

// ============================================================================
// YIN 音高检测算法
// ============================================================================

/**
 * YIN 音高检测算法实现
 * 
 * YIN 是一种基于自相关的音高检测算法，通过差分函数和累积均值归一化
 * 来提高音高检测的准确性和鲁棒性。
 * 
 * 参考文献：
 * de Cheveigné, A., & Kawahara, H. (2002). YIN, a fundamental frequency estimator
 * for speech and music. The Journal of the Acoustical Society of America, 111(4), 1917-1930.
 */
class YINDetector {
  private sampleRate: number;
  private threshold: number;
  private minFrequency: number;
  private maxFrequency: number;

  constructor(
    sampleRate: number,
    threshold: number = 0.1,
    minFrequency: number = 50,
    maxFrequency: number = 5000
  ) {
    this.sampleRate = sampleRate;
    this.threshold = threshold;
    this.minFrequency = minFrequency;
    this.maxFrequency = maxFrequency;
  }

  /**
   * 检测音高
   * @returns { frequency: 频率(Hz), confidence: 置信度(0-1) } 或 null
   */
  detect(buffer: Float32Array): { frequency: number; confidence: number } | null {
    const bufferSize = buffer.length;
    const minLag = Math.floor(this.sampleRate / this.maxFrequency);
    const maxLag = Math.min(Math.floor(this.sampleRate / this.minFrequency), bufferSize / 2);

    // 步骤 1: 计算差分函数
    const difference = this.differenceFunction(buffer, bufferSize, maxLag);

    // 步骤 2: 累积均值归一化
    const cmndf = this.cumulativeMeanNormalizedDifference(difference, maxLag);

    // 步骤 3: 绝对阈值检测
    let tau = this.absoluteThreshold(cmndf, minLag, maxLag);

    if (tau === -1) {
      return null;
    }

    // 步骤 4: 抛物线插值提高精度
    const betterTau = this.parabolicInterpolation(cmndf, tau);

    // 计算频率和置信度
    const frequency = this.sampleRate / betterTau;
    const confidence = 1 - cmndf[tau];

    // 验证频率范围
    if (frequency < this.minFrequency || frequency > this.maxFrequency) {
      return null;
    }

    return { frequency, confidence };
  }

  /**
   * 计算差分函数
   * d[tau] = sum_{j=0}^{W-1} (x[j] - x[j+tau])^2
   */
  private differenceFunction(buffer: Float32Array, bufferSize: number, maxLag: number): Float32Array {
    const difference = new Float32Array(maxLag);
    
    // 使用 FFT 加速的简化版本（直接计算）
    for (let tau = 0; tau < maxLag; tau++) {
      let sum = 0;
      for (let j = 0; j < bufferSize - maxLag; j++) {
        const delta = buffer[j] - buffer[j + tau];
        sum += delta * delta;
      }
      difference[tau] = sum;
    }
    
    return difference;
  }

  /**
   * 累积均值归一化差分函数
   * CMNDF[tau] = d[tau] / ((1/tau) * sum_{j=1}^{tau} d[j])
   */
  private cumulativeMeanNormalizedDifference(difference: Float32Array, maxLag: number): Float32Array {
    const cmndf = new Float32Array(maxLag);
    cmndf[0] = 1;
    
    let runningSum = 0;
    for (let tau = 1; tau < maxLag; tau++) {
      runningSum += difference[tau];
      cmndf[tau] = difference[tau] / (runningSum / tau);
    }
    
    return cmndf;
  }

  /**
   * 绝对阈值检测
   * 寻找第一个低于阈值的局部最小值
   */
  private absoluteThreshold(cmndf: Float32Array, minLag: number, maxLag: number): number {
    let tau = minLag;
    
    while (tau < maxLag) {
      if (cmndf[tau] < this.threshold) {
        // 寻找局部最小值
        while (tau + 1 < maxLag && cmndf[tau + 1] < cmndf[tau]) {
          tau++;
        }
        return tau;
      }
      tau++;
    }
    
    return -1;
  }

  /**
   * 抛物线插值提高精度
   */
  private parabolicInterpolation(cmndf: Float32Array, tau: number): number {
    if (tau <= 0 || tau >= cmndf.length - 1) {
      return tau;
    }
    
    const alpha = cmndf[tau - 1];
    const beta = cmndf[tau];
    const gamma = cmndf[tau + 1];
    
    const denom = 2 * (2 * beta - alpha - gamma);
    if (Math.abs(denom) < 1e-10) {
      return tau;
    }
    
    const offset = (gamma - alpha) / denom;
    return tau + offset;
  }
}

// ============================================================================
// 备用音高检测算法
// ============================================================================

/**
 * 自相关音高检测算法（改进版，带抛物线插值）
 */
function detectPitchAutocorrelation(
  data: Float32Array,
  sampleRate: number,
  minFreq: number,
  maxFreq: number
): { frequency: number; confidence: number } | null {
  const bufferSize = data.length;
  const minLag = Math.floor(sampleRate / maxFreq);
  const maxLag = Math.min(Math.floor(sampleRate / minFreq), bufferSize / 2);

  // 计算自相关
  const autocorr = new Float32Array(maxLag);
  for (let lag = 0; lag < maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < bufferSize - lag; i++) {
      sum += data[i] * data[i + lag];
    }
    autocorr[lag] = sum;
  }

  // 找到第一个显著峰值
  let maxVal = -Infinity;
  let bestLag = -1;
  const threshold = 0.5 * autocorr[0]; // 使用第一峰值的一部分作为阈值

  for (let lag = minLag; lag < maxLag - 1; lag++) {
    if (
      autocorr[lag] > threshold &&
      autocorr[lag] > autocorr[lag - 1] &&
      autocorr[lag] > autocorr[lag + 1] &&
      autocorr[lag] > maxVal
    ) {
      // 抛物线插值
      const alpha = autocorr[lag - 1];
      const beta = autocorr[lag];
      const gamma = autocorr[lag + 1];
      const peakOffset = (alpha - gamma) / (2 * (alpha - 2 * beta + gamma));
      
      maxVal = beta;
      bestLag = lag + peakOffset;
      break;
    }
  }

  if (bestLag <= 0) {
    return null;
  }

  const frequency = sampleRate / bestLag;
  const confidence = maxVal / autocorr[0];

  return { frequency, confidence };
}

// ============================================================================
// 节拍检测 (BPM)
// ============================================================================

/**
 * BPM 检测器
 * 使用能量和频谱通量结合的算法
 */
class BPMDetector {
  private sampleRate: number;
  private minBpm: number;
  private maxBpm: number;

  constructor(sampleRate: number, minBpm: number = 60, maxBpm: number = 180) {
    this.sampleRate = sampleRate;
    this.minBpm = minBpm;
    this.maxBpm = maxBpm;
  }

  /**
   * 检测 BPM
   * @returns { bpm: BPM值, confidence: 置信度, beatPositions: 节拍位置(秒) }
   */
  detect(audioBuffer: AudioBuffer): {
    bpm: number | null;
    confidence: number;
    beatPositions: number[];
  } {
    // 获取单声道数据
    const channelData =
      audioBuffer.numberOfChannels > 1
        ? this.mixChannels(audioBuffer)
        : audioBuffer.getChannelData(0);

    // 分析参数
    const hopSize = Math.floor(this.sampleRate * 0.01); // 10ms hop
    const windowSize = Math.floor(this.sampleRate * 0.04); // 40ms window
    const numFrames = Math.floor((channelData.length - windowSize) / hopSize);

    // 计算能量包络
    const energyEnvelope = this.calculateEnergyEnvelope(
      channelData,
      numFrames,
      windowSize,
      hopSize
    );

    // 差分能量（检测能量变化）
    const diffEnvelope = this.differentiate(energyEnvelope);

    // 计算自相关寻找周期性
    const autocorr = this.autocorrelate(diffEnvelope);

    // 在 BPM 范围内寻找峰值
    const minLag = Math.floor((60 / this.maxBpm) * (this.sampleRate / hopSize));
    const maxLag = Math.ceil((60 / this.minBpm) * (this.sampleRate / hopSize));

    let bestBpm: number | null = null;
    let bestConfidence = 0;
    let bestLag = 0;

    for (let lag = minLag; lag <= maxLag && lag < autocorr.length; lag++) {
      if (autocorr[lag] > bestConfidence) {
        // 检查是否为局部峰值
        let isPeak = true;
        for (let i = Math.max(0, lag - 2); i <= Math.min(autocorr.length - 1, lag + 2); i++) {
          if (i !== lag && autocorr[i] > autocorr[lag]) {
            isPeak = false;
            break;
          }
        }
        
        if (isPeak) {
          bestConfidence = autocorr[lag];
          bestLag = lag;
        }
      }
    }

    if (bestLag > 0) {
      const secondsPerBeat = (bestLag * hopSize) / this.sampleRate;
      bestBpm = Math.round(60 / secondsPerBeat);
    }

    // 检测节拍位置
    const beatPositions = bestLag > 0
      ? this.detectBeatPositions(diffEnvelope, bestLag, hopSize)
      : [];

    return {
      bpm: bestBpm,
      confidence: Math.min(bestConfidence / (autocorr[0] || 1), 1),
      beatPositions,
    };
  }

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

  private calculateEnergyEnvelope(
    data: Float32Array,
    numFrames: number,
    windowSize: number,
    hopSize: number
  ): Float32Array {
    const envelope = new Float32Array(numFrames);
    
    for (let i = 0; i < numFrames; i++) {
      const start = i * hopSize;
      let sum = 0;
      
      for (let j = 0; j < windowSize && start + j < data.length; j++) {
        sum += data[start + j] * data[start + j];
      }
      
      envelope[i] = Math.sqrt(sum / windowSize);
    }
    
    return envelope;
  }

  private differentiate(envelope: Float32Array): Float32Array {
    const diff = new Float32Array(envelope.length);
    diff[0] = 0;
    
    for (let i = 1; i < envelope.length; i++) {
      const d = envelope[i] - envelope[i - 1];
      diff[i] = Math.max(0, d); // 半波整流
    }
    
    return diff;
  }

  private autocorrelate(data: Float32Array): Float32Array {
    const n = data.length;
    const result = new Float32Array(n);
    
    for (let lag = 0; lag < n; lag++) {
      let sum = 0;
      for (let i = 0; i < n - lag; i++) {
        sum += data[i] * data[i + lag];
      }
      result[lag] = sum;
    }
    
    return result;
  }

  private detectBeatPositions(
    diffEnvelope: Float32Array,
    _beatPeriod: number,
    hopSize: number
  ): number[] {
    const positions: number[] = [];
    const threshold = 0.3 * Math.max(...diffEnvelope);
    
    // 寻找能量峰值作为节拍位置
    for (let i = 1; i < diffEnvelope.length - 1; i++) {
      if (
        diffEnvelope[i] > threshold &&
        diffEnvelope[i] > diffEnvelope[i - 1] &&
        diffEnvelope[i] > diffEnvelope[i + 1]
      ) {
        const time = (i * hopSize) / this.sampleRate;
        positions.push(time);
      }
    }
    
    return positions;
  }
}

// ============================================================================
// 和弦识别
// ============================================================================

/**
 * 和弦识别器
 * 基于音高类直方图（Chromagram）的模板匹配
 */
class ChordRecognizer {
  /**
   * 计算音高类直方图
   */
  static calculateChromagram(
    frequencyData: Uint8Array,
    sampleRate: number
  ): Float32Array {
    const chromagram = new Float32Array(12);
    const nyquist = sampleRate / 2;
    const binCount = frequencyData.length;
    
    for (let i = 0; i < binCount; i++) {
      const frequency = (i / binCount) * nyquist;
      if (frequency > 0) {
        // 转换为 MIDI 音符编号
        const midiNote = 69 + 12 * Math.log2(frequency / 440);
        const pitchClass = Math.round(midiNote) % 12;
        
        if (pitchClass >= 0 && pitchClass < 12) {
          chromagram[pitchClass] += frequencyData[i];
        }
      }
    }
    
    // 归一化
    const max = Math.max(...chromagram);
    if (max > 0) {
      for (let i = 0; i < 12; i++) {
        chromagram[i] /= max;
      }
    }
    
    return chromagram;
  }

  /**
   * 识别和弦
   */
  static recognize(chromagram: Float32Array): ChordInfo | null {
    let bestScore = -Infinity;
    let bestChord: ChordInfo | null = null;

    // 尝试所有根音和和弦类型
    for (let root = 0; root < 12; root++) {
      for (const [type, intervals] of Object.entries(CHORD_TEMPLATES)) {
        const score = this.matchTemplate(chromagram, root, intervals);
        
        if (score > bestScore) {
          bestScore = score;
          const rootName = NOTE_NAMES[root];
          const typeLabel = this.formatChordType(type);
          
          bestChord = {
            root: rootName,
            type: typeLabel,
            name: `${rootName}${type === 'major' ? '' : typeLabel}`,
            notes: intervals.map(interval => {
              const noteIndex = (root + interval) % 12;
              return NOTE_NAMES[noteIndex];
            }),
            confidence: Math.min(score / 3, 1),
          };
        }
      }
    }

    return bestChord;
  }

  /**
   * 模板匹配评分
   */
  private static matchTemplate(
    chromagram: Float32Array,
    root: number,
    intervals: number[]
  ): number {
    let score = 0;
    
    // 奖励匹配的音符
    for (const interval of intervals) {
      const noteIndex = (root + interval) % 12;
      score += chromagram[noteIndex];
    }
    
    // 惩罚未匹配的强音符
    for (let i = 0; i < 12; i++) {
      if (!intervals.includes((i - root + 12) % 12)) {
        score -= chromagram[i] * 0.3;
      }
    }
    
    return score;
  }

  private static formatChordType(type: string): ChordInfo['type'] {
    switch (type) {
      case 'major': return 'major';
      case 'minor': return 'minor';
      case 'diminished': return 'diminished';
      case 'augmented': return 'augmented';
      case 'suspended4':
      case 'suspended2': return 'suspended';
      default: return 'unknown';
    }
  }
}

// ============================================================================
// 主类：AudioAnalyzer
// ============================================================================

export class AudioAnalyzer {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private options: Required<AnalysisOptions>;
  private yinDetector: YINDetector;

  constructor(audioContext: AudioContext, options: AnalysisOptions = {}) {
    this.audioContext = audioContext;
    this.options = {
      fftSize: options.fftSize ?? 2048,
      smoothingTimeConstant: options.smoothingTimeConstant ?? 0.8,
      minFrequency: options.minFrequency ?? 50,
      maxFrequency: options.maxFrequency ?? 5000,
      yinThreshold: options.yinThreshold ?? 0.1,
      enableAdvanced: options.enableAdvanced ?? false,
      minBpm: options.minBpm ?? 60,
      maxBpm: options.maxBpm ?? 180,
    };

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.options.fftSize;
    this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant;

    this.yinDetector = new YINDetector(
      this.audioContext.sampleRate,
      this.options.yinThreshold,
      this.options.minFrequency,
      this.options.maxFrequency
    );
  }

  // ========================================================================
  // 核心分析方法
  // ========================================================================

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
   * 分析音频缓冲区（主要方法，保持向后兼容）
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

    // 播放并立即采样
    source.start(0);

    await new Promise((resolve) => setTimeout(resolve, 50));
    source.stop();

    // 获取波形数据
    this.analyser.getFloatTimeDomainData(waveformData);

    // 获取频谱数据
    this.analyser.getByteFrequencyData(frequencyData);

    // 计算音量
    const volume = this.calculateVolume(waveformData);

    // 使用 YIN 算法检测音高
    const pitchResult = this.detectPitchWithConfidence(waveformData);
    const pitch = pitchResult?.frequency ?? null;
    const note = pitch ? this.frequencyToNote(pitch) : null;

    // 构建结果
    const result: AudioAnalysisResult = {
      duration,
      volume,
      pitch,
      note,
      waveformData: waveformData.slice(),
      frequencyData: frequencyData.slice(),
      analyzedAt: Date.now(),
    };

    // 高级分析（可选）
    if (this.options.enableAdvanced) {
      result.advanced = await this.performAdvancedAnalysis(audioBuffer, frequencyData, pitchResult);
    }

    return result;
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

    // 获取音频数据
    const channelData =
      audioBuffer.numberOfChannels > 1
        ? this.mixChannels(audioBuffer)
        : audioBuffer.getChannelData(0);

    const segmentData = channelData.slice(startSample, endSample);

    // 计算音量
    const volume = this.calculateVolume(segmentData);

    // 使用 YIN 检测音高
    const pitchResult = this.yinDetector.detect(segmentData);
    const pitch = pitchResult?.frequency ?? null;
    const note = pitch ? this.frequencyToNote(pitch) : null;

    // 获取频谱数据
    const frequencyData = this.calculateSpectrum(segmentData, sampleRate);

    const result: AudioAnalysisResult = {
      duration: audioBuffer.duration,
      volume,
      pitch,
      note,
      waveformData: segmentData,
      frequencyData,
      analyzedAt: Date.now(),
    };

    return result;
  }

  /**
   * 实时分析当前播放的音频
   */
  analyzeRealtime(): Omit<AudioAnalysisResult, 'duration'> {
    const waveformData = new Float32Array(this.analyser.fftSize);
    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

    // 获取当前数据
    this.analyser.getFloatTimeDomainData(waveformData);
    this.analyser.getByteFrequencyData(frequencyData);

    // 计算音量
    const volume = this.calculateVolume(waveformData);

    // 使用 YIN 检测音高
    const pitchResult = this.yinDetector.detect(waveformData);
    const pitch = pitchResult?.frequency ?? null;
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

  // ========================================================================
  // 高级分析方法
  // ========================================================================

  /**
   * 执行高级分析（BPM、和弦等）
   */
  private async performAdvancedAnalysis(
    audioBuffer: AudioBuffer,
    frequencyData: Uint8Array,
    pitchResult: { frequency: number; confidence: number } | null
  ): Promise<AdvancedAnalysisResult> {
    // BPM 检测
    const bpmDetector = new BPMDetector(
      audioBuffer.sampleRate,
      this.options.minBpm,
      this.options.maxBpm
    );
    const bpmResult = bpmDetector.detect(audioBuffer);

    // 和弦识别
    const chromagram = ChordRecognizer.calculateChromagram(
      frequencyData,
      audioBuffer.sampleRate
    );
    const chord = ChordRecognizer.recognize(chromagram);

    return {
      bpm: bpmResult.bpm,
      bpmConfidence: bpmResult.confidence,
      chord,
      pitchConfidence: pitchResult?.confidence ?? 0,
      chromagram,
      beatPositions: bpmResult.beatPositions,
    };
  }

  /**
   * 专门的 BPM 检测方法
   */
  detectBPM(audioBuffer: AudioBuffer): {
    bpm: number | null;
    confidence: number;
    beatPositions: number[];
  } {
    const detector = new BPMDetector(
      audioBuffer.sampleRate,
      this.options.minBpm,
      this.options.maxBpm
    );
    return detector.detect(audioBuffer);
  }

  /**
   * 专门的和弦识别方法
   */
  recognizeChord(frequencyData: Uint8Array): ChordInfo | null {
    const chromagram = ChordRecognizer.calculateChromagram(
      frequencyData,
      this.audioContext.sampleRate
    );
    return ChordRecognizer.recognize(chromagram);
  }

  // ========================================================================
  // 音高检测方法（多种算法可选）
  // ========================================================================

  /**
   * 使用 YIN 算法检测音高（默认）
   */
  private detectPitchWithConfidence(
    data: Float32Array
  ): { frequency: number; confidence: number } | null {
    return this.yinDetector.detect(data);
  }

  /**
   * 使用自相关算法检测音高（备用方法）
   */
  detectPitchAutocorrelation(
    data: Float32Array
  ): { frequency: number; confidence: number } | null {
    return detectPitchAutocorrelation(
      data,
      this.audioContext.sampleRate,
      this.options.minFrequency,
      this.options.maxFrequency
    );
  }

  // ========================================================================
  // 工具方法
  // ========================================================================

  /**
   * 计算音量（RMS）
   */
  private calculateVolume(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / data.length);
    return Math.min(rms * Math.sqrt(2), 1);
  }

  /**
   * 计算频谱
   */
  private calculateSpectrum(
    data: Float32Array,
    _sampleRate: number
  ): Uint8Array {
    const fftSize = Math.pow(2, Math.floor(Math.log2(data.length)));
    const frequencyBins = fftSize / 2;
    const spectrum = new Uint8Array(frequencyBins);

    for (let i = 0; i < frequencyBins; i++) {
      let energy = 0;
      const startIdx = Math.floor((i * data.length) / frequencyBins);
      const endIdx = Math.floor(((i + 1) * data.length) / frequencyBins);

      for (let j = startIdx; j < endIdx && j < data.length; j++) {
        energy += data[j] * data[j];
      }

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
    const A4 = 440;
    const semitones = 12 * Math.log2(frequency / A4);
    const noteIndex = Math.round(semitones) + 69;

    const octave = Math.floor(noteIndex / 12) - 1;
    const noteName = NOTE_NAMES[noteIndex % 12];

    return `${noteName}${octave}`;
  }

  /**
   * 将音符名称转换为频率
   */
  static noteToFrequency(note: string): number {
    const A4 = 440;
    const octave = parseInt(note.slice(-1), 10);
    const noteName = note.slice(0, -1);
    const noteIndex = NOTE_NAMES.indexOf(noteName);

    if (noteIndex === -1 || isNaN(octave)) {
      throw new Error(`Invalid note format: ${note}`);
    }

    const semitonesFromA4 = noteIndex + (octave - 4) * 12 - 9;
    return A4 * Math.pow(2, semitonesFromA4 / 12);
  }

  /**
   * 获取 AnalyserNode
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
      this.yinDetector = new YINDetector(
        this.audioContext.sampleRate,
        this.options.yinThreshold,
        this.options.minFrequency,
        this.options.maxFrequency
      );
    }
    if (options.maxFrequency !== undefined) {
      this.options.maxFrequency = options.maxFrequency;
      this.yinDetector = new YINDetector(
        this.audioContext.sampleRate,
        this.options.yinThreshold,
        this.options.minFrequency,
        this.options.maxFrequency
      );
    }
    if (options.yinThreshold !== undefined) {
      this.options.yinThreshold = options.yinThreshold;
      this.yinDetector = new YINDetector(
        this.audioContext.sampleRate,
        this.options.yinThreshold,
        this.options.minFrequency,
        this.options.maxFrequency
      );
    }
    if (options.enableAdvanced !== undefined) {
      this.options.enableAdvanced = options.enableAdvanced;
    }
    if (options.minBpm !== undefined) {
      this.options.minBpm = options.minBpm;
    }
    if (options.maxBpm !== undefined) {
      this.options.maxBpm = options.maxBpm;
    }
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

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
