import React, { useState } from 'react';
import { CheckCircle, RefreshCw, Edit3, Image as ImageIcon, Volume2, Type, AlertTriangle, ShieldCheck, Globe2, Maximize2, Sparkles, Activity } from 'lucide-react';

export interface RedTeamResult {
  isSafe: boolean;
  flaggedWords: string[];
  suggestedText: string;
}

export interface ScriptVariant {
  language: string; // 'ko', 'en', 'ja', 'zh'
  text: string;
  redTeam?: RedTeamResult;
  evolution?: {
    direct: string;
    reflect: string;
    adapt: string;
  };
  structure?: {
    intro: string;
    body: string;
    conclusion: string;
  };
  glossary?: { term: string; definition: string }[];
}

export interface AssetInfo {
  id: string;
  type: 'image' | 'audio' | 'text' | 'script_variants' | 'video';
  url?: string;
  text?: string;
  title: string;
  subtitle?: string;
  status: 'pending' | 'approved' | 'rejected';
  variants?: ScriptVariant[]; // For multilingual scripts
  reasoning?: string; // [NEW] AI's explanation for this asset
}

interface AssetApprovalBoardProps {
  stepId: string;
  stepName: string;
  assets: AssetInfo[];
  onApprove: (assetId: string) => void;
  onRegenerate: (assetId: string) => void;
  onEdit?: (assetId: string) => void;
  onApproveAll: () => void;
}

