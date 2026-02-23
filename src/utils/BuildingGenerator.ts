/**
 * 3D 建筑生成模块
 * 根据音频分析结果生成建筑结构
 */

import { AudioAnalysisResult } from './AudioAnalyzer';

export interface BuildingModule {
  /** 模块类型 */
  type: 'foundation' | 'body' | 'spire';
  /** 模块位置 (x, y, z) */
  position: { x: number; y: number; z: number };
  /** 模块尺寸 (宽, 高, 深) */
  size: { width: number; height: number; depth: number };
  /** 模块颜色 (RGB) */
  color: { r: number; g: number; b: number };
  /** 对应音频特征 */
  audioFeatures: {
    frequency: number;
    volume: number;
    timestamp: number;
  };
}

export interface BuildingStructure {
  /** 建筑名称 */
  name: string;
  /** 所有模块 */
  modules: BuildingModule[];
  /** 总高度 */
  totalHeight: number;
  /** 基础宽度 */
  baseWidth: number;
  /** 稳定性评分 (0-100) */
  stabilityScore: number;
  /** 生成时间戳 */
  generatedAt: number;
}

export interface BuildingOptions {
  /** 基础尺寸倍数 */
  scale?: number;
  /** 最大层数 */
  maxLayers?: number;
  /** 是否随机化 */
  randomize?: boolean;
}

export class BuildingGenerator {
  private options: Required<BuildingOptions>;

  // 频率范围定义
  private static readonly FREQ_RANGES = {
    low: { min: 50, max: 250, name: 'foundation' as const },
    mid: { min: 250, max: 1000, name: 'body' as const },
    high: { min: 1000, max: 5000, name: 'spire' as const },
  };

  // 颜色定义
  private static readonly COLORS = {
    foundation: { r: 0.8, g: 0.2, b: 0.2 }, // 红色 - 稳固
    body: { r: 1.0, g: 0.6, b: 0.0 }, // 橙色 - 温暖
    spire: { r: 0.2, g: 0.5, b: 0.9 }, // 蓝色 - 空灵
  };

  constructor(options: BuildingOptions = {}) {
    this.options = {
      scale: options.scale ?? 1.0,
      maxLayers: options.maxLayers ?? 50,
      randomize: options.randomize ?? false,
    };
  }

  /**
   * 从音频分析结果生成建筑
   */
  generateBuilding(
    analysis: AudioAnalysisResult,
    name: string = 'Sound Building'
  ): BuildingStructure {
    const modules: BuildingModule[] = [];
    const waveform = analysis.waveformData;
    const duration = analysis.duration;
    
    // 计算层数（基于时长）
    const layerCount = Math.min(
      Math.floor(duration * 10) + 1,
      this.options.maxLayers
    );
    
    // 采样波形数据
    const samplesPerLayer = Math.floor(waveform.length / layerCount);
    
    let currentY = 0;
    
    for (let layer = 0; layer < layerCount; layer++) {
      const startIdx = layer * samplesPerLayer;
      const endIdx = Math.min(startIdx + samplesPerLayer, waveform.length);
      
      // 分析这一层的音频特征
      const segment = waveform.slice(startIdx, endIdx);
      const features = this.analyzeSegment(segment);
      
      // 确定模块类型
      const moduleType = this.determineModuleType(features.frequency);
      
      // 计算模块尺寸
      const size = this.calculateModuleSize(moduleType, features.volume);
      
      // 计算位置
      const position = this.calculatePosition(currentY, size);
      
      // 创建模块
      const module: BuildingModule = {
        type: moduleType,
        position,
        size,
        color: this.getModuleColor(moduleType),
        audioFeatures: {
          frequency: features.frequency,
          volume: features.volume,
          timestamp: (layer / layerCount) * duration,
        },
      };
      
      modules.push(module);
      currentY += size.height;
    }
    
    // 计算稳定性
    const stabilityScore = this.calculateStability(modules);
    
    return {
      name,
      modules,
      totalHeight: currentY,
      baseWidth: modules.length > 0 ? modules[0].size.width : 0,
      stabilityScore,
      generatedAt: Date.now(),
    };
  }

  /**
   * 从多个音频片段生成复杂建筑
   */
  generateComplexBuilding(
    analyses: AudioAnalysisResult[],
    name: string = 'Complex Sound Structure'
  ): BuildingStructure {
    const allModules: BuildingModule[] = [];
    let currentY = 0;
    
    for (const analysis of analyses) {
      const building = this.generateBuilding(analysis, 'Segment');
      
      // 偏移模块位置
      for (const module of building.modules) {
        const offsetModule: BuildingModule = {
          ...module,
          position: {
            ...module.position,
            y: module.position.y + currentY,
          },
        };
        allModules.push(offsetModule);
      }
      
      currentY += building.totalHeight;
    }
    
    const stabilityScore = this.calculateStability(allModules);
    
    return {
      name,
      modules: allModules,
      totalHeight: currentY,
      baseWidth: allModules.length > 0 ? allModules[0].size.width : 0,
      stabilityScore,
      generatedAt: Date.now(),
    };
  }

