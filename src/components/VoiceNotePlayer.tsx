import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, FastForward, Rewind, Volume2 } from 'lucide-react';

interface VoiceNotePlayerProps {
  url: string;
  accentColor?: string;
}

export default function VoiceNotePlayer({ url, accentColor = 'var(--accent)' }: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);

  // Generate realistic waveform from audio data
  useEffect(() => {
    if (!url) return;

    const analyzeAudio = async () => {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const rawData = audioBuffer.getChannelData(0); // We only need one channel
        const samples = 40; // Number of bars
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData = [];
        
        for (let i = 0; i < samples; i++) {
          let blockStart = blockSize * i;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum = sum + Math.abs(rawData[blockStart + j]);
          }
          filteredData.push(sum / blockSize);
        }

        // Normalize data
        const multiplier = Math.pow(Math.max(...filteredData), -1);
        const normalizedData = filteredData.map(n => Math.max(0.1, n * multiplier)); // Ensure at least 10% height
        
        setWaveform(normalizedData);
      } catch (e) {
        console.error("Error analyzing audio waveform:", e);
        // Fallback to random waveform if analysis fails
        const bars = 40;
        const seed = url.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const data = [];
        for (let i = 0; i < bars; i++) {
          const val = Math.abs(Math.sin(seed + i * 0.5) * 0.7) + 0.2;
          data.push(val);
        }
        setWaveform(data);
      }
    };

    analyzeAudio();
  }, [url]);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [url]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = percent * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div className="flex flex-col space-y-2 w-full min-w-[200px] p-1">
      <div className="flex items-center space-x-3">
        <button 
          onClick={togglePlay}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--accent)] text-black hover:opacity-90 transition-all shrink-0"
        >
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
        </button>

        <div className="flex-1 flex flex-col space-y-1 justify-center">
          {/* Waveform Visualization */}
          <div 
            className="h-8 flex items-center space-x-[2px] cursor-pointer group"
            onClick={handleSeek}
          >
            {waveform.map((val, i) => {
              const progress = (currentTime / duration) || 0;
              const isPlayed = (i / waveform.length) <= progress;
              return (
                <div 
                  key={i}
                  className="w-[3px] rounded-full transition-all duration-75"
                  style={{ 
                    height: `${Math.max(15, val * 100)}%`,
                    backgroundColor: isPlayed ? accentColor : 'var(--text-muted)',
                    opacity: isPlayed ? 1 : 0.3
                  }}
                />
              );
            })}
          </div>
          
          <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-tighter">
            <span>{formatTime(currentTime)}</span>
            <span>-{formatTime(duration - currentTime)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-2 flex-1 max-w-[120px]">
          <span className="text-[9px] font-bold uppercase text-[var(--text-muted)]">Speed</span>
          <input 
            type="range" 
            min="0.5" 
            max="3" 
            step="0.1" 
            value={playbackRate}
            onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex-1 h-1 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
          />
          <span className="text-[9px] font-mono w-6">{playbackRate}x</span>
        </div>
        
        <div className="flex space-x-1">
           <Volume2 size={12} className="text-[var(--text-muted)]" />
        </div>
      </div>
    </div>
  );
}
