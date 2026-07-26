import React from 'react';
import { Search, TrendingUp, Zap, BarChart2, Star } from 'lucide-react';

export interface PresetChip {
  id: string;
  label: string;
  icon?: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

interface PresetChipsProps {
  presets: PresetChip[];
}

export function PresetChips({ presets }: PresetChipsProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
      {presets.map((preset) => (
        <button
          key={preset.id}
          onClick={preset.onClick}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm whitespace-nowrap transition-all duration-200 ${
            preset.isActive
              ? 'bg-primary/10 border-primary text-primary shadow-sm'
              : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          {preset.icon && <span className={preset.isActive ? 'text-primary' : 'opacity-50'}>{preset.icon}</span>}
          <span className="font-medium">{preset.label}</span>
        </button>
      ))}
    </div>
  );
}
