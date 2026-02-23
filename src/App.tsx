import { useState, useCallback, useEffect, useRef } from 'react';
import './App.css';
import AudioRecorder from './components/AudioRecorder';
import GardenScene from './components/GardenScene';
import { AudioAnalyzer, AudioAnalysisResult } from './utils/AudioAnalyzer';
import { GardenGenerator, SoundGarden } from './utils/GardenGenerator';
import GameState, { Achievement } from './utils/GameState';

function App() {
  const VERSION = 'v2.0.0';
  const gameState = useRef(GameState.getInstance()).current;
  
  // 游戏状态
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [garden, setGarden] = useState<SoundGarden | null>(null);
  const [_analysisResult, setAnalysisResult] = useState<AudioAnalysisResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [currentFrequency, setCurrentFrequency] = useState(500);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  
  // 游戏界面状态
  const [activeTab, setActiveTab] = useState<'garden' | 'collection' | 'achievements'>('garden');
  const [showGamePanel, setShowGamePanel] = useState(false);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Achievement[]>([]);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);
  
  // 视觉模式
  const [isNightMode, setIsNightMode] = useState(false);
  const [weather, setWeather] = useState<'clear' | 'rain' | 'wind'>('clear');
  
  // 实时生成
  const recordingStartTime = useRef<number>(0);
  const plantGenerationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // 检查新成就
  useEffect(() => {
    const checkAchievements = () => {
      const newlyUnlocked = gameState.getUnlockedAchievements().filter(
        a => !unlockedAchievements.find(ua => ua.id === a.id)
      );
      
      if (newlyUnlocked.length > 0) {
        setNewAchievement(newlyUnlocked[0]);
        setUnlockedAchievements(gameState.getUnlockedAchievements());
        setTimeout(() => setNewAchievement(null), 3000);
      }
    };
    
    const interval = setInterval(checkAchievements, 1000);
    return () => clearInterval(interval);
  }, [unlockedAchievements, gameState]);

  // 开始录音
  const handleRecordingStart = useCallback(() => {
    setIsRecording(true);
    setError(null);
    setShowInstructions(false);
    recordingStartTime.current = Date.now();
  }, []);

  // 停止录音
  const handleRecordingStop = useCallback(() => {
    setIsRecording(false);
    setCurrentVolume(0);
    setCurrentFrequency(500);
    
    if (plantGenerationInterval.current) {
      clearInterval(plantGenerationInterval.current);
      plantGenerationInterval.current = null;
    }
  }, []);

  // 音量变化
  const handleVolumeChange = useCallback((volume: number, frequency?: number) => {
    setCurrentVolume(volume);
    if (frequency) {
      setCurrentFrequency(frequency);
    }
  }, []);

  // 录音完成
  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

      const analyzer = new AudioAnalyzer(audioContext);
      const file = new File([blob], 'recording.webm', { type: blob.type });
      const audioBuffer = await analyzer.loadAudioFile(file);
      const result = await analyzer.analyze(audioBuffer);

      setAnalysisResult(result);

      const generator = new GardenGenerator({
        gardenRadius: 20 + gameState.gardenLevel * 2,
        maxPlants: 30 + gameState.gardenLevel * 5,
        randomize: true,
      });

      const newGarden = generator.generateGarden(result, `花园 Lv.${gameState.gardenLevel}`);
      setGarden(newGarden);
      
      // 更新游戏状态
      gameState.recordRecording();
      gameState.stats.totalPlants += newGarden.plants.length;
      
      // 解锁植物
      if (result.pitch) {
        if (result.pitch > 1000) {
          gameState.unlockPlant('flower');
        }
      }
      
      // 夜晚模式成就
      if (isNightMode) {
        gameState.unlockAchievement('night_owl');
        gameState.unlockPlant('moon');
      }
      
      // 雨天成就
      if (weather === 'rain') {
        gameState.unlockAchievement('rain_dancer');
      }

    } catch (err) {
      console.error('分析失败:', err);
      setError(err instanceof Error ? err.message : '分析音频时发生错误');
    } finally {
      setIsAnalyzing(false);
    }
  }, [gameState, isNightMode, weather]);

  // 重置
  const handleReset = useCallback(() => {
    setGarden(null);
    setAnalysisResult(null);
    setError(null);
    setShowInstructions(true);
  }, []);

  // 切换天气
  const toggleWeather = () => {
    setWeather(prev => {
      if (prev === 'clear') return 'rain';
      if (prev === 'rain') return 'wind';
      return 'clear';
    });
  };

  const getFrequencyDesc = (freq: number) => {
    if (freq < 250) return { label: '低频', color: '#ef4444', icon: '🍄' };
    if (freq < 1000) return { label: '中频', color: '#f97316', icon: '🌳' };
    return { label: '高频', color: '#3b82f6', icon: '✨' };
  };

  const freqInfo = currentFrequency ? getFrequencyDesc(currentFrequency) : null;

  return (
    <div className={`app ${isNightMode ? 'night-mode' : ''} ${weather}`}>
      {/* 新成就提示 */}
      {newAchievement && (
        <div className="achievement-popup">
          <div className="achievement-content">
            <span className="achievement-icon">{newAchievement.icon}</span>
            <div>
              <h4>解锁成就！</h4>
              <p>{newAchievement.name}</p>
            </div>
          </div>
        </div>
      )}

      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">🌸</span>
          <div className="logo-text">
            <h1>Sound Garden</h1>
            <p>用声音种植属于你的花园</p>
          </div>
        </div>
        <div className="header-controls">
          <button 
            className={`mode-toggle ${isNightMode ? 'active' : ''}`} 
            onClick={() => setIsNightMode(!isNightMode)}
            title={isNightMode ? '切换到白天' : '切换到夜晚'}
          >
            {isNightMode ? '🌙' : '☀️'}
          </button>
          <button 
            className="weather-toggle" 
            onClick={toggleWeather}
            title="切换天气"
          >
            {weather === 'clear' ? '☀️' : weather === 'rain' ? '🌧️' : '💨'}
          </button>
          <button 
            className="game-panel-toggle" 
            onClick={() => setShowGamePanel(!showGamePanel)}
          >
            🎮
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="scene-container">
          <GardenScene
            garden={garden}
            isRecording={isRecording}
            currentVolume={currentVolume}
            currentFrequency={currentFrequency}
            isNightMode={isNightMode}
            weather={weather}
          />

          {(isRecording || garden) && (
            <div className="floating-info">
              {isRecording && freqInfo && (
                <div className="freq-badge" style={{ backgroundColor: freqInfo.color + '33', borderColor: freqInfo.color }}>
                  <span>{freqInfo.icon}</span>
                  <span>{freqInfo.label}</span>
                </div>
              )}
              {garden && (
                <div className="garden-badge">
                  <span>🌿 {garden.name}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`control-panel ${showGamePanel ? 'game-panel-open' : ''}`}>
          {/* 游戏面板 */}
          {showGamePanel && (
            <div className="game-panel">
              <div className="panel-tabs">
                <button 
                  className={activeTab === 'garden' ? 'active' : ''}
                  onClick={() => setActiveTab('garden')}
                >
                  🌱 花园
                </button>
                <button 
                  className={activeTab === 'collection' ? 'active' : ''}
                  onClick={() => setActiveTab('collection')}
                >
                  📚 图鉴
                </button>
                <button 
                  className={activeTab === 'achievements' ? 'active' : ''}
                  onClick={() => setActiveTab('achievements')}
                >
                  🏆 成就
                </button>
              </div>

              {activeTab === 'garden' && (
                <div className="garden-stats">
                  <div className="level-bar">
                    <div className="level-info">
                      <span>花园等级 {gameState.gardenLevel}</span>
                      <span>{gameState.gardenExp}/{gameState.expToNextLevel} XP</span>
                    </div>
                    <div className="exp-bar">
                      <div 
                        className="exp-fill" 
                        style={{ width: `${(gameState.gardenExp / gameState.expToNextLevel) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="quick-stats">
                    <div className="quick-stat">
                      <span>🎤</span>
                      <span>{gameState.stats.totalRecordings} 次录音</span>
                    </div>
                    <div className="quick-stat">
                      <span>🌿</span>
                      <span>{gameState.stats.totalPlants} 株植物</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'collection' && (
                <div className="collection-panel">
                  <h4>🌸 植物图鉴 ({gameState.getUnlockedPlants().length}/{gameState.collections.length})</h4>
                  <div className="collection-grid">
                    {gameState.collections.map(plant => (
                      <div 
                        key={plant.id} 
                        className={`collection-item ${plant.unlocked ? 'unlocked' : 'locked'}`}
                        title={plant.unlocked ? plant.name : plant.unlockCondition}
                      >
                        <span className="collection-icon">{plant.unlocked ? plant.icon : '🔒'}</span>
                        <span className="collection-name">{plant.unlocked ? plant.name : '???'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'achievements' && (
                <div className="achievements-panel">
                  <h4>🏆 成就 ({gameState.getUnlockedAchievements().length}/{gameState.achievements.length})</h4>
                  <div className="achievements-list">
                    {gameState.achievements.map(achievement => (
                      <div 
                        key={achievement.id} 
                        className={`achievement-item ${achievement.unlocked ? 'unlocked' : 'locked'}`}
                      >
                        <span className="achievement-icon">{achievement.icon}</span>
                        <div className="achievement-info">
                          <strong>{achievement.name}</strong>
                          <span>{achievement.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {garden ? (
            <div className="garden-info">
              <div className="info-header">
                <span className="garden-icon">🌿</span>
                <h3>{garden.name}</h3>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-icon">🌱</span>
                  <div className="stat-content">
                    <span className="stat-label">植物</span>
                    <span className="stat-value">{garden.plants.length}</span>
                  </div>
                </div>

                <div className="stat-card">
                  <span className="stat-icon">⏱️</span>
                  <div className="stat-content">
                    <span className="stat-label">时长</span>
                    <span className="stat-value">{garden.duration.toFixed(1)}s</span>
                  </div>
                </div>

                <div className="stat-card">
                  <span className="stat-icon">🔗</span>
                  <div className="stat-content">
                    <span className="stat-label">连接</span>
                    <span className="stat-value">{garden.connections.length}</span>
                  </div>
                </div>
              </div>

              <button className="reset-button" onClick={handleReset}>
                <span>🔄</span>
                重新种植
              </button>
            </div>
          ) : (
            <>
              {showInstructions && (
                <div className="instructions">
                  <div className="instructions-header">
                    <span>🎮</span>
                    <h3>游戏指南 v2.0</h3>
                  </div>

                  <div className="guide-section">
                    <h4>🌱 如何种植</h4>
                    <ul>
                      <li>按住录音按钮，发出声音</li>
                      <li>实时看到植物生长！</li>
                      <li>音量越大，植物越高</li>
                      <li>不同音高长出不同植物</li>
                    </ul>
                  </div>

                  <div className="guide-section">
                    <h4>🎮 游戏特色</h4>
                    <ul>
                      <li>🌙 夜晚模式：植物会发光</li>
                      <li>🌧️ 天气效果：雨、风影响植物</li>
                      <li>📚 收集系统：解锁8种植物</li>
                      <li>🏆 成就系统：完成挑战</li>
                    </ul>
                  </div>
                </div>
              )}

              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                onRecordingStart={handleRecordingStart}
                onRecordingStop={handleRecordingStop}
                onVolumeChange={handleVolumeChange}
                disabled={isAnalyzing}
              />

              {isAnalyzing && (
                <div className="analyzing">
                  <div className="spinner-container">
                    <div className="spinner"></div>
                    <div className="spinner-inner"></div>
                  </div>
                  <p>正在种植声音花园...</p>
                  <span className="analyzing-sub">分析音高、节奏、和声</span>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>Sound Garden {VERSION} © 2024 | React + Three.js + Web Audio API</p>
      </footer>
    </div>
  );
}

export default App;
