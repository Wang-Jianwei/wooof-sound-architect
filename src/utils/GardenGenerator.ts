/**
 * 声音花园生成模块
 * 从音频分析结果生成有机形态的声音景观
 */

import { AudioAnalysisResult } from './AudioAnalyzer';

export interface GardenPlant {
  /** 植物类型 */
  type: 'mushroom' | 'tree' | 'spire';
  /** 位置 (极坐标: angle, radius) */
  position: {
    angle: number; // 0-360度，对应时间轴
    radius: number; // 距离中心的距离
    y: number; // 高度
  };
  /** 大小 */
  size: {
    baseWidth: number;
    height: number;
  };
  /** 颜色 (HSL) */
  color: {
    h: number; // 色相 0-360
    s: number; // 饱和度 0-1
    l: number; // 亮度 0-1
  };
  /** 动画参数 */
  animation: {
    pulseSpeed: number;
    pulseIntensity: number;
    rotationSpeed: number;
  };
  /** 对应音频特征 */
  audioFeatures: {
    frequency: number;
    volume: number;
    timestamp: number;
    note: string | null;
  };
  /** 生长延迟 (用于入场动画) */
  growDelay: number;
}

export interface SoundGarden {
  /** 花园名称 */
  name: string;
  /** 所有植物 */
  plants: GardenPlant[];
  /** 总时长 */
  duration: number;
  /** 和弦连接 */
  connections: Array<{
    from: number;
    to: number;
    type: 'harmony' | 'sequence';
  }>;
  /** 生成时间戳 */
  generatedAt: number;
}

export interface GardenOptions {
  /** 花园半径 */
  gardenRadius?: number;
  /** 最大植物数量 */
  maxPlants?: number;
  /** 是否随机化 */
  randomize?: boolean;
}

export class GardenGenerator {
  private options: Required<GardenOptions>;

  // 频率范围定义
  private static readonly FREQ_RANGES = {
    low: { min: 50, max: 250, name: 'mushroom' as const },
    mid: { min: 250, max: 1000, name: 'tree' as const },
    high: { min: 1000, max: 5000, name: 'spire' as const },
  };

  constructor(options: GardenOptions = {}) {
    this.options = {
      gardenRadius: options.gardenRadius ?? 20,
      maxPlants: options.maxPlants ?? 60,
      randomize: options.randomize ?? true,
    };
  }

  /**
   * 从音频分析结果生成声音花园
   */
  generateGarden(
    analysis: AudioAnalysisResult,
    name: string = 'Sound Garden'
  ): SoundGarden {
    const plants: GardenPlant[] = [];
    const waveform = analysis.waveformData;
    const duration = analysis.duration;

    // 计算植物数量（基于时长）
    const plantCount = Math.min(
      Math.floor(duration * 8) + 1,
      this.options.maxPlants
    );

    // 采样波形数据
    const samplesPerPlant = Math.floor(waveform.length / plantCount);

    for (let i = 0; i < plantCount; i++) {
      const startIdx = i * samplesPerPlant;
      const endIdx = Math.min(startIdx + samplesPerPlant, waveform.length);

      // 分析这一段音频
      const segment = waveform.slice(startIdx, endIdx);
      const features = this.analyzeSegment(segment);

      // 计算角度（时间轴映射到圆形）
      const angle = (i / plantCount) * 360;

      // 计算半径（音量决定距离中心的远近）
      const radius = 3 + features.volume * (this.options.gardenRadius - 3);

      // 确定植物类型和高度
      const plantType = this.determinePlantType(features.frequency);
      const height = this.calculateHeight(plantType, features.frequency, features.volume);

      // 计算颜色（音高映射到色相）
      const color = this.frequencyToColor(features.frequency);

      // 创建植物
      const plant: GardenPlant = {
        type: plantType,
        position: {
          angle,
          radius,
          y: height / 2,
        },
        size: {
          baseWidth: this.calculateBaseWidth(plantType, features.volume),
          height,
        },
        color,
        animation: this.calculateAnimation(plantType, features.volume),
        audioFeatures: {
          frequency: features.frequency,
          volume: features.volume,
          timestamp: (i / plantCount) * duration,
          note: this.frequencyToNote(features.frequency),
        },
        growDelay: i * 0.1, // 依次生长
      };

      plants.push(plant);
    }

    // 检测和弦连接
    const connections = this.detectHarmonies(plants);

    return {
      name,
      plants,
      duration,
      connections,
      generatedAt: Date.now(),
    };
  }

  /**
   * 分析音频片段特征
   */
  private analyzeSegment(segment: Float32Array): {
    frequency: number;
    volume: number;
  } {
    // 计算音量 (RMS)
    let sum = 0;
    for (let i = 0; i < segment.length; i++) {
      sum += segment[i] * segment[i];
    }
    const volume = Math.sqrt(sum / segment.length);

    // 估算频率（过零率）
    let zeroCrossings = 0;
    for (let i = 1; i < segment.length; i++) {
      if (
        (segment[i] > 0 && segment[i - 1] <= 0) ||
        (segment[i] <= 0 && segment[i - 1] > 0)
      ) {
        zeroCrossings++;
      }
    }

    const sampleRate = 44100;
    const frequency = (zeroCrossings * sampleRate) / (2 * segment.length);

    return {
      frequency: Math.max(50, Math.min(5000, frequency)),
      volume: Math.min(volume * Math.sqrt(2), 1),
    };
  }

