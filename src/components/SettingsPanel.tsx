import React from 'react';
import { Settings, Moon, Sun, Coffee, Cloud, Zap, Type, AlignLeft, MousePointer2 } from 'lucide-react';
import { Theme, ReaderSettings, ViewMode, FontFamily } from '../types';
import { THEMES, FONT_FAMILIES } from '../constants';
import { cn } from '../utils';

interface SettingsPanelProps {
  settings: ReaderSettings;
  onUpdate: (updates: Partial<ReaderSettings>) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onUpdate }) => {
  const currentTheme = THEMES[settings.theme];

  const themeOptions: { id: Theme; icon: any; label: string }[] = [
    { id: 'light', icon: Sun, label: 'Light' },
    { id: 'dark', icon: Moon, label: 'Dark' },
    { id: 'sepia', icon: Coffee, label: 'Sepia' },
    { id: 'nord', icon: Cloud, label: 'Nord' },
    { id: 'midnight', icon: Zap, label: 'Midnight' },
  ];

  const viewModeOptions: { id: ViewMode; label: string }[] = [
    { id: 'page', label: 'Single Page' },
    { id: 'continuous', label: 'Continuous' },
  ];

  return (
    <div className="flex flex-col gap-8 p-6">
      {/* View Mode Selection */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-widest mb-4 opacity-50" style={{ color: currentTheme.text }}>
          View Mode
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {viewModeOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => onUpdate({ viewMode: opt.id })}
              className={cn(
                "p-3 rounded-xl transition-all border-2 text-xs font-bold",
                settings.viewMode === opt.id
                  ? "border-blue-500 bg-blue-500/5 text-blue-500"
                  : "border-transparent hover:bg-black/5"
              )}
              style={{ color: settings.viewMode === opt.id ? '#3B82F6' : currentTheme.text }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Theme Selection */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-widest mb-4 opacity-50" style={{ color: currentTheme.text }}>
          Appearance
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {themeOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => onUpdate({ theme: opt.id })}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-xl transition-all border-2",
                settings.theme === opt.id
                  ? "border-blue-500 bg-blue-500/5"
                  : "border-transparent hover:bg-black/5"
              )}
            >
              <opt.icon size={20} style={{ color: settings.theme === opt.id ? '#3B82F6' : currentTheme.text }} />
              <span className="text-[10px] font-medium" style={{ color: currentTheme.text }}>{opt.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Brightness */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest opacity-50" style={{ color: currentTheme.text }}>
            Brightness
          </h3>
          <span className="text-xs font-mono" style={{ color: currentTheme.text }}>{settings.brightness}%</span>
        </div>
        <input
          type="range"
          min="20"
          max="100"
          value={settings.brightness}
          onChange={(e) => onUpdate({ brightness: parseInt(e.target.value) })}
          className="w-full h-1.5 bg-black/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </section>

      {/* Auto Reading */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-widest opacity-50" style={{ color: currentTheme.text }}>
              Auto Reading
            </h3>
            <div className={cn(
              "w-2 h-2 rounded-full",
              settings.isAutoScrolling ? "bg-green-500 animate-pulse" : "bg-red-500"
            )} />
          </div>
          <button
            onClick={() => onUpdate({ isAutoScrolling: !settings.isAutoScrolling })}
            className={cn(
              "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter transition-all",
              settings.isAutoScrolling ? "bg-green-500 text-white" : "bg-black/10"
            )}
            style={{ color: settings.isAutoScrolling ? '#FFF' : currentTheme.text }}
          >
            {settings.isAutoScrolling ? 'Active' : 'Disabled'}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] opacity-50" style={{ color: currentTheme.text }}>Slow</span>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={settings.autoScrollSpeed}
            onChange={(e) => onUpdate({ autoScrollSpeed: parseFloat(e.target.value) })}
            className="flex-1 h-1.5 bg-black/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-[10px] opacity-50" style={{ color: currentTheme.text }}>Fast</span>
        </div>
      </section>
    </div>
  );
};