  /**
   * 分析音频片段特征
   */
  private analyzeSegment(
    segment: Float32Array
  ): { frequency: number; volume: number } {
    // 计算音量 (RMS)
    let sum = 0;
    for (let i = 0; i < segment.length; i++) {
      sum += segment[i] * segment[i];
    }
    const volume = Math.sqrt(sum / segment.length);
    
    // 估算频率（过零率近似）
    let zeroCrossings = 0;
    for (let i = 1; i < segment.length; i++) {
      if ((segment[i] > 0 && segment[i - 1] <= 0) ||
          (segment[i] <= 0 && segment[i - 1] > 0)) {
        zeroCrossings++;
      }
    }
    
    // 假设采样率为 44100Hz
    const sampleRate = 44100;
    const frequency = (zeroCrossings * sampleRate) / (2 * segment.length);
    
    return {
      frequency: Math.max(50, Math.min(5000, frequency)),
      volume: Math.min(volume * Math.sqrt(2), 1),
    };
  }

  /**
   * 根据频率确定模块类型
   */
  private determineModuleType(
    frequency: number
  ): 'foundation' | 'body' | 'spire' {
    if (frequency < BuildingGenerator.FREQ_RANGES.low.max) {
      return 'foundation';
    } else if (frequency < BuildingGenerator.FREQ_RANGES.mid.max) {
      return 'body';
    } else {
      return 'spire';
    }
  }

  /**
   * 计算模块尺寸
   */
  private calculateModuleSize(
    type: 'foundation' | 'body' | 'spire',
    volume: number
  ): { width: number; height: number; depth: number } {
    const scale = this.options.scale;
    
    switch (type) {
      case 'foundation':
        return {
          width: (3 + volume * 2) * scale,
          height: (0.8 + volume * 0.4) * scale,
          depth: (3 + volume * 2) * scale,
        };
      case 'body':
        return {
          width: (1.5 + volume * 1.5) * scale,
          height: (1.0 + volume * 0.8) * scale,
          depth: (1.5 + volume * 1.5) * scale,
        };
      case 'spire':
        return {
          width: (0.5 + volume * 0.5) * scale,
          height: (1.5 + volume * 1.5) * scale,
          depth: (0.5 + volume * 0.5) * scale,
        };
    }
  }

  /**
   * 计算模块位置
   */
  private calculatePosition(
    currentY: number,
    size: { width: number; height: number; depth: number }
  ): { x: number; y: number; z: number } {
    let x = 0;
    let z = 0;
    
    // 添加随机偏移（如果启用）
    if (this.options.randomize) {
      x = (Math.random() - 0.5) * 0.5;
      z = (Math.random() - 0.5) * 0.5;
    }
    
    return {
      x,
      y: currentY + size.height / 2,
      z,
    };
  }

  /**
   * 获取模块颜色
   */
  private getModuleColor(
    type: 'foundation' | 'body' | 'spire'
  ): { r: number; g: number; b: number } {
    const baseColor = BuildingGenerator.COLORS[type];
    
    // 添加微小的颜色变化
    const variation = 0.1;
    return {
      r: Math.max(0, Math.min(1, baseColor.r + (Math.random() - 0.5) * variation)),
      g: Math.max(0, Math.min(1, baseColor.g + (Math.random() - 0.5) * variation)),
      b: Math.max(0, Math.min(1, baseColor.b + (Math.random() - 0.5) * variation)),
    };
  }

  /**
   * 计算建筑稳定性
   */
  private calculateStability(modules: BuildingModule[]): number {
    if (modules.length === 0) return 0;
    
    let score = 100;
    
    // 检查地基是否足够宽
    const foundationModules = modules.filter(m => m.type === 'foundation');
    if (foundationModules.length < modules.length * 0.2) {
      score -= 20; // 地基不足
    }
    
    // 检查顶部是否太宽（头重脚轻）
    const firstThird = modules.slice(0, Math.floor(modules.length / 3));
    const lastThird = modules.slice(Math.floor(modules.length * 2 / 3));
    
    const avgBaseWidth = firstThird.reduce((sum, m) => sum + m.size.width, 0) / firstThird.length || 0;
    const avgTopWidth = lastThird.reduce((sum, m) => sum + m.size.width, 0) / lastThird.length || 0;
    
    if (avgTopWidth > avgBaseWidth * 1.5) {
      score -= 30; // 头重脚轻
    }
    
    // 检查高度分布
    const spireModules = modules.filter(m => m.type === 'spire');
    const spireAtBottom = spireModules.filter(m => 
      m.position.y < modules[modules.length - 1].position.y / 3
    ).length;
    
    if (spireAtBottom > spireModules.length * 0.3) {
      score -= 15; // 尖顶模块出现在底部太多
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 更新生成选项
   */
  setOptions(options: BuildingOptions): void {
    if (options.scale !== undefined) this.options.scale = options.scale;
    if (options.maxLayers !== undefined) this.options.maxLayers = options.maxLayers;
    if (options.randomize !== undefined) this.options.randomize = options.randomize;
  }
}

/**
 * 便捷函数：快速生成建筑
 */
export function generateBuildingFromAudio(
  analysis: AudioAnalysisResult,
  name?: string,
  options?: BuildingOptions
): BuildingStructure {
  const generator = new BuildingGenerator(options);
  return generator.generateBuilding(analysis, name);
}

export default BuildingGenerator;
