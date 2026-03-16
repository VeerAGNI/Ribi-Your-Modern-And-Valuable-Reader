import React, { useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { Music, Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { Theme } from '../types';
import { THEMES, BACKGROUND_TRACKS } from '../constants';
import { cn } from '../utils';

interface MusicPlayerProps {
  currentTrackId: string | null;
  volume: number;
  onTrackChange: (id: string | null) => void;
  onVolumeChange: (vol: number) => void;
  theme: Theme;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  currentTrackId,
  volume,
  onTrackChange,
  onVolumeChange,
  theme,
}) => {
  const soundRef = useRef<Howl | null>(null);
  const currentTheme = THEMES[theme];

  useEffect(() => {
    if (currentTrackId) {
      const track = BACKGROUND_TRACKS.find(t => t.id === currentTrackId);
      if (track) {
        if (soundRef.current) {
          soundRef.current.stop();
          soundRef.current.unload();
        }

        soundRef.current = new Howl({
          src: [track.url],
          html5: true,
          loop: true,
          volume: volume,
        });

        soundRef.current.play();
      }
    } else {
      if (soundRef.current) {
        soundRef.current.stop();
      }
    }

    return () => {
      if (soundRef.current) {
        soundRef.current.stop();
      }
    };
  }, [currentTrackId]);

  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.volume(volume);
    }
  }, [volume]);

  const togglePlay = () => {
    if (!currentTrackId) {
      onTrackChange(BACKGROUND_TRACKS[0].id);
    } else {
      onTrackChange(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 rounded-2xl" style={{ backgroundColor: currentTheme.secondary }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
            <Music size={18} />
          </div>
          <div>
            <p className="text-xs font-medium opacity-50" style={{ color: currentTheme.text }}>Background Music</p>
            <p className="text-sm font-semibold" style={{ color: currentTheme.text }}>
              {currentTrackId ? BACKGROUND_TRACKS.find(t => t.id === currentTrackId)?.name : 'None'}
            </p>
          </div>
        </div>
        <button 
          onClick={togglePlay}
          className="p-2 rounded-full hover:bg-black/5 transition-colors"
          style={{ color: currentTheme.accent }}
        >
          {currentTrackId ? <Pause size={20} /> : <Play size={20} />}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => onVolumeChange(volume === 0 ? 0.5 : 0)} style={{ color: currentTheme.text }}>
          {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <input 
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="flex-1 h-1 bg-black/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {BACKGROUND_TRACKS.map(track => (
          <button
            key={track.id}
            onClick={() => onTrackChange(track.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
              currentTrackId === track.id 
                ? "bg-blue-500 text-white" 
                : "bg-black/5 hover:bg-black/10"
            )}
            style={{ 
              color: currentTrackId === track.id ? '#FFF' : currentTheme.text,
              backgroundColor: currentTrackId === track.id ? currentTheme.accent : undefined
            }}
          >
            {track.name}
          </button>
        ))}
      </div>
    </div>
  );
};
