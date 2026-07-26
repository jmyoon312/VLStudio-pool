import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Beat } from './BeatsList';

interface CreativeControlProps {
  beat: Beat | null;
  videoId: number;
  onBeatChange: (beat: Beat) => void;
  onApplyToAll?: (changes: Partial<Beat>) => void;
  sourceMode?: 'remix' | 'ai_gen' | 'collage';
  onSourceModeChange?: (mode: 'remix' | 'ai_gen' | 'collage') => void;
  engine?: 'remotion' | 'hyperframes';
  videoDNA?: string;
}

const FONTS = ['Pretendard', 'Inter', 'Noto Sans KR', 'Black Han Sans', 'Oswald', 'Montserrat'];
const ANIMATIONS = [
  { value: 'fade', label: '페이드', icon: '🌅' },
  { value: 'slide', label: '슬라이드', icon: '➡️' },
  { value: 'zoom', label: '확대/축소', icon: '🔍' },
  { value: 'shake', label: '흔들기', icon: '🫨' },
  { value: 'reveal', label: '나타내기', icon: '✨' },
];
const MUSIC_PRESETS = ['none', 'calm', 'energetic', 'cinematic', 'upbeat', 'dramatic', 'lofi'];
const VOICE_MODELS = [
  { id: 'v1', name: 'Loopie (Global)', icon: '🐰' },
  { id: 'v2', name: 'Narrator (Korean)', icon: '🎙️' },
  { id: 'v3', name: 'Elite AI (Deep)', icon: '🤖' },
];
const VISUAL_STYLES = ['사실적 (Photo)', '시네마틱', '애니메이션', '3D 렌더', '사이버펑크', '수채화'];

