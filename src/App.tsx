import { useState, useCallback, useRef } from 'react';
import './App.css';
import AudioRecorder from './components/AudioRecorder';
import BuildingScene from './components/BuildingScene';
import { AudioAnalyzer, AudioAnalysisResult } from './utils/AudioAnalyzer';
import { BuildingGenerator, BuildingStructure } from './utils/BuildingGenerator';

function App() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [building, setBuilding] = useState<BuildingStructure | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AudioAnalysisResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [currentFrequency, setCurrentFrequency] = useState(500);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  
  // 实时分析器
  const realtimeAnalyzerRef = useRef<AudioAnalyzer | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const handleRecordingStart = useCallback(() => {
    setIsRecording(true);
    setError(null);
    setShowInstructions(false);
    
    // 初始化实时分析
    try {
      const audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      realtimeAnalyzerRef.current = new AudioAnalyzer(audioContext);
    } catch (err) {
      console.error('初始化音频分析器失败:', err);
    }
  }, []);

  const handleRecordingStop = useCallback(() => {
    setIsRecording(false);
    setCurrentVolume(0);
    setCurrentFrequency(500);
    
    // 清理实时分析
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    realtimeAnalyzerRef.current = null;
  }, []);

  const handleVolumeChange = useCallback((volume: number) => {
    setCurrentVolume(volume);
  }, []);

  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      // 创建音频分析器
      const audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      const analyzer = new AudioAnalyzer(audioContext);
      
      // 将 Blob 转换为 File
      const file = new File([blob], 'recording.webm', { type: blob.type });
      
      // 加载并分析音频
      const audioBuffer = await analyzer.loadAudioFile(file);
      const result = await analyzer.analyze(audioBuffer);
      
      setAnalysisResult(result);
      
      // 生成建筑
      const generator = new BuildingGenerator({
        scale: 1.5,
        maxLayers: 30,
        randomize: true,
      });
      
      const newBuilding = generator.generateBuilding(result, 'Sound Building');
      setBuilding(newBuilding);
      
    } catch (err) {
      console.error('分析失败:', err);
      setError(err instanceof Error ? err.message : '分析音频时发生错误');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setBuilding(null);
    setAnalysisResult(null);
    setError(null);
    setShowInstructions(true);
  }, []);

  // 获取频率描述
  const getFrequencyDesc = (freq: number) => {
    if (freq < 250) return { label: '低频', color: '#ef4444', icon: '🟥' };
    if (freq < 1000) return { label: '中频', color: '#f97316', icon: '🟧' };
    return { label: '高频', color: '#3b82f6', icon: '🟦' };
  };

  const freqInfo = currentFrequency ? getFrequencyDesc(currentFrequency) : null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">🏗️</span>
          <div className="logo-text">
            <h1>Sound Architect</h1>
            <p>用声音建造属于你的建筑</p>
          </div>
        </div>
      </header>
      
      <main className="app-main">
        <div className="scene-container">
          <BuildingScene 
            building={building} 
            isRecording={isRecording}
            currentVolume={currentVolume}
            currentFrequency={currentFrequency}
          />
          
          {/* 悬浮信息面板 */}
          {(isRecording || building) && (
            <div className="floating-info">
              {isRecording && freqInfo && (
                <div className="freq-badge" style={{ backgroundColor: freqInfo.color + '33', borderColor: freqInfo.color }}>
                  <span>{freqInfo.icon}</span>
                  <span>{freqInfo.label}</span>
                </div>
              )}
              {building && (
                <div className="building-badge">
                  <span>🏢 {building.name}</span>
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
          
          {building ? (
            <div className="building-info">
              <div className="info-header">
                <span className="building-icon">🏢</span>
                <h3>{building.name}</h3>
              </div>
              
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-icon">📏</span>
                  <div className="stat-content">
                    <span className="stat-label">高度</span>
                    <span className="stat-value">{building.totalHeight.toFixed(1)}m</span>
                  </div>
                </div>
                
                <div className="stat-card">
                  <span className="stat-icon">🧱</span>
                  <div className="stat-content">
                    <span className="stat-label">模块</span>
                    <span className="stat-value">{building.modules.length}</span>
                  </div>
                </div>
                
                <div className="stat-card stability">
                  <span className="stat-icon">⚖️</span>
                  <div className="stat-content">
                    <span className="stat-label">稳定性</span>
                    <span className={`stat-value stability-${
                      building.stabilityScore >= 80 ? 'good' : 
                      building.stabilityScore >= 50 ? 'medium' : 'poor'
                    }`}>
                      {building.stabilityScore.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
              
              {analysisResult && (
                <div className="audio-details">
                  <h4>🎵 音频分析</h4>                  
                  <div className="detail-row">
                    <span>⏱️ 时长</span>
                    <span>{analysisResult.duration.toFixed(2)}s</span>
                  </div>
                  
                  <div className="detail-row">
                    <span>🔊 音量</span>
                    <div className="volume-bar">
                      <div 
                        className="volume-fill" 
                        style={{ width: `${analysisResult.volume * 100}%` }}
                      />
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
                重新录制
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
                    <h4>🎨 颜色规则</h4>
                    <div className="guide-item">
                      <span className="color-dot" style={{ background: '#ef4444' }}></span>
                      <div>
                        <strong>低频 (50-250Hz)</strong>
                        <span>红色地基 - 宽大稳固</span>
                      </div>
                    </div>
                    
                    <div className="guide-item">
                      <span className="color-dot" style={{ background: '#f97316' }}></span>
                      <div>
                        <strong>中频 (250-1000Hz)</strong>
                        <span>橙色主体 - 中等高度</span>
                      </div>
                    </div>
                    
                    <div className="guide-item">
                      <span className="color-dot" style={{ background: '#3b82f6' }}></span>
                      <div>
                        <strong>高频 (1000-5000Hz)</strong>
                        <span>蓝色尖顶 - 细长空灵</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="guide-section">
                    <h4>📏 尺寸规则</h4>
                    <ul>
                      <li>🔊 音量越大 → 模块越大</li>
                      <li>⏱️ 时间越长 → 层数越多</li>
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
                  <p>正在分析音频并生成建筑...</p>
                  <span className="analyzing-sub">提取音高、音量、时长特征</span>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      
      <footer className="app-footer">
        <p>Sound Architect © 2024 | React + Three.js + Web Audio API</p>
      </footer>
    </div>
  );
}

export default App;
