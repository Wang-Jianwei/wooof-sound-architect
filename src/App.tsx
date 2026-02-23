import './App.css'
import AudioRecorder from './components/AudioRecorder'

function App() {
  const handleRecordingComplete = (blob: Blob) => {
    console.log('录音完成，文件大小:', blob.size, 'bytes');
    // 这里可以处理录音文件，例如上传或下载
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Sound Architect</h1>
        <p>React + TypeScript + Vite</p>
      </header>
      <main className="app-main">
        <AudioRecorder onRecordingComplete={handleRecordingComplete} />
      </main>
    </div>
  )
}

export default App