const AssetApprovalBoard: React.FC<AssetApprovalBoardProps> = ({ 
  stepId, stepName, assets, onApprove, onRegenerate, onEdit, onApproveAll 
}) => {
  const [activeLang, setActiveLang] = useState<string>('ko');

  if (!assets || assets.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>⏳</div>
        <h3 style={styles.emptyTitle}>대기 중</h3>
        <p style={styles.emptyDesc}>{stepName} 단계의 인공지능 분석이 아직 완료되지 않았습니다.</p>
      </div>
    );
  }

  const allApproved = assets.every(a => a.status === 'approved');

  const renderScriptVariants = (asset: AssetInfo) => {
    if (!asset.variants) return null;
    const currentVariant = asset.variants.find(v => v.language === activeLang) || asset.variants[0];
    const isSafe = currentVariant.redTeam?.isSafe !== false;

    return (
      <div style={styles.scriptVariantContainer}>
        {/* Language Tabs */}
        <div style={styles.langTabs}>
          {asset.variants.map(v => (
            <button 
              key={v.language}
              style={{...styles.langTab, ...(activeLang === v.language ? styles.langTabActive : {})}}
              onClick={() => setActiveLang(v.language)}
            >
              <Globe2 size={12} /> {v.language.toUpperCase()}
            </button>
          ))}
        </div>

        {/* RedTeam Scan Result */}
        <div style={{...styles.redTeamBanner, background: isSafe ? '#ECFDF5' : '#FEF2F2', borderColor: isSafe ? '#A7F3D0' : '#FECACA'}}>
          {isSafe ? (
            <><ShieldCheck size={16} color="#10B981" /> <span style={{color: '#065F46', fontSize: 12, fontWeight: 600}}>레드팀 스캔 통과 (안전)</span></>
          ) : (
            <><AlertTriangle size={16} color="#EF4444" /> <span style={{color: '#991B1B', fontSize: 12, fontWeight: 600}}>검열 위반 경고: {currentVariant.redTeam?.flaggedWords.join(', ')}</span></>
          )}
        </div>

        {/* Script Content Evolution (NEW - VideoLingo Inspired) */}
        <div style={styles.evolutionContainer}>
          <div style={styles.evolutionHeader}>
            <div style={styles.evolutionTitle}><Sparkles size={14} color="#7C3AED" /> 3-Step Semantic Evolution (Direct → Reflect → Adapt)</div>
            <div style={styles.netflixBadge}>Netflix Standard Compliant</div>
          </div>
          
          <div style={styles.evolutionSteps}>
            <div style={styles.evoStep}>
              <span style={styles.evoStepLabel}>Direct</span>
              <p style={styles.evoStepText}>{currentVariant.evolution?.direct || 'N/A'}</p>
            </div>
            <div style={styles.evoStepActive}>
              <span style={styles.evoStepLabelActive}>Adapted (Elite)</span>
              <p style={styles.evoStepTextActive}>{currentVariant.evolution?.adapt || currentVariant.text}</p>
            </div>
          </div>
        </div>

        {/* Semantic Structure Map (NEW) */}
        {currentVariant.structure && (
          <div style={styles.structureContainer}>
            <div style={styles.structureHeader}>
              <Activity size={14} color="#3B82F6" /> 스크립트 구성 인텔리전스 (Semantic Structure Map)
            </div>
            <div style={styles.structureTimeline}>
              <div style={styles.structurePhase}>
                <div style={{...styles.structureDot, background: '#3B82F6'}} />
                <div style={styles.structureInfo}>
                  <span style={styles.structureLabel}>INTRO (HOOK)</span>
                  <p style={styles.structureDesc}>{currentVariant.structure.intro}</p>
                </div>
              </div>
              <div style={styles.structurePhase}>
                <div style={{...styles.structureDot, background: '#F59E0B'}} />
                <div style={styles.structureInfo}>
                  <span style={styles.structureLabel}>BODY (CONTENT)</span>
                  <p style={styles.structureDesc}>{currentVariant.structure.body}</p>
                </div>
              </div>
              <div style={styles.structurePhase}>
                <div style={{...styles.structureDot, background: '#10B981'}} />
                <div style={styles.structureInfo}>
                  <span style={styles.structureLabel}>CTA (CONVERSION)</span>
                  <p style={styles.structureDesc}>{currentVariant.structure.conclusion}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h2 style={styles.title}>{stepName} 지능형 검수</h2>
          <span style={styles.countBadge}>{assets.filter(a => a.status === 'approved').length} / {assets.length} 승인됨</span>
        </div>
        <button 
          style={{...styles.approveAllBtn, opacity: allApproved ? 0.5 : 1, cursor: allApproved ? 'default' : 'pointer'}}
          onClick={onApproveAll}
          disabled={allApproved}
        >
          <CheckCircle size={16} />
          {allApproved ? '전체 승인 완료' : '전체 승인 후 다음으로'}
        </button>
      </div>

      <div style={styles.grid}>
        {assets.map((asset) => (
          <div 
            key={asset.id} 
            style={{
              ...styles.card,
              gridColumn: asset.type === 'script_variants' ? '1 / -1' : 'auto', // 스크립트는 가로 전체 사용
              borderColor: asset.status === 'approved' ? '#10B981' : '#E5E7EB',
              background: asset.status === 'approved' ? '#F0FDF4' : '#FFFFFF'
            }}
          >
            {/* Media/Text Area */}
            <div style={{...styles.mediaArea, aspectRatio: asset.type === 'script_variants' ? 'auto' : '16/9'}}>
              {asset.type === 'image' && asset.url ? (
                <img src={asset.url} alt={asset.title} style={styles.image} />
              ) : asset.type === 'audio' ? (
                <div style={styles.audioPlaceholder}>
                  <Volume2 size={32} color="#9CA3AF" />
                  <span style={styles.audioText}>Audio Preview</span>
                </div>
              ) : asset.type === 'script_variants' ? (
                renderScriptVariants(asset)
              ) : asset.type === 'text' ? (
                <div style={styles.textPreview}>
                  <p style={styles.textPreviewContentText}>{asset.text}</p>
                </div>
              ) : (
                <div style={styles.placeholder}><ImageIcon size={32} color="#D1D5DB" /></div>
              )}
              
              {asset.status === 'approved' && asset.type !== 'script_variants' && (
                <div style={styles.approvedOverlay}><CheckCircle size={32} color="#10B981" /></div>
              )}
            </div>

            {/* Info Area */}
            <div style={styles.infoArea}>
              <h4 style={styles.assetTitle}>{asset.title}</h4>
              {asset.subtitle && <p style={styles.assetSubtitle}>{asset.subtitle}</p>}
              
              {asset.reasoning && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: '#F5F3FF', borderRadius: 8, border: '1px solid #DDD6FE' }}>
                  <p style={{ fontSize: 11, color: '#6D28D9', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={10} /> <strong>루피의 전략적 판단:</strong>
                  </p>
                  <p style={{ fontSize: 11, color: '#7C3AED', margin: '2px 0 0 0', lineHeight: 1.4 }}>{asset.reasoning}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={styles.actionArea}>
              <button 
                style={{...styles.actionBtn, color: asset.status === 'approved' ? '#10B981' : '#6B7280', fontWeight: asset.status === 'approved' ? 700 : 600}}
                onClick={() => onApprove(asset.id)}
              >
                <CheckCircle size={14} /> 승인
              </button>
              
              <button style={styles.actionBtn} onClick={() => onRegenerate(asset.id)}>
                <RefreshCw size={14} /> 재생성
              </button>
              
              {onEdit && (
                <button style={styles.actionBtn} onClick={() => onEdit(asset.id)}>
                  <Edit3 size={14} /> 직접 편집
                </button>
              )}
              
              <button style={{...styles.actionBtn, background: '#F5F3FF', borderColor: '#DDD6FE', color: '#7C3AED'}} onClick={() => alert('AI 지시창을 엽니다 (기능 준비중)')}>
                <Sparkles size={14} /> AI로 미세조정
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Neural Status Bar (NEW) */}
      <div style={styles.neuralStatus}>
        <div style={styles.statusItem}>
          <Activity size={14} color="#10B981" />
          <span>ViraLoop Neural Engine: <span style={{fontWeight: 700}}>Active</span></span>
        </div>
        <div style={styles.statusItem}>
          <Sparkles size={14} color="#F59E0B" />
          <span>Agent Loopie: <span style={{fontWeight: 700}}>Reasoning...</span></span>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, height: '100%', overflowY: 'auto', background: '#F8F9FC' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  title: { fontSize: 18, fontWeight: 700, color: '#1F2937', margin: 0 },
  countBadge: { fontSize: 12, fontWeight: 600, color: '#3B82F6', background: '#EFF6FF', padding: '4px 10px', borderRadius: '20px' },
  approveAllBtn: { display: 'flex', alignItems: 'center', gap: 8, background: '#10B981', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: 13, fontWeight: 600, transition: 'all 0.2s' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 },
  card: { border: '2px solid', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  mediaArea: { width: '100%', background: '#F3F4F6', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%', objectFit: 'cover' },
  audioPlaceholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  audioText: { fontSize: 12, color: '#6B7280', fontWeight: 500 },
  textPreview: { padding: '16px', width: '100%', height: '100%', background: '#FFFFFF', overflowY: 'auto' },
  textPreviewContentText: { fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 },
  scriptVariantContainer: { display: 'flex', flexDirection: 'column', width: '100%', background: '#FFFFFF' },
  langTabs: { display: 'flex', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' },
  langTab: { padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#6B7280', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  langTabActive: { color: '#3B82F6', borderBottomColor: '#3B82F6', background: '#FFFFFF' },
  redTeamBanner: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid' },
  textPreviewContent: { padding: '16px', fontSize: 14, color: '#1F2937', lineHeight: 1.6, minHeight: 120 },
  approvedOverlay: { position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.9)', borderRadius: '50%', padding: 4, display: 'flex' },
  infoArea: { padding: '12px 16px', borderBottom: '1px solid #F3F4F6' },
  assetTitle: { fontSize: 14, fontWeight: 600, color: '#1F2937', margin: '0 0 4px 0' },
  assetSubtitle: { fontSize: 12, color: '#6B7280', margin: 0 },
  actionArea: { display: 'flex', padding: '8px', gap: 8, background: '#F9FAFB' },
  actionBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: 12, fontWeight: 600, color: '#4B5563', cursor: 'pointer', transition: 'all 0.15s' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E7EB' },
  emptyIcon: { fontSize: 48, marginBottom: 16, animation: 'pulse 2s infinite ease-in-out' },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: '#374151', margin: '0 0 8px 0' },
  emptyDesc: { fontSize: 14, color: '#6B7280', margin: 0, textAlign: 'center', maxWidth: 300 },

  // Evolution Styles (VideoLingo inspired)
  evolutionContainer: { padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 },
  evolutionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  evolutionTitle: { fontSize: 12, fontWeight: 700, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 6 },
  netflixBadge: { fontSize: 10, background: '#1F2937', color: '#FFF', padding: '2px 8px', borderRadius: 4, fontWeight: 700 },
  evolutionSteps: { display: 'flex', gap: 12 },
  evoStep: { flex: 1, padding: 12, background: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB' },
  evoStepActive: { flex: 1.5, padding: 12, background: '#F5F3FF', borderRadius: 8, border: '1px solid #C4B5FD', boxShadow: '0 2px 4px rgba(124, 58, 237, 0.1)' },
  evoStepLabel: { fontSize: 10, fontWeight: 700, color: '#9CA3AF', marginBottom: 4, display: 'block' },
  evoStepLabelActive: { fontSize: 10, fontWeight: 800, color: '#7C3AED', marginBottom: 4, display: 'block' },
  evoStepText: { fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.5 },
  evoStepTextActive: { fontSize: 13, color: '#1F2937', fontWeight: 600, margin: 0, lineHeight: 1.6 },
  
  glossaryBox: { marginTop: 8, padding: 12, background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0' },
  glossaryHeader: { fontSize: 11, fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 },
  glossaryGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
  glossaryItem: { display: 'flex', flexDirection: 'column' },
  glossaryTerm: { fontSize: 11, fontWeight: 800, color: '#166534' },
  glossaryDef: { fontSize: 10, color: '#15803D' },

  neuralStatus: { display: 'flex', gap: 24, padding: '12px 20px', background: '#1F2937', color: '#FFFFFF', borderRadius: '0 0 12px 12px', marginTop: 'auto' },
  statusItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#9CA3AF' },

  // Structure Map Styles
  structureContainer: { padding: '0 16px 16px 16px', background: '#FFFFFF' },
  structureHeader: { fontSize: 12, fontWeight: 700, color: '#1F2937', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #F3F4F6' },
  structureTimeline: { display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' },
  structurePhase: { display: 'flex', gap: 12, position: 'relative' },
  structureDot: { width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0 },
  structureInfo: { display: 'flex', flexDirection: 'column' },
  structureLabel: { fontSize: 10, fontWeight: 800, color: '#6B7280' },
  structureDesc: { fontSize: 12, color: '#374151', margin: '2px 0 0 0', lineHeight: 1.4 }
};

export default AssetApprovalBoard;
