import React, { useState, useEffect } from 'react';
import axios from 'axios';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
export interface Beat {
  id: string;
  type: 'hook' | 'problem' | 'solution' | 'cta' | 'outro' | string;
  title: string;
  subtitle?: string;
  duration_sec: number;
  text_overlay?: string;
  font?: string;
  font_size?: number;
  text_color?: string;
  animation?: 'fade' | 'slide' | 'zoom';
  volume?: number;
  background_music?: string;
  engine?: 'remotion' | 'hyperframes';
  video_url?: string;
  media_url?: string;
  media_type?: 'video' | 'image' | 'audio';
  thumbnail_url?: string;
  status?: 'ready' | 'rendering' | 'done' | 'error';
  viral_score?: number;
  // [NEW] Elite Production Fields
  visual_prompt?: string;
  visual_style?: string;
  voice_id?: string;
  layout_mode?: 'single' | 'split' | 'overlay';
  pacing_intensity?: number;
  // [NEW] Anti-Duplicate Obfuscation
  obfuscation?: {
    mirror?: boolean;
    speed_var?: number; // 0.95 to 1.05
    color_jitter?: boolean;
    audio_pitch_shift?: number;
    ken_burns?: boolean;
  };
  // [NEW] Visual Transforms
  transform?: {
    scale?: number;     // 0.5 to 3.0
    x?: number;         // -100 to 100 (%)
    y?: number;         // -100 to 100 (%)
    opacity?: number;   // 0 to 1
    rotate?: number;    // -180 to 180 (deg)
  };
  fx?: any;
  external_url?: string;
  variations?: Partial<Beat>[];
  // [ADDED] Production Sync Fields
  content?: string;
  start_time?: string;
  end_time?: string;
  asset_url?: string;
  source_mode?: 'original' | 'upload' | 'ai_gen' | 'stock' | string;
  pos_x?: number;
  pos_y?: number;
  scale?: number;
  rotation?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  grayscale?: number;
  template_id?: string;
  visual_intent?: string;
  image_prompt?: string;
}

interface BeatsListProps {
  beats?: Beat[];
  videoId?: number;
  selectedBeatId: string | null;
  onSelectBeat: (beat: Beat) => void;
  onBeatsLoaded?: (beats: Beat[]) => void;
}

