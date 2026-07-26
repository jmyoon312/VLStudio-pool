import React from 'react';

export interface FilterState {
  videoType: 'all' | 'normal' | 'shorts';
  sort: 'trending' | 'views';
  country: string;
  viewCountRange: string;
  channelSizeRange: string;
  durationRange: string;
  period: string;
}

interface SidebarFilterProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  isOpen?: boolean;
}

export function SidebarFilter({ filters, onChange, isOpen = true }: SidebarFilterProps) {
  if (!isOpen) return null;

  const updateFilter = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="w-64 flex-shrink-0 bg-card border-r border-border h-full overflow-y-auto p-4 flex flex-col gap-6 no-scrollbar">
      {/* Video Type */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/80 mb-3">영상 유형</h3>
        <div className="flex bg-muted rounded-lg p-1">
          <button 
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${filters.videoType === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => updateFilter('videoType', 'all')}
          >
            전체
          </button>
          <button 
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${filters.videoType === 'normal' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => updateFilter('videoType', 'normal')}
          >
            일반
          </button>
          <button 
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${filters.videoType === 'shorts' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => updateFilter('videoType', 'shorts')}
          >
            Shorts
          </button>
        </div>
      </div>

      {/* Sort */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/80 mb-3">정렬</h3>
        <div className="flex gap-2">
          <button 
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${filters.sort === 'trending' ? 'bg-primary/20 border-primary text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}
            onClick={() => updateFilter('sort', 'trending')}
          >
            트렌딩
          </button>
          <button 
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${filters.sort === 'views' ? 'bg-primary/20 border-primary text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}
            onClick={() => updateFilter('sort', 'views')}
          >
            조회수
          </button>
        </div>
      </div>

      {/* View Count Range */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/80 mb-3">조회수</h3>
        <select 
          className="w-full bg-muted border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none focus:border-primary"
          value={filters.viewCountRange}
          onChange={(e) => updateFilter('viewCountRange', e.target.value)}
        >
          <option value="all">전체보기</option>
          <option value="min10k">1만회 이상</option>
          <option value="min100k">10만회 이상</option>
          <option value="min1m">100만회 이상</option>
        </select>
      </div>

      {/* Upload Period */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/80 mb-3">업로드 기간</h3>
        <div className="grid grid-cols-2 gap-2">
          {['all', 'today', '3days', '7days', '30days'].map(period => (
            <button 
              key={period}
              className={`py-1.5 text-xs rounded border transition-colors ${filters.period === period ? 'bg-primary/20 border-primary text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}
              onClick={() => updateFilter('period', period)}
            >
              {period === 'all' ? '전체' : period === 'today' ? '오늘' : period === '3days' ? '최근 3일' : period === '7days' ? '최근 7일' : '최근 30일'}
            </button>
          ))}
        </div>
      </div>

      {/* Channel Size */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/80 mb-3">채널 규모</h3>
        <select 
          className="w-full bg-muted border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none focus:border-primary"
          value={filters.channelSizeRange}
          onChange={(e) => updateFilter('channelSizeRange', e.target.value)}
        >
          <option value="all">전체</option>
          <option value="small">소형 (100명~)</option>
          <option value="medium">중형 (1만명~)</option>
          <option value="large">대형 (10만명~)</option>
        </select>
      </div>

      {/* Duration Range */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/80 mb-3">영상 길이</h3>
        <select 
          className="w-full bg-muted border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none focus:border-primary"
          value={filters.durationRange}
          onChange={(e) => updateFilter('durationRange', e.target.value)}
        >
          <option value="all">전체</option>
          <option value="short">60초 이하 (쇼츠)</option>
          <option value="medium">1~10분</option>
          <option value="long">10분 이상</option>
        </select>
      </div>
      
    </div>
  );
}
