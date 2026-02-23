import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioRecorderProps {
  onRecordingComplete?: (blob: Blob) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onVolumeChange?: (volume: number) => void;
  disabled?: boolean;
}

export default function AudioRecorder({ 
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  onVolumeChange,
  disabled = false
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [volume, setVolume] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 清理资源
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // 开始录音
  const startRecording = async () => {
    if (disabled) return;
    
    try {
      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 创建 AudioContext
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      // 创建 AnalyserNode 用于音量可视化
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      // 连接麦克风到 analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;
      
      // 创建 MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        onRecordingComplete?.(audioBlob);
      };
      
      // 开始录制
      mediaRecorder.start(100); // 每 100ms 收集一次数据
      setIsRecording(true);
      setRecordingTime(0);
      onRecordingStart?.();
      
      // 启动计时器
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // 启动音量可视化
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateVolume = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // 计算平均音量
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalizedVolume = Math.min(average / 128, 1); // 归一化到 0-1
        
        setVolume(normalizedVolume);
        onVolumeChange?.(normalizedVolume);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      
      updateVolume();
      
    } catch (error) {
      console.error('无法访问麦克风:', error);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setIsRecording(false);
    setVolume(0);
    onVolumeChange?.(0);
    onRecordingStop?.();
  };

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取音量条颜色
  const getVolumeColor = () => {
    if (volume < 0.3) return '#4ade80'; // 绿色 - 低频
    if (volume < 0.6) return '#fbbf24'; // 黄色 - 中频
    return '#3b82f6'; // 蓝色 - 高频
  };

  return (
    <div style={{
      ...styles.container,
      opacity: disabled ? 0.5 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
    }}>
      {/* 录音时间 */}
      <div style={styles.timeDisplay}>
        {formatTime(recordingTime)}
      </div>
      
      {/* 音量可视化 */}
      <div style={styles.visualizerContainer}>
        <div style={styles.volumeBars}>
          {Array.from({ length: 20 }).map((_, i) => {
            const threshold = (i + 1) / 20;
            const isActive = volume >= threshold;
            return (
              <div
                key={i}
                style={{
                  ...styles.volumeBar,
                  backgroundColor: isActive ? getVolumeColor() : '#374151',
                  height: `${Math.max(8, (i + 1) * 4)}px`,
                }}
              />
            );
          })}
        </div>
        <div style={styles.volumeText}>
          音量: {Math.round(volume * 100)}%
        </div>
      </div>
      
      {/* 控制按钮 */}
      <div style={styles.controls}>
        {!isRecording ? (
          <button
            onClick={startRecording}
            style={{ ...styles.button, ...styles.startButton }}
          >
            <span style={styles.buttonIcon}>🎤</span>
            按住录音
          </button>
        ) : (
          <button
            onClick={stopRecording}
            style={{ ...styles.button, ...styles.stopButton }}
          >
            <span style={styles.buttonIcon}>⏹</span>
            停止录音
          </button>
        )}
      </div>
      
      {/* 状态指示 */}
      <div style={styles.status}>
        {isRecording ? (
          <span style={styles.recordingIndicator}>
            <span style={styles.recordingDot} /> 正在聆听你的声音...
          </span>
        ) : (
          <span style={styles.idleStatus}>点击按钮开始建造</span>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '1.5rem',
    backgroundColor: '#1a1a2e',
    borderRadius: '12px',
    border: '1px solid #333355',
    transition: 'opacity 0.2s',
  },
  timeDisplay: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: '1rem',
    textShadow: '0 0 20px rgba(102, 126, 234, 0.5)',
  },
  visualizerContainer: {
    marginBottom: '1.25rem',
  },
  volumeBars: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: '4px',
    height: '80px',
    padding: '10px',
    backgroundColor: '#0a0a0f',
    borderRadius: '8px',
    border: '1px solid #222244',
  },
  volumeBar: {
    width: '8px',
    borderRadius: '2px',
    transition: 'all 0.05s ease',
  },
  volumeText: {
    textAlign: 'center',
    color: '#8888aa',
    fontSize: '0.875rem',
    marginTop: '0.5rem',
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '1rem 1.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  startButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
  },
  stopButton: {
    background: 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)',
    color: 'white',
  },
  buttonIcon: {
    fontSize: '1.2rem',
  },
  status: {
    textAlign: 'center',
    fontSize: '0.875rem',
  },
  recordingIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: '#f87171',
  },
  recordingDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#f87171',
    borderRadius: '50%',
    animation: 'pulse 1s infinite',
  },
  idleStatus: {
    color: '#666688',
  },
};
