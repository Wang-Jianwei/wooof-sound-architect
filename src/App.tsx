import { useState, useCallback } from 'react';
import './App.css';
import AudioRecorder from './components/AudioRecorder';
import GardenScene from './components/GardenScene';
import { AudioAnalyzer, AudioAnalysisResult } from './utils/AudioAnalyzer';
import { GardenGenerator, SoundGarden } from './utils/GardenGenerator';

function App() {
  const VERSION = 'v1.0.2';
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [garden, setGarden] = useState<SoundGarden | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AudioAnalysisResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [currentFrequency, setCurrentFrequency] = useState(500);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  const handleRecordingStart = useCallback(() => {
    setIsRecording(true);
    setError(null);
    setShowInstructions(false);
  }, []);

  const handleRecordingStop = useCallback(() => {
    setIsRecording(false);
    setCurrentVolume(0);
    setCurrentFrequency(500);
  }, []);

  const handleVolumeChange = useCallback((volume: number) => {
    setCurrentVolume(volume);
  }, []);

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
        gardenRadius: 20,
        maxPlants: 50,
        randomize: true,
      });

      const newGarden = generator.generateGarden(result, 'My Sound Garden');
      setGarden(newGarden);

    } catch (err) {
      console.error('分析失败:', err);
      setError(err instanceof Error ? err.message : '分析音频时发生错误');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setGarden(null);
    setAnalysisResult(null);
    setError(null);
    setShowInstructions(true);
  }, []);

  const getFrequencyDesc = (freq: number) => {
    if (freq < 250) return { label: '低频', color: '#ef4444', icon: '🍄' };
    if (freq < 1000) return { label: '中频', color: '#f97316', icon: '🌳' };
    return { label: '高频', color: '#3b82f6', icon: '✨' };
  };

  const freqInfo = currentFrequency ? getFrequencyDesc(currentFrequency) : null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">🌸</span>
          <div className="logo-text">
            <h1>Sound Garden</h1>
            <p>用声音种植属于你的花园</p>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="scene-container">
          <GardenScene
            garden={garden}
            isRecording={isRecording}
            currentVolume={currentVolume}
            currentFrequency={currentFrequency}
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

        <div className="control-panel">
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

              <div className="plant-legend">
                <h4>🌸 植物图鉴</h4>
                <div className="legend-item">
                  <span className="legend-icon">🍄</span>
                  <div>
                    <strong>音菇</strong>
                    <span>低频 (50-250Hz) · 缓慢呼吸</span>
                  </div>
                </div>
                <div className="legend-item">
                  <span className="legend-icon">🌳</span>
                  <div>
                    <strong>音树</strong>
                    <span>中频 (250-1000Hz) · 随风摇摆</span>
                  </div>
                </div>
                <div className="legend-item">
                  <span className="legend-icon">✨</span>
                  <div>
                    <strong>音塔</strong>
                    <span>高频 (1000-5000Hz) · 闪烁旋转</span>
                  </div>
                </div>
              </div>

              {analysisResult && (
                <div className="audio-details">
                  <h4>🎵 音频分析</h4>
                  <div className="detail-row">
                    <span>🔊 音量</span>
                    <div className="volume-bar">
                      <div className="volume-fill" style={{ width: `${analysisResult.volume * 100}%` }} />
                    </div>
                  </div>
                  {analysisResult.pitch && (
                    <div className="detail-row">
                      <span>🎹 音高</span>
                      <span>{analysisResult.pitch.toFixed(0)}Hz {analysisResult.note && `(${analysisResult.note})`}</span>
                    </div>
                  )}
                </div>
              )}

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
                    <h3>游戏指南</h3>
                  </div>

                  <div className="guide-section">
                    <h4>🌱 如何种植</h4>
                    <ul>
                      <li>按住录音按钮，发出声音</li>
                      <li>声音会在圆形花园中"播种"</li>
                      <li>不同音高长出不同植物</li>
                      <li>和谐音符会产生金色连线</li>
                    </ul>
                  </div>

                  <div className="guide-section">
                    <h4>🎵 植物类型</h4>
                    <div className="guide-item">
                      <span className="color-dot" style={{ background: '#ef4444' }}></span>
                      <div>
                        <strong>低频</strong>
                        <span>红色音菇 · 低矮宽大</span>
                      </div>
                    </div>
                    <div className="guide-item">
                      <span className="color-dot" style={{ background: '#f97316' }}></span>
                      <div>
                        <strong>中频</strong>
                        <span>橙色音树 · 随风摇摆</span>
                      </div>
                    </div>
                    <div className="guide-item">
                      <span className="color-dot" style={{ background: '#3b82f6' }}></span>
                      <div>
                        <strong>高频</strong>
                        <span>蓝色音塔 · 闪烁旋转</span>
                      </div>
                    </div>
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
