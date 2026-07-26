import React, { useState, useEffect } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, 
  Volume2, Maximize2, Sparkles, Activity,
  Info, ShieldCheck, Zap
} from 'lucide-react';

interface Beat {
  id: number;
  type: string;
  title: string;
  content: string;
  duration_sec: number;
  visual_intent?: string;
  pacing_instruction?: string;
}

interface BeatCanvasProps {
  beat: Beat | null;
  videoId: number;
  aspectRatio?: string;
  sourceMode?: 'original' | 'remotion' | 'hyperframes';
  engine?: 'remotion' | 'hyperframes';
}

const BeatCanvas: React.FC<BeatCanvasProps> = ({ 
  beat, 
  videoId, 
  aspectRatio = '9:16', 
  sourceMode = 'remotion',
  engine = 'remotion'
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const totalDuration = beat?.duration_sec || 15;

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return prev + 0.1;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration]);

  const handlePlayPause = () => {
    setIsPlaying(p => !p);
  };

  const renderPreview = () => {
    if (!beat) return (
      <div style={styles.emptyCanvas}>
        <Zap size={48} color="#E2E8F0" />
        <p style={styles.emptyText}>전략적 비트가 선택되지 않았습니다</p>
      </div>
    );

    const isLongform = aspectRatio === '16:9';
    
    return (
      <div style={{
        ...styles.canvas,
        aspectRatio: isLongform ? '16/9' : '9/16',
        maxHeight: '100%',
      }}>
        {/* Mock Video/Remotion Frame */}
        <div style={styles.videoFrame}>
           <div style={styles.overlayText}>
              <span style={styles.typeTag}>{beat.type.toUpperCase()}</span>
              <h2 style={styles.beatTitle}>{beat.title}</h2>
           </div>
           
           {/* HUD: AI Analysis Overlays */}
           <div style={styles.hudV8}>
              <div style={styles.hudRowV8}>
                 <Activity size={12} color="#3B82F6" />
                 <span>VIRAL VELOCITY: +85.2/h</span>
              </div>
              <div style={styles.hudRowV8}>
                 <Zap size={12} color="#F59E0B" />
                 <span>ENGAGEMENT PROJECTION: HIGH</span>
              </div>
           </div>

           {/* AI Insight Overlay */}
           <div style={styles.insightOverlayV8}>
              <div style={styles.insightBadgeV8}>
                 <Sparkles size={10} color="#F59E0B" />
                 <span style={styles.hudInsightTextV8}>
                    {beat.type === 'hook' ? '첫 3초의 시각적 자극이 매우 강렬합니다. 현재 점수 우수.' : '자막 가독성을 높여 이탈률을 15% 개선할 수 있습니다.'}
                 </span>
              </div>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.previewContainer}>
        {renderPreview()}
      </div>

      <div style={styles.controls}>
        <div style={styles.timeline}>
          <span style={styles.timeLabel}>0:00</span>
          <div style={styles.progressBar}>
            <div style={{...styles.progressFill, width: `${(currentTime / totalDuration) * 100}%`}} />
          </div>
          <span style={styles.timeLabel}>{totalDuration}s</span>
        </div>
        
        <div style={styles.buttons}>
          <button style={styles.controlBtn} onClick={() => setCurrentTime(0)}><SkipBack size={18}/></button>
          <button style={{...styles.controlBtn, ...styles.playBtn}} onClick={handlePlayPause}>
            {isPlaying ? <Pause size={24}/> : <Play size={24}/>}
          </button>
          <button style={styles.controlBtn} onClick={() => setCurrentTime(totalDuration)}><SkipForward size={18}/></button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    background: '#FFFFFF',
    borderRadius: 32,
    overflow: 'hidden',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)',
  },
  previewContainer: {
    flex: 1,
    background: '#F8F9FC',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    overflow: 'hidden',
  },
  emptyCanvas: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: 600,
  },
  canvas: {
    background: '#000000',
    borderRadius: 24,
    boxShadow: '0 30px 60px -12px rgba(0,0,0,0.25)',
    position: 'relative',
    overflow: 'hidden',
    width: 'auto',
    height: '100%',
  },
  videoFrame: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: 24,
    background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 100%)',
  },
  overlayText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  typeTag: {
    fontSize: 10,
    fontWeight: 900,
    color: '#3B82F6',
    letterSpacing: '0.1em',
  },
  beatTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#FFFFFF',
    margin: 0,
    lineHeight: 1.3,
  },
  hudV8: {
    position: 'absolute',
    top: 24,
    left: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  hudRowV8: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 9,
    fontWeight: 800,
    color: 'rgba(255,255,255,0.7)',
    background: 'rgba(0,0,0,0.4)',
    padding: '4px 8px',
    borderRadius: 6,
    backdropFilter: 'blur(4px)',
  },
  insightOverlayV8: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
  },
  insightBadgeV8: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    background: 'rgba(255,255,255,0.95)',
    padding: '10px 14px',
    borderRadius: 12,
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
  },
  hudInsightTextV8: {
    fontSize: 10,
    fontWeight: 700,
    color: '#1F2937',
    lineHeight: 1.4,
  },
  controls: {
    padding: '24px 32px',
    background: '#FFFFFF',
    borderTop: '1px solid #F1F5F9',
  },
  timeline: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  timeLabel: {
    fontSize: 11,
    color: '#94A3B8',
    minWidth: 30,
    textAlign: 'center',
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
  },
  progressBar: {
    flex: 1,
    height: 6,
    background: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #3B82F6, #2563EB)',
    borderRadius: 3,
    transition: 'width 0.1s linear',
  },
  buttons: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  controlBtn: {
    background: 'none',
    border: 'none',
    color: '#64748B',
    cursor: 'pointer',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.2s',
  },
  playBtn: {
    width: 56,
    height: 56,
    background: '#3B82F6',
    borderRadius: '50%',
    color: '#FFFFFF',
    boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.4)',
  },
};

export default BeatCanvas;
