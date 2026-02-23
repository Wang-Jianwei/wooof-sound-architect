/**
 * 游戏状态管理
 * 管理花园等级、收集进度、成就等
 */

export interface PlantCollection {
  id: string;
  name: string;
  icon: string;
  unlocked: boolean;
  unlockCondition: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: number;
}

export interface GameStats {
  totalRecordings: number;
  totalPlants: number;
  maxGardenLevel: number;
  playTime: number; // 秒
}

export class GameState {
  private static instance: GameState;
  
  // 花园等级
  gardenLevel: number = 1;
  gardenExp: number = 0;
  expToNextLevel: number = 100;
  
  // 收集系统
  collections: PlantCollection[] = [
    { id: 'mushroom', name: '音菇', icon: '🍄', unlocked: true, unlockCondition: '初始解锁' },
    { id: 'tree', name: '音树', icon: '🌳', unlocked: true, unlockCondition: '初始解锁' },
    { id: 'spire', name: '音塔', icon: '✨', unlocked: true, unlockCondition: '初始解锁' },
    { id: 'crystal', name: '音晶', icon: '💎', unlocked: false, unlockCondition: '连续录音3次解锁' },
    { id: 'flower', name: '音花', icon: '🌸', unlocked: false, unlockCondition: '录制高频音符解锁' },
    { id: 'star', name: '音星', icon: '⭐', unlocked: false, unlockCondition: '达到花园等级5解锁' },
    { id: 'moon', name: '音月', icon: '🌙', unlocked: false, unlockCondition: '夜晚模式下录音解锁' },
    { id: 'rainbow', name: '音虹', icon: '🌈', unlocked: false, unlockCondition: '录制完整音阶解锁' },
  ];
  
  // 成就系统
  achievements: Achievement[] = [
    { id: 'first_recording', name: '初次发声', description: '完成第一次录音', icon: '🎤', unlocked: false },
    { id: 'three_in_a_row', name: '三连击', description: '连续录音3次', icon: '🔥', unlocked: false },
    { id: 'harmony_master', name: '和声大师', description: '录制出和谐和弦', icon: '🎵', unlocked: false },
    { id: 'night_owl', name: '夜猫子', description: '在夜晚模式下录音', icon: '🦉', unlocked: false },
    { id: 'rain_dancer', name: '雨中舞者', description: '在雨天录音', icon: '🌧️', unlocked: false },
    { id: 'collector', name: '收藏家', description: '解锁所有植物种类', icon: '🏆', unlocked: false },
    { id: 'level_5', name: '花园大师', description: '花园达到5级', icon: '👑', unlocked: false },
    { id: 'melody_maker', name: '旋律创造者', description: '录制连续5个音符', icon: '🎼', unlocked: false },
  ];
  
  // 统计
  stats: GameStats = {
    totalRecordings: 0,
    totalPlants: 0,
    maxGardenLevel: 1,
    playTime: 0,
  };
  
  // 连续录音计数
  consecutiveRecordings: number = 0;
  lastRecordingTime: number = 0;
  
  private constructor() {
    this.loadFromStorage();
  }
  
  static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }
  
  // 添加经验值
  addExp(amount: number): void {
    this.gardenExp += amount;
    if (this.gardenExp >= this.expToNextLevel) {
      this.levelUp();
    }
    this.saveToStorage();
  }
  
  // 升级
  private levelUp(): void {
    this.gardenLevel++;
    this.gardenExp -= this.expToNextLevel;
    this.expToNextLevel = Math.floor(this.expToNextLevel * 1.5);
    this.stats.maxGardenLevel = Math.max(this.stats.maxGardenLevel, this.gardenLevel);
    
    // 检查等级相关成就
    if (this.gardenLevel >= 5) {
      this.unlockAchievement('level_5');
    }
    
    // 解锁等级相关植物
    if (this.gardenLevel >= 5) {
      this.unlockPlant('star');
    }
    
    this.saveToStorage();
  }
  
  // 记录录音
  recordRecording(): void {
    this.stats.totalRecordings++;
    
    const now = Date.now();
    if (now - this.lastRecordingTime < 60000) { // 1分钟内
      this.consecutiveRecordings++;
    } else {
      this.consecutiveRecordings = 1;
    }
    this.lastRecordingTime = now;
    
    // 检查成就
    if (this.stats.totalRecordings === 1) {
      this.unlockAchievement('first_recording');
    }
    if (this.consecutiveRecordings >= 3) {
      this.unlockAchievement('three_in_a_row');
      this.unlockPlant('crystal');
    }
    
    this.addExp(10);
    this.saveToStorage();
  }
  
  // 解锁植物
  unlockPlant(plantId: string): void {
    const plant = this.collections.find(p => p.id === plantId);
    if (plant && !plant.unlocked) {
      plant.unlocked = true;
      this.checkCollectorAchievement();
      this.saveToStorage();
    }
  }
  
  // 解锁成就
  unlockAchievement(achievementId: string): void {
    const achievement = this.achievements.find(a => a.id === achievementId);
    if (achievement && !achievement.unlocked) {
      achievement.unlocked = true;
      achievement.unlockedAt = Date.now();
      this.saveToStorage();
    }
  }
  
  // 检查收藏家成就
  private checkCollectorAchievement(): void {
    const allUnlocked = this.collections.every(p => p.unlocked);
    if (allUnlocked) {
      this.unlockAchievement('collector');
    }
  }
  
  // 获取已解锁植物列表
  getUnlockedPlants(): PlantCollection[] {
    return this.collections.filter(p => p.unlocked);
  }
  
  // 获取已解锁成就列表
  getUnlockedAchievements(): Achievement[] {
    return this.achievements.filter(a => a.unlocked);
  }
  
  // 保存到本地存储
  private saveToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sound-garden-state', JSON.stringify({
        gardenLevel: this.gardenLevel,
        gardenExp: this.gardenExp,
        expToNextLevel: this.expToNextLevel,
        collections: this.collections,
        achievements: this.achievements,
        stats: this.stats,
        consecutiveRecordings: this.consecutiveRecordings,
        lastRecordingTime: this.lastRecordingTime,
      }));
    }
  }
  
  // 从本地存储加载
  private loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('sound-garden-state');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          this.gardenLevel = data.gardenLevel || 1;
          this.gardenExp = data.gardenExp || 0;
          this.expToNextLevel = data.expToNextLevel || 100;
          this.stats = data.stats || this.stats;
          this.consecutiveRecordings = data.consecutiveRecordings || 0;
          this.lastRecordingTime = data.lastRecordingTime || 0;
          
          if (data.collections) {
            this.collections = data.collections;
          }
          if (data.achievements) {
            this.achievements = data.achievements;
          }
        } catch (e) {
          console.error('Failed to load game state:', e);
        }
      }
    }
  }
  
  // 重置游戏
  reset(): void {
    this.gardenLevel = 1;
    this.gardenExp = 0;
    this.expToNextLevel = 100;
    this.consecutiveRecordings = 0;
    this.lastRecordingTime = 0;
    this.stats = {
      totalRecordings: 0,
      totalPlants: 0,
      maxGardenLevel: 1,
      playTime: 0,
    };
    this.collections.forEach(p => {
      if (p.id !== 'mushroom' && p.id !== 'tree' && p.id !== 'spire') {
        p.unlocked = false;
      }
    });
    this.achievements.forEach(a => {
      a.unlocked = false;
      a.unlockedAt = undefined;
    });
    this.saveToStorage();
  }
}

export default GameState;