const CreativeControl: React.FC<CreativeControlProps> = ({ beat, videoId, onBeatChange, onApplyToAll, sourceMode, onSourceModeChange, engine: parentEngine, videoDNA }) => {
  const [localBeat, setLocalBeat] = useState<Beat | null>(beat);
  const [isRendering, setIsRendering] = useState(false);
  const [renderStatus, setRenderStatus] = useState<string | null>(null);

  useEffect(() => {
    setLocalBeat(beat);
  }, [beat]);

  if (!localBeat) {
    return (
      <div style={styles.emptyState}>
        <span style={styles.emptyIcon}>🎛️</span>
        <p style={styles.emptyText}>비트를 선택하면<br/>제어 옵션이 표시됩니다</p>
      </div>
    );
  }

  const update = (changes: Partial<Beat>) => {
    const updated = { ...localBeat, ...changes };
    setLocalBeat(updated);
    onBeatChange(updated);
  };

  const [isSearchingStock, setIsSearchingStock] = useState(false);
  const [stockKeyword, setStockKeyword] = useState('');
  const [stockResults, setStockResults] = useState<any[]>([]);

  // Automatically extract keyword when beat changes
  useEffect(() => {
    if (localBeat && localBeat.content && !stockKeyword) {
      // Simple keyword extraction: Take the first few significant words
      const keywords = localBeat.content.split(' ').filter(w => w.length > 2).slice(0, 3).join(' ');
      setStockKeyword(keywords);
    }
  }, [localBeat?.id]);

  const searchStockMedia = async () => {
    if (!stockKeyword) return;
    setIsSearchingStock(true);
    try {
      const { data } = await axios.get(`/api/assets/stock/video?keyword=${encodeURIComponent(stockKeyword)}`);
      setStockResults(data.results || []);
    } catch (err) {
      // Professional Mock Fallback
      setStockResults([
        { id: "s1", url: "https://videos.pexels.com/video-files/3129671/3129671-sd_640_360_30fps.mp4", thumb: "https://images.pexels.com/videos/3129671/free-video-3129671.jpg?auto=compress&cs=tinysrgb&dpr=1&w=150" },
        { id: "s2", url: "https://videos.pexels.com/video-files/853889/853889-sd_640_360_25fps.mp4", thumb: "https://images.pexels.com/videos/853889/free-video-853889.jpg?auto=compress&cs=tinysrgb&dpr=1&w=150" },
        { id: "s3", url: "https://videos.pexels.com/video-files/5847424/5847424-sd_640_360_24fps.mp4", thumb: "https://images.pexels.com/videos/5847424/free-video-5847424.jpg?auto=compress&cs=tinysrgb&dpr=1&w=150" },
        { id: "s4", url: "https://videos.pexels.com/video-files/4440951/4440951-sd_640_360_25fps.mp4", thumb: "https://images.pexels.com/videos/4440951/free-video-4440951.jpg?auto=compress&cs=tinysrgb&dpr=1&w=150" }
      ]);
    } finally {
      setIsSearchingStock(false);
    }
  };

  const handleRender = async () => {
    if (!videoId || isRendering) return;
    setIsRendering(true);
    setRenderStatus('렌더링 요청 중...');
    try {
      const { data } = await axios.post('/api/beats/render', {
        video_id: videoId,
        beats: [localBeat],
        engine: localBeat.engine || 'remotion',
      });
      setRenderStatus(`✅ 큐 등록 완료 (Task: ${data.task_id?.slice(0, 8)}...)`);
    } catch {
      setRenderStatus('❌ 렌더링 요청 실패');
    } finally {
      setIsRendering(false);
      setTimeout(() => setRenderStatus(null), 4000);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={styles.headerTitle}>크리에이티브 컨트롤</span>
          <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>하이브리드 렌더러: {localBeat.engine?.toUpperCase() || 'REMOTION'}</span>
        </div>
        <div style={styles.engineSwitch}>
          {(['remotion', 'hyperframes'] as const).map(e => (
            <button 
              key={e}
              onClick={() => update({ engine: e })}
              style={{
                ...styles.engineBtn,
                ...(localBeat.engine === e ? styles.engineBtnActive : {})
              }}
            >
              {e === 'remotion' ? '🎯' : '⚡'}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.scrollArea}>

        {/* [NEW] ENGINE-SPECIFIC CONTROL BLOCK */}
        {localBeat.engine === 'remotion' ? (
          <Section title="리모션 템플릿 조정" icon="🎨">
             <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={styles.tuningGroup}>
                  <label style={styles.tuningLabel}>MOTION TEMPLATE</label>
                  <select 
                    style={styles.tuningSelect} 
                    value={localBeat.template_id || 'neon'} 
                    onChange={e => update({ template_id: e.target.value })}
                  >
                    <option value="neon">네온 펄스 (NEON)</option>
                    <option value="minimal">미니멀 클린 (MINIMAL)</option>
                    <option value="cinematic">시네마틱 볼드 (BOLD)</option>
                  </select>
                </div>
                <div style={styles.tuningGroup}>
                  <label style={styles.tuningLabel}>강조 색상 (ACCENT)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'].map(c => (
                      <button 
                        key={c}
                        onClick={() => update({ text_color: c })}
                        style={{
                          width: 24, height: 24, borderRadius: '50%', background: c, border: localBeat.text_color === c ? '2px solid #000' : 'none'
                        }}
                      />
                    ))}
                  </div>
                </div>
             </div>
          </Section>
        ) : (
          <Section title="하이퍼프레임 레이어 변형" icon="📐">
             <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={styles.grid2}>
                   <div style={styles.tuningGroup}>
                      <label style={styles.tuningLabel}>X POSITION (%)</label>
                      <input type="range" min="-100" max="100" value={localBeat.transform?.x || 0} onChange={e => update({ transform: { ...localBeat.transform, x: Number(e.target.value) } })} />
                   </div>
                   <div style={styles.tuningGroup}>
                      <label style={styles.tuningLabel}>Y POSITION (%)</label>
                      <input type="range" min="-100" max="100" value={localBeat.transform?.y || 0} onChange={e => update({ transform: { ...localBeat.transform, y: Number(e.target.value) } })} />
                   </div>
                </div>
                <div style={styles.grid2}>
                   <div style={styles.tuningGroup}>
                      <label style={styles.tuningLabel}>SCALE</label>
                      <input type="range" min="0.1" max="3" step="0.1" value={localBeat.transform?.scale || 1} onChange={e => update({ transform: { ...localBeat.transform, scale: Number(e.target.value) } })} />
                   </div>
                   <div style={styles.tuningGroup}>
                      <label style={styles.tuningLabel}>회전 (ROTATION)</label>
                      <input type="range" min="0" max="360" value={localBeat.transform?.rotate || 0} onChange={e => update({ transform: { ...localBeat.transform, rotate: Number(e.target.value) } })} />
                   </div>
                </div>
             </div>
          </Section>
        )}

        <Section title="애셋 오케스트레이션" icon="🎭">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={styles.tuningGroup}>
              <span style={styles.tuningLabel}>소스 작전 모드</span>
              <div style={styles.modeToggleGroup}>
                <button 
                  style={{...styles.modeBtn, ...(sourceMode === 'remix' ? styles.modeBtnActive : {})}}
                  onClick={() => onSourceModeChange?.('remix')}
                >
                  원본 리믹스
                </button>
                <button 
                  style={{...styles.modeBtn, ...(sourceMode === 'ai_gen' ? styles.modeBtnActive : {})}}
                  onClick={() => onSourceModeChange?.('ai_gen')}
                >
                  AI 생성
                </button>
                <button 
                  style={{...styles.modeBtn, ...(sourceMode === 'collage' ? styles.modeBtnActive : {})}}
                  onClick={() => onSourceModeChange?.('collage')}
                >
                  외부 콜라주
                </button>
              </div>
            </div>
            
            {sourceMode === 'ai_gen' && (
              <div style={styles.tuningGroup}>
                <span style={styles.tuningLabel}>비주얼 DNA (AI 프롬프트)</span>
                <textarea 
                  style={styles.dnaTextarea}
                  placeholder="이 비트의 시각적 배경을 루피에게 설명하세요 (예: 사이버펑크 도시, 네온사인...)"
                  value={localBeat.visual_prompt || ''}
                  onChange={e => update({ visual_prompt: e.target.value })}
                />
                <div style={styles.presetTags}>
                  <button style={styles.presetTag} onClick={() => update({ visual_prompt: (localBeat.visual_prompt || '') + (videoDNA ? `, style matching: ${videoDNA}` : '') })}>Apply Video DNA</button>
                  {['Photorealistic', 'Cinematic', 'Anime', '3D Render'].map(p => (
                    <button key={p} style={styles.presetTag} onClick={() => update({ visual_prompt: (localBeat.visual_prompt || '') + ' ' + p })}>{p}</button>
                  ))}
                </div>
              </div>
            )}

            {sourceMode === 'collage' && (
              <div style={styles.tuningGroup}>
                <span style={styles.tuningLabel}>스톡 에셋 검색 (INTEL SEARCH)</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input 
                    style={{ ...styles.select, flex: 1 }} 
                    placeholder="검색어 입력..." 
                    value={stockKeyword}
                    onChange={e => setStockKeyword(e.target.value)}
                  />
                  <button 
                    style={{ ...styles.renderBtn, padding: '0 12px', width: 'auto' }}
                    onClick={searchStockMedia}
                    disabled={isSearchingStock}
                  >
                    {isSearchingStock ? '...' : '검색'}
                  </button>
                </div>
                
                {stockResults.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                    {stockResults.map(res => (
                      <div 
                        key={res.id} 
                        style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '16/9', border: '1px solid #E5E7EB', cursor: 'pointer' }}
                        onClick={() => update({ media_url: res.url, media_type: 'video' })}
                      >
                        <img src={res.thumb} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(59, 130, 246, 0.4)', opacity: localBeat.media_url === res.url ? 1 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ color: '#FFF', fontSize: 20 }}>✅</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        <Section title="언어 및 텍스트 (Text)" icon="✍️">
          <div style={styles.tuningGroup}>
            <span style={styles.tuningLabel}>자막 텍스트</span>
            <textarea 
              style={styles.textArea} 
              value={localBeat.text_overlay || ''} 
              onChange={e => update({ text_overlay: e.target.value })}
            />
          </div>
          <div style={styles.tuningGrid2}>
            <div style={styles.tuningGroup}>
              <span style={styles.tuningLabel}>폰트 크기</span>
              <input type="range" min={12} max={120} value={localBeat.font_size || 36} onChange={e => update({ font_size: Number(e.target.value) })} style={styles.slider} />
            </div>
          </div>
        </Section>

        <Section title="시각 효과 (Visuals)" icon="🔭">
          <div style={styles.tuningGroup}>
            <span style={styles.tuningLabel}>애니메이션</span>
            <div style={styles.animGrid}>
              {['fade', 'slide', 'zoom', 'shake', 'reveal'].map(a => (
                <button 
                  key={a} 
                  style={{...styles.animBtn, ...(localBeat.animation === a ? styles.animBtnActive : {})}}
                  onClick={() => update({ animation: a as any })}
                >
                  {a.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="오디오 및 사운드" icon="🔊">
          <div style={styles.tuningGroup}>
            <span style={styles.tuningLabel}>나레이션 보이스</span>
            <select style={styles.select} value={localBeat.voice_id} onChange={e => update({ voice_id: e.target.value })}>
              <option value="v1">루피 (글로벌)</option>
              <option value="v2">나레이터 (한국어)</option>
              <option value="v3">엘리트 AI (딥보이스)</option>
            </select>
          </div>
          <div style={styles.sliderRow}>
            <span style={{...styles.sliderLabel, flex: 1}}>음량</span>
            <input
              type="range"
              min={0} max={1} step={0.05}
              value={localBeat.volume ?? 0.85}
              onChange={e => update({ volume: Number(e.target.value) })}
              style={styles.slider}
            />
            <span style={styles.sliderValue}>{Math.round((localBeat.volume ?? 0.85) * 100)}%</span>
          </div>
        </Section>

      </div>

      <div style={styles.footer}>
        {renderStatus && (
          <p style={styles.renderStatus}>{renderStatus}</p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{ ...styles.renderBtn, flex: 2, opacity: isRendering ? 0.6 : 1 }}
            onClick={handleRender}
            disabled={isRendering}
          >
            {isRendering ? '⏳ 렌더링 중...' : '🚀 렌더링 시작'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; icon?: string; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div style={sectionStyles.container}>
    <label style={sectionStyles.label}>
      {icon && <span style={{marginRight: 4}}>{icon}</span>}
      {title}
    </label>
    {children}
  </div>
);

const sectionStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '14px 20px',
    borderBottom: '1px solid #F3F4F6',
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#6B7280',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  },
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#FFFFFF',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px 12px',
    borderBottom: '1px solid #E5E7EB',
    background: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#6B7280',
    letterSpacing: '0.08em',
  },
  engineTag: {
    fontSize: 11,
    fontWeight: 600,
    color: '#3B82F6',
    background: '#EFF6FF',
    padding: '2px 8px',
    borderRadius: 12,
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 12,
  },
  emptyIcon: {
    fontSize: 40,
    opacity: 0.4,
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 1.6,
  },
  textarea: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    fontSize: 13,
    color: '#1F2937',
    fontFamily: 'Pretendard, Inter, sans-serif',
    resize: 'none',
    outline: 'none',
    lineHeight: 1.5,
    background: '#F9FAFB',
    boxSizing: 'border-box',
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  slider: {
    flex: 1,
    accentColor: '#3B82F6',
  },
  sliderValue: {
    fontSize: 12,
    fontWeight: 600,
    color: '#3B82F6',
    minWidth: 36,
    textAlign: 'right',
  },
  select: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    fontSize: 13,
    color: '#1F2937',
    background: '#F9FAFB',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  styleChip: {
    padding: '4px 10px',
    borderRadius: 14,
    fontSize: 10,
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
  },
  tuningGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  tuningLabel: { fontSize: 11, fontWeight: 700, color: '#6B7280' },
  sliderLabel: { fontSize: 11, fontWeight: 600, color: '#4B5563' },
  colorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  colorPicker: {
    width: 36,
    height: 36,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    padding: 0,
    background: 'none',
  },
  colorPresets: {
    display: 'flex',
    gap: 6,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
  },
  animRow: {
    display: 'flex',
    gap: 8,
  },
  animBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '8px 4px',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    background: '#F9FAFB',
    cursor: 'pointer',
    fontSize: 12,
    color: '#6B7280',
  },
  animBtnActive: {
    border: '1.5px solid #3B82F6',
    background: '#EFF6FF',
    color: '#3B82F6',
    fontWeight: 600,
  },
  engineSwitch: {
    display: 'flex',
    gap: 4,
    background: '#F3F4F6',
    padding: 2,
    borderRadius: 6,
  },
  engineBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  engineBtnActive: {
    background: '#FFFFFF',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },
  engineIntelBox: {
    padding: '10px 12px',
    background: '#F8F9FC',
    borderRadius: 8,
    border: '1px solid #E5E7EB',
  },
  intelText: {
    fontSize: 11,
    color: '#4B5563',
    margin: '0 0 6px 0',
    lineHeight: 1.4,
  },
  intelBadge: {
    display: 'inline-block',
    fontSize: 9,
    fontWeight: 700,
    color: '#3B82F6',
    background: '#EFF6FF',
    padding: '2px 6px',
    borderRadius: 4,
    textTransform: 'uppercase' as const,
  },
  obBtn: {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #E5E7EB',
    background: '#F9FAFB',
    fontSize: 11,
    fontWeight: 600,
    color: '#6B7280',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  obBtnActive: {
    background: '#1F2937',
    color: '#FFFFFF',
    borderColor: '#1F2937',
  },
  dnaTextarea: { 
    width: '100%', 
    height: 80, 
    padding: 12, 
    border: '1px solid #E5E7EB', 
    borderRadius: 8, 
    fontSize: 13, 
    outline: 'none', 
    background: '#F9FAFB', 
    resize: 'none' 
  },
  modeToggleGroup: { 
    display: 'grid', 
    gridTemplateColumns: '1fr 1fr 1fr', 
    gap: 6, 
    marginTop: 8 
  },
  modeBtn: { 
    padding: '8px 4px', 
    fontSize: 11, 
    fontWeight: 700, 
    border: '1px solid #E5E7EB', 
    borderRadius: 8, 
    background: '#FFFFFF', 
    cursor: 'pointer', 
    color: '#6B7280' 
  },
  modeBtnActive: { 
    background: '#111827', 
    color: '#FFFFFF', 
    borderColor: '#111827' 
  },
  animGrid: { 
    display: 'grid', 
    gridTemplateColumns: '1fr 1fr', 
    gap: 8 
  },
  presetTags: { 
    display: 'flex', 
    flexWrap: 'wrap', 
    gap: 6, 
    marginTop: 10 
  },
  presetTag: { 
    padding: '4px 10px', 
    background: '#F3F4F6', 
    border: '1px solid #E5E7EB', 
    borderRadius: 20, 
    fontSize: 11, 
    fontWeight: 600, 
    color: '#4B5563', 
    cursor: 'pointer' 
  },
  intelBox: {
    padding: '10px',
    background: '#F3F4F6',
    borderRadius: 8,
    border: '1px dashed #D1D5DB',
  },
  bulkBtn: {
    padding: '0 12px',
    background: '#F3F4F6',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 700,
    color: '#3B82F6',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  footer: {
    padding: '16px 20px',
    borderTop: '1px solid #E5E7EB',
    background: '#FFFFFF',
  },
  renderStatus: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  renderBtn: {
    padding: '12px',
    background: '#3B82F6',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
};

export default CreativeControl;