  /**
   * 根据频率确定植物类型
   */
  private determinePlantType(
    frequency: number
  ): 'mushroom' | 'tree' | 'spire' {
    if (frequency < GardenGenerator.FREQ_RANGES.low.max) {
      return 'mushroom';
    } else if (frequency < GardenGenerator.FREQ_RANGES.mid.max) {
      return 'tree';
    } else {
      return 'spire';
    }
  }

  /**
   * 计算植物高度
   */
  private calculateHeight(
    type: 'mushroom' | 'tree' | 'spire',
    frequency: number,
    volume: number
  ): number {
    const baseHeight = {
      mushroom: 1.5,
      tree: 3,
      spire: 5,
    }[type];

    // 频率越高，相对高度越高
    const freqFactor = frequency / 5000;
    const volumeFactor = 0.5 + volume * 0.5;

    return baseHeight * (1 + freqFactor) * volumeFactor;
  }

  /**
   * 计算底部宽度
   */
  private calculateBaseWidth(
    type: 'mushroom' | 'tree' | 'spire',
    volume: number
  ): number {
    const baseWidth = {
      mushroom: 2.5,
      tree: 1.2,
      spire: 0.4,
    }[type];

    return baseWidth * (0.7 + volume * 0.6);
  }

  /**
   * 频率转颜色 (HSL)
   */
  private frequencyToColor(frequency: number): {
    h: number;
    s: number;
    l: number;
  } {
    // 低频 = 红色 (0°), 高频 = 紫色 (270°)
    const hue = (frequency / 5000) * 270;

    // 饱和度根据频率变化
    const saturation = 0.7 + (frequency / 5000) * 0.3;

    // 亮度
    const lightness = 0.4 + (1 - frequency / 5000) * 0.3;

    return { h: hue, s: saturation, l: lightness };
  }

  /**
   * 计算动画参数
   */
  private calculateAnimation(
    type: 'mushroom' | 'tree' | 'spire',
    volume: number
  ): {
    pulseSpeed: number;
    pulseIntensity: number;
    rotationSpeed: number;
  } {
    switch (type) {
      case 'mushroom':
        return {
          pulseSpeed: 1,
          pulseIntensity: 0.05 + volume * 0.05,
          rotationSpeed: 0.1,
        };
      case 'tree':
        return {
          pulseSpeed: 2,
          pulseIntensity: 0.08 + volume * 0.07,
          rotationSpeed: 0.3,
        };
      case 'spire':
        return {
          pulseSpeed: 4,
          pulseIntensity: 0.1 + volume * 0.1,
          rotationSpeed: 1,
        };
    }
  }

  /**
   * 频率转音符
   */
  private frequencyToNote(frequency: number): string | null {
    const A4 = 440;
    const semitones = 12 * Math.log2(frequency / A4);
    const noteIndex = Math.round(semitones) + 69;

    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(noteIndex / 12) - 1;
    const noteName = notes[noteIndex % 12];

    if (octave < 0 || octave > 8) return null;
    return `${noteName}${octave}`;
  }

  /**
   * 检测和弦连接
   */
  private detectHarmonies(
    plants: GardenPlant[]
  ): Array<{ from: number; to: number; type: 'harmony' | 'sequence' }> {
    const connections: Array<{ from: number; to: number; type: 'harmony' | 'sequence' }> = [];

    for (let i = 0; i < plants.length - 1; i++) {
      const current = plants[i];
      const next = plants[i + 1];

      // 检查是否是和谐音程（简单版本：检查频率比）
      const freqRatio = next.audioFeatures.frequency / current.audioFeatures.frequency;
      const isHarmony = this.isHarmonicRatio(freqRatio);

      if (isHarmony) {
        connections.push({
          from: i,
          to: i + 1,
          type: 'harmony',
        });
      } else if (next.audioFeatures.timestamp - current.audioFeatures.timestamp < 0.5) {
        // 时间接近的连续音符
        connections.push({
          from: i,
          to: i + 1,
          type: 'sequence',
        });
      }
    }

    return connections;
  }

  /**
   * 检查频率比是否是和谐音程
   */
  private isHarmonicRatio(ratio: number): boolean {
    // 标准化比率到 1-2 范围
    let normalized = ratio;
    while (normalized < 1) normalized *= 2;
    while (normalized > 2) normalized /= 2;

    // 和谐音程的近似值
    const harmonies = [1, 1.125, 1.25, 1.333, 1.5, 1.667, 1.875]; // 1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8
    const tolerance = 0.05;

    return harmonies.some((h) => Math.abs(normalized - h) < tolerance);
  }

  /**
   * 更新生成选项
   */
  setOptions(options: GardenOptions): void {
    if (options.gardenRadius !== undefined) this.options.gardenRadius = options.gardenRadius;
    if (options.maxPlants !== undefined) this.options.maxPlants = options.maxPlants;
    if (options.randomize !== undefined) this.options.randomize = options.randomize;
  }
}

/**
 * 便捷函数：快速生成花园
 */
export function generateGardenFromAudio(
  analysis: AudioAnalysisResult,
  name?: string,
  options?: GardenOptions
): SoundGarden {
  const generator = new GardenGenerator(options);
  return generator.generateGarden(analysis, name);
}

export default GardenGenerator;
