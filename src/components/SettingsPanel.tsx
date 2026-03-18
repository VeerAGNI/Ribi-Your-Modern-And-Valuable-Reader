import React from 'react';
import { Moon, Sun, Coffee, Cloud, Zap, Sparkles, MoonStar } from 'lucide-react';
import { Theme, ReaderSettings, ViewMode } from '../types';
import { THEMES } from '../constants';
import { cn } from '../utils';

interface SettingsPanelProps {
  settings: ReaderSettings;
  onUpdate: (updates: Partial<ReaderSettings>) => void;
}

const SectionHeader: React.FC<{ label: string; value?: string; color?: string }> = ({ label, value, color }) => (
  <div className="flex justify-between items-center mb-3">
    <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-50" style={{ color }}>{label}</h3>
    {value !== undefined && (
      <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-black/10 font-medium" style={{ color }}>{value}</span>
    )}
  </div>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onUpdate }) => {
  const currentTheme = THEMES[settings.theme];

  const themeOptions: { id: Theme; icon: any; label: string }[] = [
    { id: 'light', icon: Sun, label: 'Light' },
    { id: 'dark', icon: Moon, label: 'Dark' },
    { id: 'sepia', icon: Coffee, label: 'Sepia' },
    { id: 'nord', icon: Cloud, label: 'Nord' },
    { id: 'midnight', icon: Zap, label: 'Midnight' },
  ];

  const viewModeOptions: { id: ViewMode; label: string; desc: string }[] = [
    { id: 'page', label: 'Single Page', desc: 'One page at a time' },
    { id: 'continuous', label: 'Continuous', desc: 'Scroll through all' },
  ];

  const qualityLabels: Record<number, string> = { 1: 'Standard', 2: 'Sharp', 3: 'Crystal', 4: 'Ultra' };
  const qualityVal = Math.round(settings.renderQuality ?? 2);

  return (
    <div className="flex flex-col gap-7 p-6 pb-2" style={{ color: currentTheme.text }}>

      {/* View Mode */}
      <section>
        <SectionHeader label="View Mode" color={currentTheme.text} />
        <div className="grid grid-cols-2 gap-2">
          {viewModeOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => onUpdate({ viewMode: opt.id })}
              className={cn('p-3 rounded-xl transition-all border-2 text-left', settings.viewMode === opt.id ? 'border-blue-500 bg-blue-500/8' : 'border-transparent hover:bg-black/5')}
            >
              <p className="text-xs font-bold" style={{ color: settings.viewMode === opt.id ? '#3B82F6' : currentTheme.text }}>{opt.label}</p>
              <p className="text-[10px] opacity-40 mt-0.5" style={{ color: currentTheme.text }}>{opt.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Appearance */}
      <section>
        <SectionHeader label="Appearance" color={currentTheme.text} />
        <div className="grid grid-cols-5 gap-2">
          {themeOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => onUpdate({ theme: opt.id })}
              className={cn('flex flex-col items-center gap-2 p-3 rounded-xl transition-all border-2', settings.theme === opt.id ? 'border-blue-500 bg-blue-500/8' : 'border-transparent hover:bg-black/5')}
            >
              <opt.icon size={18} style={{ color: settings.theme === opt.id ? '#3B82F6' : currentTheme.text }} />
              <span className="text-[9px] font-semibold" style={{ color: currentTheme.text }}>{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Auto Night Mode */}
        <div
          className="mt-3 flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer"
          style={{ background: settings.autoNightMode ? 'rgba(139,92,246,0.12)' : `${currentTheme.text}07` }}
          onClick={() => onUpdate({ autoNightMode: !settings.autoNightMode })}
        >
          <div className="flex items-center gap-2.5">
            <MoonStar size={16} style={{ color: settings.autoNightMode ? '#8B5CF6' : currentTheme.text, opacity: settings.autoNightMode ? 1 : 0.5 }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: currentTheme.text }}>Auto Night Mode</p>
              <p className="text-[9px] opacity-40 mt-0.5" style={{ color: currentTheme.text }}>Switch to Midnight at 9 PM</p>
            </div>
          </div>
          <div
            className={cn('w-9 h-5 rounded-full transition-all relative', settings.autoNightMode ? 'bg-violet-500' : 'bg-black/15')}
          >
            <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all', settings.autoNightMode ? 'left-[18px]' : 'left-0.5')} />
          </div>
        </div>
      </section>

      {/* PDF Sharpness */}
      <section>
        <SectionHeader label="Sharpness" value={qualityLabels[qualityVal] ?? 'Sharp'} color={currentTheme.text} />
        <div className="flex items-center gap-3 mb-2">
          <Sparkles size={13} style={{ color: currentTheme.accent, opacity: 0.7 }} />
          <input
            type="range" min="1" max="4" step="1"
            value={settings.renderQuality ?? 2}
            onChange={e => onUpdate({ renderQuality: parseInt(e.target.value) })}
            className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-500"
            style={{ background: `linear-gradient(to right, ${currentTheme.accent} 0%, ${currentTheme.accent} ${((qualityVal - 1) / 3) * 100}%, rgba(0,0,0,0.15) ${((qualityVal - 1) / 3) * 100}%, rgba(0,0,0,0.15) 100%)` }}
          />
        </div>
        <p className="text-[10px] opacity-40 leading-relaxed" style={{ color: currentTheme.text }}>
          Enhances text contrast and color saturation via GPU filter — zero rendering overhead. Works on all pages instantly.
        </p>
      </section>

      {/* Brightness */}
      <section>
        <SectionHeader label="Brightness" value={`${settings.brightness}%`} color={currentTheme.text} />
        <input
          type="range" min="20" max="100"
          value={settings.brightness}
          onChange={e => onUpdate({ brightness: parseInt(e.target.value) })}
          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-500"
          style={{ background: 'rgba(0,0,0,0.15)' }}
        />
      </section>

      {/* Auto Reading */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-50" style={{ color: currentTheme.text }}>Auto Reading</h3>
            <div className={cn('w-2 h-2 rounded-full transition-colors', settings.isAutoScrolling ? 'bg-green-500 animate-pulse' : 'bg-red-500/60')} />
          </div>
          <button
            onClick={() => onUpdate({ isAutoScrolling: !settings.isAutoScrolling })}
            className={cn('px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all', settings.isAutoScrolling ? 'bg-green-500 text-white' : 'bg-black/10')}
            style={{ color: settings.isAutoScrolling ? '#fff' : currentTheme.text }}
          >
            {settings.isAutoScrolling ? 'Active' : 'Off'}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] opacity-40" style={{ color: currentTheme.text }}>Slow</span>
          <input
            type="range" min="0.1" max="10" step="0.1"
            value={settings.autoScrollSpeed}
            onChange={e => onUpdate({ autoScrollSpeed: parseFloat(e.target.value) })}
            className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-500"
            style={{ background: 'rgba(0,0,0,0.15)' }}
          />
          <span className="text-[10px] opacity-40" style={{ color: currentTheme.text }}>Fast</span>
        </div>
      </section>
    </div>
  );
};