// ─────────────────────────────────────────
// Beat type color mapping (기존 ViraLoop 색상 계승)
// ─────────────────────────────────────────
const BEAT_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  hook:     { label: 'HOOK',     color: '#3B82F6', bg: '#EFF6FF' },
  problem:  { label: 'PROBLEM',  color: '#F59E0B', bg: '#FFFBEB' },
  solution: { label: 'SOLUTION', color: '#10B981', bg: '#ECFDF5' },
  cta:      { label: 'CTA',      color: '#8B5CF6', bg: '#F5F3FF' },
  outro:    { label: 'OUTRO',    color: '#6B7280', bg: '#F9FAFB' },
};

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────
const BeatsList: React.FC<BeatsListProps> = ({
  beats: propBeats,
  videoId,
  selectedBeatId,
  onSelectBeat,
  onBeatsLoaded,
}) => {
  const [internalBeats, setInternalBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(!propBeats);
  const [error, setError] = useState<string | null>(null);

  const displayBeats = propBeats || internalBeats;

  useEffect(() => {
    if (propBeats) {
      setLoading(false);
      return;
    }
    if (videoId) {
      fetchBeats();
    }
  }, [videoId, propBeats]);

  const fetchBeats = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`/api/beats/video/${videoId}`);
      if (data.beats && data.beats.length > 0) {
        setInternalBeats(data.beats);
        onBeatsLoaded?.(data.beats);
      } else {
        throw new Error("No beats found"); // trigger fallback
      }
    } catch (err) {
      console.log("Using fallback beats data");
      // Fallback mock data
      const mockBeats: Beat[] = [
        { id: 'b1', type: 'hook', title: '강렬한 시작', duration_sec: 3, status: 'done', engine: 'hyperframes', text_overlay: '안녕하세요!' },
        { id: 'b2', type: 'problem', title: '문제 제기', duration_sec: 5, status: 'done', engine: 'hyperframes', text_overlay: '주식 시장이 미쳤습니다.' },
        { id: 'b3', type: 'solution', title: '해결책 제시', duration_sec: 7, status: 'rendering', engine: 'remotion', text_overlay: '지금 바로 이 종목을 보세요.' },
        { id: 'b4', type: 'cta', title: '구독 유도', duration_sec: 4, status: 'ready', engine: 'remotion', text_overlay: '구독과 좋아요 부탁드립니다!' },
      ];
      setInternalBeats(mockBeats);
      onBeatsLoaded?.(mockBeats);
    } finally {
      setLoading(false);
    }
  };

  const totalDuration = displayBeats.reduce((sum, b) => sum + (b.duration_sec || 0), 0);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={styles.skeletonCard} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <span style={{ color: '#EF4444', fontSize: 13 }}>{error}</span>
        <button onClick={fetchBeats} style={styles.retryButton}>재시도</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>작전 비트 구성</span>
        <span style={styles.headerMeta}>{displayBeats.length}개 · {totalDuration}초</span>
      </div>

      {/* Beats List */}
      <div style={styles.list}>
        {displayBeats.map((beat, index) => {
          const typeConfig = BEAT_TYPE_CONFIG[beat.type] || BEAT_TYPE_CONFIG['outro'];
          const isSelected = beat.id === selectedBeatId;

          return (
            <div
              key={beat.id}
              style={{
                ...styles.card,
                border: isSelected
                  ? `2px solid ${typeConfig.color}`
                  : '2px solid #E5E7EB',
                background: isSelected ? typeConfig.bg : '#FFFFFF',
              }}
              onClick={() => onSelectBeat(beat)}
            >
              {/* Thumbnail */}
              <div style={{ ...styles.thumbnail, background: typeConfig.bg }}>
                {beat.thumbnail_url ? (
                  <img src={beat.thumbnail_url} alt="" style={styles.thumbnailImg} />
                ) : (
                  <span style={{ ...styles.beatIndex, color: typeConfig.color }}>
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Info */}
              <div style={styles.info}>
                <div style={styles.infoTop}>
                  <span style={{ ...styles.typeBadge, color: typeConfig.color, background: typeConfig.bg }}>
                    {typeConfig.label}
                  </span>
                  <span style={styles.duration}>{beat.duration_sec}s</span>
                </div>
                <p style={styles.beatTitle}>{beat.title}</p>
                {beat.content ? (
                  <p style={styles.beatSubtitle}>{beat.content}</p>
                ) : beat.subtitle ? (
                  <p style={styles.beatSubtitle}>{beat.subtitle}</p>
                ) : null}

                {/* Variation Chips (Strategic Matrix) */}
                {beat.variations && beat.variations.length > 0 && (
                  <div style={styles.variationGroupV8}>
                    {['A', 'B', 'C'].slice(0, beat.variations.length + 1).map((v, i) => (
                      <button 
                        key={i} 
                        style={{
                          ...styles.variationChipV8, 
                          ...(i === 0 ? styles.variationActiveV8 : {})
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Logic to switch variation would go here
                        }}
                      >
                        {v}
                      </button>
                    ))}
                    <span style={styles.variationLabelV8}>베리에이션 분석됨</span>
                  </div>
                )}
              </div>

              {/* Status & Indicators */}
              <div style={styles.statusGroup}>
                <div style={styles.indicatorIcons}>
                  {beat.visual_prompt && <span title="AI Visual DNA" style={{fontSize: 10}}>🎨</span>}
                  {beat.voice_id && <span title="Voice Intelligence" style={{fontSize: 10}}>🗣️</span>}
                  {beat.obfuscation && <span title="Anti-Duplicate Intel" style={{fontSize: 10}}>🛡️</span>}
                </div>
                <div style={{
                  ...styles.statusDot,
                  background: beat.status === 'done' ? '#10B981'
                    : beat.status === 'rendering' ? '#F59E0B'
                    : beat.status === 'error' ? '#EF4444'
                    : '#D1D5DB',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// Styles (ViraLoop 색상 시스템 계승)
// ─────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#FFFFFF',
    borderRight: '1px solid #F1F5F9',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 20px',
    borderBottom: '1px solid #F1F5F9',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: '#94A3B8',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  headerMeta: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: 700,
    background: '#F8F9FC',
    padding: '4px 8px',
    borderRadius: 6,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '16px',
    borderRadius: 16,
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    border: '1px solid #F1F5F9',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  beatIndex: {
    fontSize: 16,
    fontWeight: 700,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  infoTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  typeBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 4,
    letterSpacing: '0.05em',
  },
  duration: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  beatTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#1F2937',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  beatSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    margin: '2px 0 0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  variationGroupV8: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 },
  variationChipV8: { width: 22, height: 22, borderRadius: 6, background: '#F8F9FC', border: '1px solid #F1F5F9', fontSize: 9, fontWeight: 900, color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' },
  variationActiveV8: { background: '#3B82F6', color: '#FFFFFF', borderColor: '#3B82F6', boxShadow: '0 4px 10px rgba(59,130,246,0.3)' },
  variationLabelV8: { fontSize: 9, fontWeight: 700, color: '#CBD5E1', marginLeft: 4, letterSpacing: '0.02em' },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  statusGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    flexShrink: 0,
  },
  indicatorIcons: {
    display: 'flex',
    gap: 4,
  },
  loadingContainer: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  skeletonCard: {
    height: 70,
    borderRadius: 10,
    background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
  errorContainer: {
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  retryButton: {
    padding: '6px 16px',
    background: '#3B82F6',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer',
  },
};

export default BeatsList;
