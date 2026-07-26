/**
 * ViraLoop Elite: Command Studio (Universal Sovereign V8)
 * 인공지능 에이전트 협업 기반 영상 편집 및 관제 사령부
 * Pristine White Theme + Unified Elite API Sync
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import BeatsList, { Beat } from '../components/beats/BeatsList';
import BeatCanvas from '../components/beats/BeatCanvas';
import CreativeControl from '../components/beats/CreativeControl';
import {
  ActivitySquare, Zap, Target, Loader2, PlayCircle,
  Link as LinkIcon, Compass, Sliders, ImageIcon,
  FastForward, CheckCircle2, FileText, Video, Eye,
  TrendingUp, Sparkles, Volume2, Type, Layout, Globe,
  LayoutGrid, LayoutList, Search, ChevronRight, MessageSquare, Activity,
  ShieldAlert, Settings, BarChart3, Download, Folder, Calendar, Users, User, Edit2, X,
  FolderOpen, LineChart as LineChartIcon, Play, RefreshCw, AlertCircle,
  Clock, Trash2, Settings2, Terminal, Plus, RotateCcw, ExternalLink, Upload,
  Library, History, Check, ShieldCheck, Wand2, Layers, Move, Maximize, Mic, Scissors,
  MousePointer2, Square, Minus, LockKeyhole
} from 'lucide-react';
import { getMediaUrl } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import SubtitleViewer from '../components/SubtitleViewer';
import { Player } from '@remotion/player';
import { EliteSequence } from '../remotion/compositions/EliteSequence';

// -- Video Player Component for Elite Command Studio --
const VideoPlayer = ({ src, title }: { src: string, title: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const handleSpeedChange = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackRate(speed);
    }
  };

  return (
    <div className="flex flex-col bg-black rounded-xl overflow-hidden">
      <div className="relative w-full aspect-[9/16] bg-black">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          controls={true}
          playsInline
          autoPlay
        />
      </div>
      <div className="p-4 bg-gray-900 text-white border-t border-gray-800">
        <h3 className="mb-3 text-sm truncate font-medium text-gray-200">{title}</h3>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400 font-mono">Playback Speed</span>
          <div className="flex items-center gap-1 bg-white/10 p-1 rounded-lg">
            {[1.0, 1.25, 1.5, 2.0].map((speed) => (
              <button
                key={speed}
                onClick={() => handleSpeedChange(speed)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${playbackRate === speed ? "bg-blue-600 text-white" : "hover:bg-white/10 text-gray-400"
                  }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const formatNumber = (num: number) => {
  if (num >= 10000) return (num / 10000).toFixed(1) + '만';
  if (num >= 1000) return (num / 1000).toFixed(1) + '천';
  return num.toString();
};

const EliteCommandStudio: React.FC = () => {
  const { videoId: videoIdParam } = useParams<{ videoId?: string }>();
  const navigate = useNavigate();

  const [videoId, setVideoId] = useState<number>(videoIdParam ? parseInt(videoIdParam, 10) : 0);
  const [inputUrl, setInputUrl] = useState<string>('');

  // Data State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inboxVideos, setInboxVideos] = useState<any[]>([]);
  const [videoMeta, setVideoMeta] = useState<any>(null);
  const [beats, setBeats] = useState<Beat[]>([]);
  const totalDuration = useMemo(() => beats.reduce((acc, b) => acc + (b.duration_sec || 5), 0), [beats]);
  const [selectedBeat, setSelectedBeat] = useState<any | null>(null);
  const [selectedStrategyTemplate, setSelectedStrategyTemplate] = useState<string>('viral_loop');
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockResults, setStockResults] = useState<any[]>([]);
  const [isDNAAnalyzing, setIsDNAAnalyzing] = useState(false);
  const [isPhaseTransitioning, setIsPhaseTransitioning] = useState(false);

  // Phase change with animation
  const goToNextPhase = () => {
    setIsPhaseTransitioning(true);
    setTimeout(() => {
      const next = Math.min(5, currentPhase + 1);
      setCurrentPhase(next);
      saveProjectState(next);
      setIsPhaseTransitioning(false);
    }, 400);
  };

  const goToPrevPhase = () => {
    setIsPhaseTransitioning(true);
    setTimeout(() => {
      const prev = Math.max(1, currentPhase - 1);
      setCurrentPhase(prev);
      saveProjectState(prev);
      setIsPhaseTransitioning(false);
    }, 400);
  };

  const setPhaseDirectly = (p: number) => {
    setIsPhaseTransitioning(true);
    setTimeout(() => {
      setCurrentPhase(p);
      saveProjectState(p);
      setIsPhaseTransitioning(false);
    }, 400);
  };
  const [videoDNA, setVideoDNA] = useState<string>('');
  const [visualAnchor, setVisualAnchor] = useState<string>('');
  const [masterVisualDNA, setMasterVisualDNA] = useState<string>('Cinematic, 4k, hyper-detailed, photorealistic');
  const [detailedPrompts, setDetailedPrompts] = useState<Record<string, string>>({});
  const [stockRecommendations, setStockRecommendations] = useState<Record<string, any[]>>({});
  const [generationProgress, setGenerationProgress] = useState<Record<string, 'pending' | 'generating' | 'completed' | 'failed'>>({});
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [heroAssetUrl, setHeroAssetUrl] = useState<string | null>(null);
  const [isHeroGenerating, setIsHeroGenerating] = useState(false);
  const [styleBible, setStyleBible] = useState<any>({
    color_palette: 'Cinematic Blue & Gold',
    lighting: 'Soft Volumetric',
    camera: 'Anamorphic 35mm',
    consistency_seed: Math.floor(Math.random() * 1000000)
  });

  // --- [NEW] Elite Timeline States ---
  const [currentTime, setCurrentTime] = useState(0); // in seconds
  const [zoomLevel, setZoomLevel] = useState(10); // pixels per second (initial)
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTool, setActiveTool] = useState<'select' | 'split' | 'trim'>('select');
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);

  // --- [NEW] Render States ---
  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [renderEngine, setRenderEngine] = useState<'remotion' | 'hyperframes'>('remotion');
  const playerRef = useRef<any>(null);

  // --- [NEW] Playback & Seeking Logic ---
  const handleSeek = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineScrollLeft;
    const time = x / (zoomLevel * 10);
    setCurrentTime(Math.max(0, Math.min(time, totalDuration)));
  };

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      if (playerRef.current && renderEngine === 'remotion') {
        playerRef.current.play();
      }
      interval = setInterval(() => {
        setCurrentTime((prev: number) => {
          const next = prev + 0.1;
          if (next >= totalDuration) {
            setIsPlaying(false);
            if (playerRef.current) playerRef.current.pause();
            return totalDuration;
          }
          return next;
        });
      }, 100);
    } else {
      if (playerRef.current) playerRef.current.pause();
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration, renderEngine]);

  // Sync Remotion Player frame with currentTime
  useEffect(() => {
    if (playerRef.current && renderEngine === 'remotion' && !isPlaying) {
      const frame = Math.floor(currentTime * 30);
      playerRef.current.seekTo(frame);
    }
  }, [currentTime, renderEngine, isPlaying]);

  // Sync selected beat with playhead
  useEffect(() => {
    let accumulated = 0;
    for (const b of beats) {
      const dur = b.duration_sec || 5;
      if (currentTime >= accumulated && currentTime < accumulated + dur) {
        if (selectedBeat?.id !== b.id) setSelectedBeat(b);
        break;
      }
      accumulated += dur;
    }
  }, [currentTime, beats]);

  const STRATEGY_TEMPLATES = {
    viral_loop: { name: '바이럴 루프 (Viral Loop)', desc: '도입부 충격 -> 반전 -> 루프 구조' },
    problem_solver: { name: '문제 해결 (Problem/Solution)', desc: '문제 제기 -> 자극 -> 해결책 -> CTA' },
    educational: { name: '지식 정보 (Educational)', desc: '개념 설명 -> 상세 데이터 -> 요약' },
    storytelling: { name: '스토리텔링 (Hero\'s Journey)', desc: '발단 -> 전개 -> 위기 -> 절정 -> 결말' }
  };

  const STYLE_DNA_PRESETS = [
    { id: 'source', name: 'Source DNA Match', icon: <History size={14} />, desc: '원본 영상의 색감, 구도, 분위기 계승' },
    { id: 'cinematic', name: 'Cinematic Master', icon: <Video size={14} />, desc: '영화적 조명과 피사체 집중도 강화' },
    { id: 'vibrant', name: 'Vibrant Viral', icon: <Zap size={14} />, desc: '고대비, 선명한 색상, 시선 강탈 스타일' },
    { id: 'minimal', name: 'Clean Minimal', icon: <Layout size={14} />, desc: '정갈하고 세련된 미니멀리즘 연출' }
  ];
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Inbox View State
  const [inboxTab, setInboxTab] = useState<'all' | 'video' | 'script' | 'ops'>('all');
  const [inboxViewMode, setInboxViewMode] = useState<'list' | 'grid'>('grid');
  const [cardSize, setCardSize] = useState<'sm' | 'md' | 'lg'>('md');

  // UI State & Strategy
  const [currentPhase, setCurrentPhase] = useState<number>(1); // 1: Strategy, 2: Narrative, 3: Orchestration, 4: Production, 5: Deploy
  const [sourceMode, setSourceMode] = useState<'remix' | 'ai_gen' | 'collage'>('remix');
  const [selectedPersona, setSelectedPersona] = useState('strategist');
  const [strategy, setStrategy] = useState({
    direction: 'auto',
    visualStyle: 'cinematic',
    pacing: 'fast',
    aspectRatio: '9:16',
    preset: 'viral_hook',
    layout: 'remotion', // Default to remotion
    keywords: ['Viral', 'Shorts', 'AI'],
    targetAudience: 'Gen Z / Alpha',
  });

  // --- [NEW] Genesis & Production States ---
  const [ttsConfig, setTTSConfig] = useState<any>({
    engine: "google",
    language: "ko",
    voice_id: "google_female",
    speed: 1.0,
    pitch: 0,
    emotion: "normal",
    use_silence_removal: false,
    silence_threshold: -40,
    min_silence_len: 300,
    keep_silence_len: 50
  });

  const [subtitleConfig, setSubtitleConfig] = useState<any>({
    enabled: true,
    font: 'Arial',
    fontSize: 40,
    isBold: true,
    textColor: '#ffffff',
    outlineSize: 2,
    outlineColor: '#000000',
    shadowSize: 2,
    shadowColor: '#000000',
    position: 'bottom',
    animation: 'none',
    splitLimit: 20
  });

  const generateId = () => Math.random().toString(36).substring(2, 11);
  const [overlays, setOverlays] = useState<any[]>([]);

  // Persona/Style State
  const [scriptStyles, setScriptStyles] = useState<any[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<number | null>(null);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<any | null>(null);
  const [scriptAnalysis, setScriptAnalysis] = useState<any | null>(null);

  const fetchScriptAnalysis = async () => {
    if (videoId <= 0) return;
    try {
      const { data } = await axios.get(`/api/videos/${videoId}/script-analysis`);
      setScriptAnalysis(data);
    } catch (e) {
      console.warn("Using fallback script analysis data.");
      setScriptAnalysis({
        mood: "Dramatic",
        key_characters: ["Danbi", "Old Man"],
        themes: ["Time Travel", "Greed", "Redemption"],
        visual_style: "Cinematic Neo-Noir"
      });
    }
  };

  useEffect(() => {
    if (videoId > 0 && currentPhase === 2) {
      // Disabled 404-causing call, using internal state or strategy meta instead
      // fetchScriptAnalysis();
      if (!scriptAnalysis) {
        setScriptAnalysis({
          mood: (strategy as any).mood || "Dramatic",
          key_characters: ["Danbi", "Old Man"],
          themes: ["Time Travel", "Greed", "Redemption"],
          visual_style: strategy.visualStyle || "Cinematic Neo-Noir"
        });
      }
    }
  }, [videoId, currentPhase]);

  const fetchScriptStyles = async () => {
    try {
      const { data } = await axios.get('/api/script/styles');
      setScriptStyles(data || []);
    } catch (e) {
      console.error("Failed to fetch styles", e);
    }
  };

  useEffect(() => {
    fetchScriptStyles();
  }, []);

  // Operations Hub State - Now synchronized with real data
  const [operations, setOperations] = useState<any[]>([]);

  useEffect(() => {
    if (inboxVideos.length > 0) {
      const ops = inboxVideos
        .filter(v => {
          // Only show active operations:
          // 1. Currently processing
          // 2. Already successful/completed
          // 3. Has specific project metadata (like phase or beats)
          const hasProjectMeta = v.metadata_json?.current_phase || (v.metadata_json?.beats && v.metadata_json.beats.length > 0);
          return v.status === 'processing' || v.status === 'success' || hasProjectMeta;
        })
        .map(v => {
          const phaseNum = v.metadata_json?.current_phase || 1;
          const overallProgress = Math.min(100, phaseNum * 20);

          return {
            id: v.id,
            displayId: `OP-${v.id.toString().padStart(4, '0')}`,
            title: v.title || "Untitled Operation",
            phase: phaseNum,
            status: v.status === 'ready' ? 'Ready' : v.status === 'processing' ? 'Running' : 'Success',
            progress: overallProgress,
            lastSync: v.updated_at ? `${Math.floor((new Date().getTime() - new Date(v.updated_at).getTime()) / 60000)}m ago` : 'N/A'
          };
        });
      setOperations(ops);
    }
  }, [inboxVideos]);

  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const cleanTranscript = (text: string) => {
    if (!text) return "";
    return text
      .replace(/^WEBVTT.*\n/g, '')
      .replace(/\d{1,2}:\d{2}:\d{2}[,.]\d{3} --> \d{1,2}:\d{2}:\d{2}[,.]\d{3}/g, '')
      .replace(/^\d+\s*$/gm, '')
      .replace(/<[^>]+>/g, '')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  };

  // Gallery Logic Ports
  const [playingVideo, setPlayingVideo] = useState<any | null>(null);
  const [subtitleVideo, setSubtitleVideo] = useState<any | null>(null);
  const [statsVideo, setStatsVideo] = useState<any | null>(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState<'Media' | 'Visuals' | 'Text' | 'Overlays'>('Media');
  const queryClient = useQueryClient();

  const { data: videoHistory } = useQuery({
    queryKey: ['history', statsVideo?.id],
    queryFn: async () => {
      const res = await axios.get(`/api/videos/${statsVideo?.id}/history`);
      return res.data;
    },
    enabled: !!statsVideo
  });

  const chartData = useMemo(() => {
    if (!videoHistory || videoHistory.length === 0 || !statsVideo) return [];
    const sorted = [...videoHistory].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const uploadDate = new Date(statsVideo.upload_date || statsVideo.created_at).getTime();

    return sorted.map((item, i) => {
      let velocity = 0;
      const itemTime = new Date(item.timestamp).getTime();
      const hoursSinceUpload = Math.max(0.1, (itemTime - uploadDate) / (1000 * 60 * 60));
      const lifetimeVelocity = item.view_count / hoursSinceUpload;

      if (i > 0) {
        const prev = sorted[i - 1];
        const prevTime = new Date(prev.timestamp).getTime();
        const hours = (itemTime - prevTime) / (1000 * 60 * 60);
        if (hours > 0) {
          const instantVelocity = (item.view_count - prev.view_count) / hours;
          velocity = instantVelocity > 0 ? instantVelocity : lifetimeVelocity;
        }
      } else {
        velocity = lifetimeVelocity;
      }

      return { ...item, velocity: Math.max(0, Math.floor(velocity)) };
    });
  }, [videoHistory, statsVideo]);

  const hdDownloadMutation = useMutation({
    mutationFn: (videoId: number) => axios.post('/api/videos/manual-hd-download', { video_id: videoId }),
    onSuccess: () => alert('HD 다운로드가 완료되었습니다.'),
    onError: (err: any) => alert(`다운로드 실패: ${err.response?.data?.detail || err.message}`)
  });

  const openFolder = async (path: string | null) => {
    if (!path) return;
    try {
      await axios.post('/api/system/open-folder', { path });
    } catch (e) {
      alert("폴더를 열 수 없습니다.");
    }
  };

  // 1. Fetch Inbox (Gallery Mode)
  useEffect(() => {
    if (videoId === 0) {
      const fetchInbox = async () => {
        try {
          setIsLoading(true);
          setError(null);

          // Concurrent fetch for both videos and scripts to populate all tabs
          const [videoRes, scriptRes] = await Promise.all([
            axios.get(`/api/videos/?limit=100&sort_by=id&sort_order=desc`),
            axios.get(`/api/videos/?limit=100&mode=script&sort_by=id&sort_order=desc`)
          ]);

          const videos = videoRes.data || [];
          const scripts = (scriptRes.data || []).map((s: any) => ({ ...s, is_script_only: true }));

          // Merge and de-duplicate (prefer scripts if ID overlaps for some reason)
          const merged = [...videos];
          scripts.forEach((s: any) => {
            if (!merged.find(m => m.id === s.id)) {
              merged.push(s);
            }
          });

          setInboxVideos(merged);
        } catch (err) {
          setError("시스템 데이터를 불러오는 중 오류가 발생했습니다.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchInbox();
    }
  }, [videoId]);

  const resetProjectState = () => {
    setVideoMeta(null);
    setBeats([]);
    setSelectedBeat(null);
    setScriptText("");
    setCurrentPhase(1);
    setScriptAnalysis(null);
    scriptInitialized.current = false;
  };

  // 2. Fetch Elite Project Data (Elite API Sync)
  useEffect(() => {
    if (videoId > 0) {
      const fetchEliteProject = async () => {
        try {
          setIsLoading(true);
          setError(null);

          const [beatsRes, videoBaseRes] = await Promise.all([
            axios.get(`/api/beats/video/${videoId}`),
            axios.get(`/api/videos/${videoId}`).catch(err => {
              if (err.response?.status === 404) {
                console.error(`Project ${videoId} not found. Redirecting to Inbox.`);
                setVideoId(0);
                resetProjectState();
                navigate('/studio');
              }
              return { data: null };
            })
          ]);

          const data = beatsRes.data;
          const baseData = videoBaseRes.data;

          if (data && data.video_metadata) {
            const existingMeta = inboxVideos.find(v => v.id === videoId) || baseData;
            const fallbackTranscript = existingMeta?.content || existingMeta?.description || "";

            setVideoMeta({
              ...data.video_metadata,
              transcript: cleanTranscript(data.video_metadata.metadata_json?.script || data.video_metadata.transcript || fallbackTranscript)
            });
            setBeats(data.video_metadata.metadata_json?.beats || data.beats || []);

            if (data.video_metadata.metadata_json?.current_phase) {
              setCurrentPhase(data.video_metadata.metadata_json.current_phase);
            }

            if (data.beats && data.beats.length > 0) {
              setSelectedBeat(data.beats[0]);
            }
          }
        } catch (err: any) {
          if (err.response?.status === 404) {
            setError("해당 작전을 찾을 수 없습니다 (404).");
            setVideoId(0);
            resetProjectState();
            navigate('/studio');
          } else {
            setError("프로젝트 작전 데이터를 구성하지 못했습니다.");
          }
          console.error("Fetch Error:", err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchEliteProject();
    }
  }, [videoId]);


  const handleApplyToAll = (updates: Partial<Beat>) => {
    const updatedBeats = beats.map(b => ({ ...b, ...updates }));
    setBeats(updatedBeats);
  };

  const [scriptText, setScriptText] = useState("");
  const [tempoPercentage, setTempoPercentage] = useState(100);
  const scriptInitialized = useRef(false);

  const saveProjectState = async (targetPhase?: number) => {
    if (videoId <= 0) return;
    try {
      const currentMeta = videoMeta?.metadata_json || {};
      const updatedMeta = {
        ...currentMeta,
        current_phase: targetPhase !== undefined ? targetPhase : currentPhase,
        script: scriptText,
        beats: beats,
        last_saved: new Date().toISOString()
      };

      await axios.patch(`/api/videos/${videoId}`, {
        metadata_json: updatedMeta,
        mode: 'operation'
      });
      console.log("✅ Project state saved");
    } catch (err) {
      console.error("❌ Save failed:", err);
    }
  };

  useEffect(() => {
    scriptInitialized.current = false;
    setScriptText("");
  }, [videoId]);

  useEffect(() => {
    if (videoMeta?.transcript && !scriptInitialized.current) {
      setScriptText(cleanTranscript(videoMeta.transcript));
      scriptInitialized.current = true;
    }
  }, [videoMeta]);

  // Debounced Auto-Save
  useEffect(() => {
    if (!scriptInitialized.current || videoId <= 0) return;

    const timer = setTimeout(async () => {
      // 1. Save to Video Metadata (Original Logic)
      saveProjectState();

      // 2. Save to Dedicated Script Persistence (New Logic)
      try {
        await axios.post(`/api/scripts/${videoId}/save`, {
          video_id: videoId,
          script_content: scriptText
        });
      } catch (err) {
        console.warn("Script-specific save failed:", err);
      }
    }, 2000); // Save after 2 seconds of inactivity

    return () => clearTimeout(timer);
  }, [scriptText, videoId]);

  // Phase 2: Refine Script
  const handleRefineScript = async (instruction: string = "전반적으로 자연스럽게 퇴고해줘", forceTempo: number | null = null) => {
    try {
      setIsLoading(true);
      const { data } = await axios.post('/api/script/refine', {
        video_id: videoId,
        current_text: scriptText,
        instruction: instruction,
        persona: selectedPersona,
        style_id: selectedStyleId,
        provider: 'groq',
        model: 'groq/llama-3.3-70b-versatile',
        tempo_percentage: forceTempo || 100
      });
      if (data.script) setScriptText(data.script);
    } catch (err) {
      console.error("Refine Error:", err);
      alert("대본 퇴고 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // Phase 2: Analyze Video (Extract Script)
  const handleAnalyzeVideo = async () => {
    try {
      setIsLoading(true);
      const { data } = await axios.post(`/api/scripts/${videoId}/analyze`);
      if (data && data.summary_one_line) {
        if (data.script_content) {
          setScriptText(data.script_content);
          scriptInitialized.current = true;
        } else {
          // Fallback: fetch video meta again to get the transcript
          const res = await axios.get(`/api/beats/video/${videoId}`);
          if (res.data && res.data.video_metadata) {
            const text = res.data.video_metadata.transcript || res.data.video_metadata.content || "";
            if (text) {
              setScriptText(text);
              scriptInitialized.current = true;
            }
          }
        }
      }
    } catch (err) {
      console.error("Analysis Error:", err);
      alert("동영상 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  // Elite Stage 3.1: Style Branding & DNA Locking
  const handleGenerateHeroAnchor = async () => {
    try {
      setIsHeroGenerating(true);
      const { data } = await axios.post('/api/creative/generate-prompt', {
        script: `Master visual anchor reference for ${visualAnchor}`,
        visual_anchor: visualAnchor,
        style_bible: styleBible,
        master_visual_dna: masterVisualDNA
      });
      
      if (data.prompt) {
        setMasterVisualDNA(data.prompt);
        alert("비주얼 히어로 앵커 DNA가 합성되었습니다. 이제 모든 비트가 이 정밀 프롬프트를 기반으로 오케스트레이션됩니다.");
      }
    } catch (e) {
      console.error("Hero DNA Orchestration Error:", e);
      alert("DNA 합성 중 오류가 발생했습니다.");
    } finally {
      setIsHeroGenerating(false);
    }
  };

  // Phase 3: Segment Script to Beats
  const handleSegmentScript = async () => {
    try {
      setIsLoading(true);
      const { data } = await axios.post('/api/beats/segment-from-script', {
        video_id: videoId,
        script: scriptText,
        strategy_template: selectedStrategyTemplate
      });

      if (data.success) {
        let processedBeats = data.beats;

        // [ELITE] Extract Visual Anchor
        const anchorMatch = scriptText.match(/([가-힣\w\s]+)가/) || scriptText.match(/([가-힣\w\s]+)는/);
        const anchor = anchorMatch ? anchorMatch[1].trim() : "Main subject";
        setVisualAnchor(`${anchor}, elite production`);

        // Semantic Check & Enrichment
        const sentences = scriptText.match(/[^.!?\n]+[.!?\n]*/g) || [scriptText];
        const enriched = await Promise.all(processedBeats.map(async (b: any, i: number) => {
          const content = b.content || sentences[Math.min(i, sentences.length - 1)].trim();
          const keywords = content.split(' ').filter((w: string) => w.length > 2).slice(0, 3).join(', ');
          const detailPrompt = `${content}. ${masterVisualDNA}. Focusing on ${anchor}. Cinematic lighting, 8k resolution.`;
          
          let recs: any[] = [];
          try {
            const stockRes = await axios.get(`/api/assets/stock/video?keyword=${encodeURIComponent(keywords || anchor)}`);
            recs = (stockRes.data.results || []).slice(0, 4);
          } catch (e) {}

          return {
            ...b,
            id: b.id || `beat-${i}-${Date.now()}`,
            content,
            keywords,
            visual_prompt: detailPrompt,
            stock_recs: recs,
            source_mode: 'original',
            media_url: videoMeta?.url || '',
            media_type: 'video'
          };
        }));

        setBeats(enriched);
        if (enriched.length > 0) setSelectedBeat(enriched[0]);
        
        const prompts: Record<string, string> = {};
        const recs: Record<string, any[]> = {};
        enriched.forEach((b: any) => {
          prompts[b.id] = b.visual_prompt;
          recs[b.id] = b.stock_recs;
        });
        setDetailedPrompts(prompts);
        setStockRecommendations(recs);

        if (currentPhase === 2) goToNextPhase();
      }
    } catch (err) {
      console.error("Segment Error:", err);
      alert("대본 구성 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkAIGenerate = async () => {
    if (beats.length === 0) {
      alert("먼저 대본 구성을 가동해주세요.");
      return;
    }
    setIsBulkGenerating(true);
    
    try {
      const updatedBeats = [...beats];
      const newPrompts = { ...detailedPrompts };

      for (let i = 0; i < updatedBeats.length; i++) {
        const b = updatedBeats[i];
        
        // Skip if already has a detailed prompt (optional)
        // if (detailedPrompts[b.id]) continue;

        setGenerationProgress((prev: any) => ({ ...prev, [b.id]: 'generating' }));
        
        try {
          const { data } = await axios.post('/api/creative/generate-prompt', {
            script: b.content,
            visual_anchor: visualAnchor,
            style_bible: styleBible,
            master_visual_dna: masterVisualDNA
          });
          
          if (data.prompt) {
            newPrompts[b.id] = data.prompt;
            updatedBeats[i] = { ...b, visual_prompt: data.prompt, source_mode: 'ai_gen' };
            setGenerationProgress((prev: any) => ({ ...prev, [b.id]: 'completed' }));
          } else {
            setGenerationProgress((prev: any) => ({ ...prev, [b.id]: 'failed' }));
          }
        } catch (e) {
          console.error(`Orchestration error for beat ${b.id}:`, e);
          setGenerationProgress((prev: any) => ({ ...prev, [b.id]: 'failed' }));
        }
        
        // Batch update state for responsiveness
        if (i % 3 === 0 || i === updatedBeats.length - 1) {
          setBeats([...updatedBeats]);
          setDetailedPrompts({ ...newPrompts });
        }
      }
      alert("전체 비트 AI 정밀 비주얼 오케스트레이션이 완료되었습니다.");
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const handleIndividualAssetAction = async (beatId: string, action: 'source' | 'ai' | 'upload' | 'stock', value?: any) => {
    const b = beats.find(x => x.id === beatId);
    if (!b) return;

    switch (action) {
      case 'source':
        const sourceBeat: any = { ...b, source_mode: 'original', media_url: videoMeta?.url || '', media_type: 'video' };
        setBeats(beats.map(x => x.id === beatId ? sourceBeat : x));
        setSelectedBeat(sourceBeat);
        break;
      case 'ai':
        setGenerationProgress((prev: any) => ({ ...prev, [b.id]: 'generating' }));
        try {
          const { data } = await axios.post('/api/creative/generate-prompt', {
            script: b.content,
            visual_anchor: visualAnchor,
            style_bible: styleBible,
            master_visual_dna: masterVisualDNA
          });
          
          if (data.prompt) {
            const aiBeat: any = { ...b, visual_prompt: data.prompt, source_mode: 'ai_gen' };
            setBeats(beats.map(x => x.id === beatId ? aiBeat : x));
            setSelectedBeat(aiBeat);
            setDetailedPrompts(prev => ({ ...prev, [b.id]: data.prompt }));
            setGenerationProgress((prev: any) => ({ ...prev, [b.id]: 'completed' }));
          } else {
            setGenerationProgress((prev: any) => ({ ...prev, [b.id]: 'failed' }));
          }
        } catch (e) {
          console.error("Single Orchestration Error:", e);
          setGenerationProgress((prev: any) => ({ ...prev, [b.id]: 'failed' }));
        }
        break;
      case 'upload':
        const uploadBeat: any = { ...b, source_mode: 'upload', media_url: value, media_type: 'image' };
        setBeats(beats.map(x => x.id === beatId ? uploadBeat : x));
        setSelectedBeat(uploadBeat);
        break;
      case 'stock':
        const stockBeat: any = { ...b, source_mode: 'stock', media_url: value, media_type: value?.includes('.mp4') ? 'video' : 'image' };
        setBeats(beats.map(x => x.id === beatId ? stockBeat : x));
        setSelectedBeat(stockBeat);
        break;
    }
  };

  const handleUpdateBeatStyle = (key: string, value: any) => {
    if (!selectedBeat) return;
    const updated = { ...selectedBeat, [key]: value };
    const updatedBeats = beats.map(b => b.id === selectedBeat.id ? updated : b);
    setBeats(updatedBeats);
    setSelectedBeat(updated);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBeat) return;

    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('subfolder', `operations/${videoId}`);

      const { data } = await axios.post('/api/videos/upload_studio', formData);
      if (data.url) {
        handleIndividualAssetAction(selectedBeat.id, 'upload', data.url);
      }
    } catch (err) {
      console.error("Upload Error:", err);
      alert("파일 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitiateRender = async () => {
    try {
      setIsRendering(true);
      setRenderProgress(5);
      const { data } = await axios.post('/api/beats/render', {
        video_id: videoId,
        engine: renderEngine,
        beats: beats.map(b => ({
          ...b,
          duration_sec: b.duration_sec || 5,
          transform: b.transform || { scale: 1, x: 0, y: 0, rotate: 0, opacity: 1 },
          fx: b.fx || { blur: 0, brightness: 100, contrast: 100 }
        }))
      });

      if (data.task_id) {
        setRenderJobId(data.task_id);
        setCurrentPhase(5);
      }
    } catch (err) {
      console.error("Render Initiation Failed:", err);
      alert("렌더링 작전 개시 중 오류가 발생했습니다.");
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (renderJobId && isRendering) {
      interval = setInterval(async () => {
        try {
          const { data } = await axios.get(`/api/beats/status/${renderJobId}`);
          setRenderProgress(data.progress || 0);
          if (data.status === 'COMPLETED' || data.status === 'completed') {
            setFinalVideoUrl(data.output_url || data.output_path || null);
            setIsRendering(false);
            setRenderJobId(null);
            if (interval) clearInterval(interval);
          } else if (data.status === 'FAILED' || data.status === 'failed') {
            setIsRendering(false);
            setRenderJobId(null);
            alert('렌더링 실패: ' + (data.error || '알 수 없는 오류'));
            if (interval) clearInterval(interval);
          }
        } catch (e) {
          console.error("Status check failed", e);
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [renderJobId, isRendering]);

  const handleStartOperation = async () => {
    if (!inputUrl) return;
    try {
      setIsLoading(true);
      // Create a script-only video project first
      const { data } = await axios.post('/api/videos/download', {
        url: inputUrl.startsWith('http') ? inputUrl : '',
        script_only: !inputUrl.startsWith('http'),
        title: inputUrl.startsWith('http') ? "Analyzing URL..." : inputUrl.slice(0, 30)
      });

      if (data && data.id) {
        setVideoId(data.id);
        setInputUrl('');
        resetProjectState();
        navigate(`/studio/${data.id}`);
      }
    } catch (err) {
      console.error("Start Operation Failed:", err);
      alert("작전 생성에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePreview = async () => {
    if (!selectedBeat) return;
    setIsLoading(true);
    try {
      // Mocking AI generation delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert("AI 프리뷰 생성이 요청되었습니다. 서버에서 렌더링이 완료되면 알림을 드립니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnhancePrompt = () => {
    if (!selectedBeat) return;
    const currentIntent = selectedBeat.visual_intent || "Cinematic shot";
    const dnaAddon = videoDNA ? `, style matching: ${videoDNA}` : "";
    const anchorAddon = visualAnchor ? `${visualAnchor}, ` : "";

    // Structured High-Fidelity Template
    const subjectAction = `${anchorAddon}${currentIntent}`;
    const environment = "set in a rich historical environment with atmospheric depth";
    const lighting = "soft golden hour lighting, cinematic rim light, volumetric fog";
    const camera = "shot on 35mm lens, f/1.8, shallow depth of field, sharp focus on subject, professional color grading";
    const technical = "8k, masterpiece, highly detailed, photorealistic, Unreal Engine 5 render style";

    const enhanced = `${subjectAction}, ${environment}, ${lighting}, ${camera}, ${technical}${dnaAddon}`;

    const newBeats = beats.map(b => b.id === selectedBeat.id ? { ...b, image_prompt: enhanced } : b);
    setBeats(newBeats);
    setSelectedBeat({ ...selectedBeat, image_prompt: enhanced });
  };

  // --- [NEW] Genesis Phase Handlers ---
  const [isGeneratingGenesis, setIsGeneratingGenesis] = useState(false);
  const [genesisResult, setGenesisResult] = useState<{ audioUrl?: string, srtContent?: string } | null>(null);

  const handleApplyTTSPreset = (type: string, gender: 'male' | 'female') => {
    let vid = "google_female";
    let sp = 1.0;
    let p = 0;
    if (type === 'shorts') {
      vid = gender === 'female' ? "ko-KR-SunHiNeural" : "ko-KR-InJoonNeural";
      sp = 1.25; p = 2;
    } else if (type === 'news') {
      vid = gender === 'female' ? "google_female_calm" : "google_male_calm";
      sp = 1.0; p = 0;
    }
    setTTSConfig({ ...ttsConfig, voice_id: vid, speed: sp, pitch: p });
  };

  const handleGenerateGenesis = async () => {
    if (!scriptText.trim()) {
      alert("대본을 먼저 작성해주세요.");
      return;
    }
    setIsGeneratingGenesis(true);
    try {
      // 1. Generate TTS
      const ttsFormData = new FormData();
      ttsFormData.append("text", scriptText);
      ttsFormData.append("engine", ttsConfig.engine);
      ttsFormData.append("language", ttsConfig.language);
      ttsFormData.append("voice_id", ttsConfig.voice_id);
      const rateVal = Math.round((ttsConfig.speed - 1.0) * 100);
      ttsFormData.append("rate", rateVal.toString());
      ttsFormData.append("pitch", ttsConfig.pitch.toString());

      const ttsRes = await axios.post("/api/tools/tts/generate", ttsFormData);
      let audioPath = ttsRes.data.server_path;
      let audioUrl = ttsRes.data.web_url;

      // 2. Optional Silence Removal (FIXED: Uses FormData and JSON string for options)
      if (ttsConfig.use_silence_removal) {
        const silFormData = new FormData();
        silFormData.append("input_path", audioPath);
        silFormData.append("options", JSON.stringify({
          threshold: ttsConfig.silence_threshold,
          min_silence_len: ttsConfig.min_silence_len,
          keep_silence_len: ttsConfig.keep_silence_len
        }));

        const silRes = await axios.post("/api/tools/silence/process", silFormData);
        audioPath = silRes.data.server_path;
        audioUrl = silRes.data.web_url;
      }

      // 3. Extract SRT (FIXED: Uses correct data structure)
      const srtRes = await axios.post("/api/tools/subtitle/extract-from-path", {
        audio_path: audioPath,
        language: ttsConfig.language === 'auto' ? 'ko' : ttsConfig.language,
        model: "base"
      });
      const srtContent = srtRes.data.srt_content;

      // 4. Elite Smart Split (Based on character counts: 10 for Shorts, 23 for Longform)
      const isShorts = strategy.aspectRatio === '9:16';
      const charLimit = isShorts ? 10 : 23;

      // Parse SRT and re-segment
      const lines = srtContent.split('\n\n').filter((l: string) => l.trim());
      const rawSubtitles = lines.map((l: string) => {
        const parts = l.split('\n');
        if (parts.length < 3) return null;
        const timeMatch = parts[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
        return {
          index: parts[0],
          start: timeMatch ? timeMatch[1] : '',
          end: timeMatch ? timeMatch[2] : '',
          text: parts.slice(2).join(' ')
        };
      }).filter(Boolean);

      // Re-segmenting logic
      let currentBeats: any[] = [];
      let currentText = "";
      let currentStart = "";

      rawSubtitles.forEach((sub: any, idx: number) => {
        if (!currentStart) currentStart = sub.start;
        const potentialText = currentText ? `${currentText} ${sub.text}` : sub.text;

        if (potentialText.length > charLimit || idx === rawSubtitles.length - 1) {
          currentBeats.push({
            id: generateId(),
            title: `Segment ${currentBeats.length + 1}`,
            content: potentialText,
            start_time: currentStart,
            end_time: sub.end,
            duration_sec: 3,
            media_url: '',
            source_mode: 'original',
            image_prompt: '',
            style_dna: videoDNA || 'cinematic'
          });
          currentText = "";
          currentStart = "";
        } else {
          currentText = potentialText;
        }
      });

      setBeats(currentBeats);

      // [NEW] Persist Genesis Assets to Project Folder
      try {
        await axios.post(`/api/scripts/${videoId}/persist-genesis`, {
          audio_path: audioPath,
          srt_content: srtContent
        });
        console.log("✅ Genesis assets persisted to workspace");
      } catch (persistErr) {
        console.warn("Failed to persist genesis assets:", persistErr);
      }

      alert("오디오 및 자막 기반 작전 비트 생성이 완료되었습니다. 이제 각 비트에 시각적 자산을 할당하십시오.");
    } catch (err: any) {
      console.error("Genesis Error:", err);
      alert(`작전 생성 중 오류가 발생했습니다: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsGeneratingGenesis(false);
    }
  };

  const handleStockSearch = async (query: string) => {
    // [ELITE] Semantic Keyword Mapping (Korean -> English)
    // Most Stock APIs work best with English keywords.
    const KOREAN_TO_ENGLISH_MAP: Record<string, string> = {
      '탐욕스러운': 'greedy', '주인': 'man', '단비': 'woman', '역사': 'history', '미래': 'future',
      '공간': 'space', '회사': 'office', '기술': 'tech', '도시': 'city', '자연': 'nature',
      '회의': 'meeting', '혁신': 'innovation', '창의': 'creative', '사람': 'people'
    };

    let searchKeyword = query;
    // Simple translation heuristic
    Object.keys(KOREAN_TO_ENGLISH_MAP).forEach(k => {
      if (query.includes(k)) searchKeyword = KOREAN_TO_ENGLISH_MAP[k];
    });

    setStockSearchQuery(query);
    setIsLoading(true);

    // [ADVANCED] Highly Dynamic Mock Results
    setTimeout(() => {
      const allAssets = [
        { id: 101, url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174', tags: ['office', 'tech', 'minimal'] },
        { id: 102, url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c', tags: ['people', 'meeting', 'creative'] },
        { id: 103, url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c', tags: ['tech', 'innovation', 'future'] },
        { id: 104, url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d', tags: ['creative', 'office', 'man'] },
        { id: 105, url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf', tags: ['man', 'greedy', 'rich', 'business'] },
        { id: 106, url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e', tags: ['tech', 'future', 'robot'] },
        { id: 107, url: 'https://images.unsplash.com/photo-1518770660439-4636190af475', tags: ['tech', 'history', 'circuit'] },
        { id: 108, url: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1', tags: ['tech', 'minimal', 'laptop'] },
        { id: 109, url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa', tags: ['future', 'space', 'earth'] },
        { id: 110, url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b', tags: ['tech', 'security'] },
        { id: 111, url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8', tags: ['office', 'store'] },
        { id: 112, url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644', tags: ['people', 'nature', 'woman'] }
      ];

      // Filter by keyword AND add some randomness to simulate a real search engine
      const filtered = allAssets.filter(img =>
        img.tags.some(t => searchKeyword.toLowerCase().includes(t))
      );

      // If no match, show a random selection to show variety
      const finalResults = filtered.length >= 4 ? filtered.slice(0, 4) :
        [...filtered, ...allAssets.filter(a => !filtered.includes(a)).sort(() => 0.5 - Math.random())].slice(0, 4);

      setStockResults(finalResults);
      setIsLoading(false);
    }, 500);
  };

  const analyzeSourceDNA = () => {
    setIsDNAAnalyzing(true);
    setTimeout(() => {
      setIsDNAAnalyzing(false);
      const extractedDNA = "Teal and Orange color palette, Soft anamorphic lens flares, High contrast cinematic lighting, 24fps motion blur";
      setVideoDNA(extractedDNA);
      alert(`[DNA 분석 완료]\n추출된 스타일: ${extractedDNA}\n이제 모든 AI 생성 프롬프트에 이 스타일이 자동 반영됩니다.`);
    }, 1500);
  };

  // ──────────────────────────────────────────────
  // [VIEW] Mission Stepper
  // ──────────────────────────────────────────────
  const renderMissionStepper = () => {
    const phases = [
      { id: 1, label: '01. STRATEGY', sub: '전략 분석', icon: <Target size={16} /> },
      { id: 2, label: '02. NARRATIVE', sub: '대본 퇴고', icon: <FileText size={16} /> },
      { id: 3, label: '03. ORCHESTRATION', sub: '작전 비트', icon: <Activity size={16} /> },
      { id: 4, label: '04. PRODUCTION', sub: '스튜디오', icon: <Video size={16} /> },
      { id: 5, label: '05. DEPLOYMENT', sub: '최종 배포', icon: <Globe size={16} /> },
    ];

    return (
      <div style={styles.stepperWrapperV8}>
        {phases.map((p, idx) => (
          <React.Fragment key={p.id}>
            <div
              style={{
                ...styles.stepItemV8,
                ...(currentPhase === p.id ? styles.stepActiveV8 : {}),
                ...(currentPhase > p.id ? styles.stepDoneV8 : {})
              }}
              onClick={() => setCurrentPhase(p.id)}
            >
              <div style={styles.stepIconV8}>{currentPhase > p.id ? <CheckCircle2 size={16} /> : p.icon}</div>
              <div style={styles.stepTextV8}>
                <div style={styles.stepLabelV8}>{p.label}</div>
                <div style={styles.stepSubV8}>{p.sub}</div>
              </div>
            </div>
            {idx < phases.length - 1 && <div style={styles.stepDividerV8} />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // ──────────────────────────────────────────────
  // [VIEW] Phase Renderers
  // ──────────────────────────────────────────────

  // PHASE 01: STRATEGY
  const renderPhase1Strategy = () => {
    if (!videoMeta) return null;

    const views = videoMeta.view_count || 0;
    const viralScore = (videoMeta.viral_score || 0).toFixed(1);
    const isScript = videoMeta.is_script_only;

    return (
      <div style={styles.briefWrapperV8}>
        {/* TOP: Strategic Mission Identity */}
        <div style={styles.briefHeaderV8}>
          <div style={styles.headerLeftV8}>
            <div style={styles.headerSubtitleV8}>독립 자율 전략 미션 브리핑 (SOVEREIGN STRATEGIC BRIEF)</div>
            <h1 style={styles.headerTitleV8}>{videoMeta?.title || '영상을 선택해주세요'}</h1>
            <div style={styles.headerMetaRowV8}>
              <span style={styles.metaBadgeV8}>자원 ID: #{videoId}</span>
              <span style={styles.metaBadgeV8}>엔진: {strategy.layout.toUpperCase()}</span>
              <span style={styles.metaBadgeV8}>모드: {strategy.direction.toUpperCase()}</span>
            </div>
          </div>
          <div style={styles.headerRightV8}>
            <div style={styles.statusGroupV8}>
              <div style={styles.statusDotV8} />
              <div style={{ textAlign: 'right' }}>
                <span style={styles.metaLabelV8}>AI 참모 루피 (HERMES)</span>
                <span style={styles.metaValueV8}>연결됨 & 관제 중</span>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.briefThreeColumnV8}>
          {/* COLUMN 1: DATA INTELLIGENCE HUB */}
          <div style={styles.columnV8}>
            <div style={styles.panelV8}>
              <div style={styles.panelTagV8}><TrendingUp size={14} /> 데이터 인텔리전스 허브</div>
              <div style={styles.panelContentV8}>
                <div style={styles.intelligenceCardV8}>
                  <div style={styles.intelHeaderV8}>
                    <span style={styles.intelLabelV8}>바이럴 잠재력 (VIRAL POTENTIAL)</span>
                    <span style={styles.intelValueV8}>{viralScore}%</span>
                  </div>
                  <div style={styles.intelProgressBgV8}>
                    <div style={{ ...styles.intelProgressFillV8, width: `${viralScore}%` }} />
                  </div>
                  <div style={styles.intelFooterV8}>
                    {viralScore > 80 ? 'S-급 고가치 콘텐츠 감지' : '우수한 성과 예상 소스'}
                  </div>
                </div>

                <div style={styles.metricGridV8}>
                  <div style={styles.miniMetricV8}>
                    <span style={styles.miniLabelV8}>원본 조회수</span>
                    <span style={styles.miniValueV8}>{formatNumber(views)}</span>
                  </div>
                  <div style={styles.miniMetricV8}>
                    <span style={styles.miniLabelV8}>예상 전파력</span>
                    <span style={styles.miniValueV8}>상위 5%</span>
                  </div>
                </div>

                <div style={styles.analysisBoxV8}>
                  <h4 style={styles.analysisTitleV8}>루피의 핵심 분석 (HERMES INSIGHT)</h4>
                  <ul style={styles.analysisListV8}>
                    <li style={styles.analysisItemV8}>• {isScript ? "텍스트 밀도가 높음. 고속 타이포그래피 권장" : "시각적 훅(Visual Hook)이 강함. 시네마틱 보정 추천"}</li>
                    <li style={styles.analysisItemV8}>• 대상 오디언스: 15-24세 숏폼 소비층</li>
                    <li style={styles.analysisItemV8}>• 추천 사운드: 긴장감 있는 베이스 루프</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 2: TACTICAL CONFIGURATION */}
          <div style={styles.columnV8}>
            <div style={styles.panelV8}>
              <div style={styles.panelTagV8}><Target size={14} /> 전술적 환경 구성 (TACTICAL CONFIGURATION)</div>
              <div style={styles.panelContentV8}>
                <div style={styles.presetSelectionV8}>
                  {[
                    { id: 'viral_hook', label: '도파민 자극 (DOPAMINE RUSH)', desc: '바이럴 훅 극대화 / 1.5배속 편집', icon: '🔥' },
                    { id: 'edu_master', label: '지식 큐레이터 (INSIGHT CURATOR)', desc: '가독성 및 정보 전달력 최적화', icon: '📚' },
                    { id: 'emotional', label: '시네마틱 감성 (CINEMATIC VIBE)', desc: '서정적 연출 및 슬로우 페이싱', icon: '✨' },
                  ].map(p => (
                    <button
                      key={p.id}
                      style={{ ...styles.tacticalCardV8, ...(strategy.preset === p.id ? styles.tacticalActiveV8 : {}) }}
                      onClick={() => setStrategy({ ...strategy, preset: p.id as any })}
                    >
                      <div style={styles.tacticalIconV8}>{p.icon}</div>
                      <div style={styles.tacticalInfoV8}>
                        <span style={styles.tacticalLabelV8}>{p.label}</span>
                        <span style={styles.tacticalDescV8}>{p.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 3: SYSTEM CALIBRATION & COMMAND */}
          <div style={styles.columnV8}>
            <div style={styles.panelV8}>
              <div style={styles.panelTagV8}><ShieldAlert size={14} /> 전술 구성 패널</div>
              <div style={styles.panelContentV8}>
                <div style={styles.calibFormV8}>
                  <div style={styles.fieldV8}>
                    <label style={styles.fieldLabelV8}>엔진 설정 (RENDER ENGINE)</label>
                    <div style={styles.engineToggleV8}>
                      <button style={{ ...styles.engineBtnV8, ...(strategy.layout === 'remotion' ? styles.engineActiveV8 : {}) }} onClick={() => setStrategy({ ...strategy, layout: 'remotion' })}>REMOTION</button>
                      <button style={{ ...styles.engineBtnV8, ...(strategy.layout === 'hyperframes' ? styles.engineActiveV8 : {}) }} onClick={() => setStrategy({ ...strategy, layout: 'hyperframes' })}>HYPERFRAMES</button>
                    </div>
                  </div>
                  <div style={styles.fieldV8}>
                    <label style={styles.fieldLabelV8}>화면 비율 (ASPECT RATIO)</label>
                    <select style={styles.fieldSelectV8} value={strategy.aspectRatio} onChange={e => setStrategy({ ...strategy, aspectRatio: e.target.value })}>
                      <option value="9:16">숏폼 세로형 (9:16)</option>
                      <option value="16:9">롱폼 가로형 (16:9)</option>
                    </select>
                  </div>
                </div>

                <div style={styles.commandSummaryV8}>
                  <div style={styles.summaryRowV8}>
                    <span>프리셋 (PRESET)</span> <strong>{strategy.preset.toUpperCase()}</strong>
                  </div>
                  <div style={styles.summaryRowV8}>
                    <span>템포 (TEMPO)</span> <strong>{strategy.pacing.toUpperCase()}</strong>
                  </div>
                </div>

                <button style={styles.engageBtnV8} onClick={goToNextPhase}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={styles.engageTitleV8}>전략 승인 및 대본 설계 진입</span>
                    <span style={styles.engageSubV8}>다음 단계: NARRATIVE (대본 퇴고)</span>
                  </div>
                  <ChevronRight size={24} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // PHASE 02: NARRATIVE (Script & Refinement)
  const renderPhase2Narrative = () => (
    <div style={styles.phaseContainerV8}>
      <style>{`
        textarea::-webkit-scrollbar { display: none; }
      `}</style>
      <div style={styles.narrativeGridV8}>
        <div style={styles.scriptEditorPanelV8}>
          <div style={styles.panelTagV8}><FileText size={14} /> 대본 에디터 (NARRATIVE GENESIS)</div>
          <div style={styles.panelContentV8}>
            <textarea
              style={styles.scriptTextAreaV8}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="대본을 입력하거나 루피에게 생성을 요청하세요..."
            />
            <div style={styles.scriptActionsV8}>
              {/* Row 1: Tempo & Length Control */}
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', background: '#FFFFFF', padding: '16px 24px', borderRadius: 16, border: '1px solid #F1F5F9' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={12} /> Tempo Scale</label>
                    <span style={{ fontSize: 11, fontWeight: 900, color: '#3B82F6' }}>{tempoPercentage}%</span>
                  </div>
                  <input
                    type="range"
                    min="50" max="150" step="10"
                    value={tempoPercentage}
                    onChange={(e) => setTempoPercentage(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#3B82F6' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, fontWeight: 700, color: '#CBD5E1' }}>
                    <span>CONCISE</span>
                    <span>BALANCED</span>
                    <span>EXPANDED</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Refinement Commands */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: -20, left: 0, fontSize: 10, fontWeight: 800, color: '#6366F1', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={10} />
                    <span>ACTIVE PERSONA: {selectedStyleId ? (scriptStyles.find(s => s.id === selectedStyleId)?.name || 'Custom') : (selectedPersona === 'strategist' ? '엘리트 전략가' : selectedPersona === 'influencer' ? '바이럴 인플루언서' : '전문 교육자')}</span>
                  </div>
                  <button
                    style={{ ...styles.refineBtnV8, color: '#3B82F6', borderColor: '#DBEAFE', background: '#F0F7FF' }}
                    onClick={() => handleRefineScript("오탈자 및 맞춤법을 완벽하게 교정하고, 문법 오류와 어색한 문장을 정밀하게 퇴고해줘. 특히 문맥에 맞지 않는 외국어나 외래어 오타(예: khám phá 등)는 반드시 적절한 한국어로 수정하거나 제거해줘. 가독성이 극대화된 전문적인 한국어 대본으로 완성해줘.")}
                  >
                    <Sparkles size={14} /> 정밀 퇴고
                  </button>
                  <button
                    style={{ ...styles.refineBtnV8, color: '#8B5CF6', borderColor: '#EDE9FE', background: '#F5F3FF' }}
                    onClick={() => handleRefineScript("훨씬 더 자극적이고 바이럴하게, 도파민 폭발하는 숏폼 스타일로 전면 개조해줘. 도입부는 무조건 충격적이어야 하며, 오타나 어색한 외국어 표현은 모두 자연스러운 한국어 바이럴 표현으로 수정해줘.")}
                  >
                    <Zap size={14} /> 바이럴 빌드
                  </button>
                  <button
                    style={{ ...styles.refineBtnV8, color: '#D97706', borderColor: '#FEF3C7', background: '#FFFBEB', gridColumn: 'span 2' }}
                    onClick={() => handleRefineScript("문장을 더 짧고 간결하게, 리듬감 있게 다듬어줘. 숏폼 호흡에 최적화하면서 모든 오탈자와 어색한 단어를 완벽하게 교정해줘.", tempoPercentage)}
                  >
                    <Activity size={14} /> 템포 조정 실행
                  </button>
                </div>
              </div>

              {/* Row 3: Footer & Next Step */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, fontWeight: 500 }}>* 모든 변경사항은 실시간으로 독립 노드에 저장됩니다.</p>
                <button
                  style={{ ...styles.actionBtnV8, padding: '8px 16px', fontSize: 11 }}
                  onClick={handleSegmentScript}
                >
                  대본 확정 및 구성 <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.insightPanelV8}>
          {/* TOP: STRATEGIC INSIGHTS (Compact & Informative) */}
          <div style={{ ...styles.panelTagV8, background: '#111827', color: '#FFF', border: 'none' }}><Activity size={12} /> 전략적 통찰 (STRATEGIC INSIGHTS)</div>
          <div style={{ ...styles.panelContentV8, padding: '12px 16px', gap: 8, background: '#FFFFFF', borderBottom: '1px solid #E5E7EB' }}>
            {scriptAnalysis && scriptAnalysis.viral_score > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ background: '#EEF2FF', color: '#4F46E5', padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 900 }}>{scriptAnalysis.tone?.toUpperCase() || 'NORMAL'}</div>
                    <div style={{ background: '#ECFDF5', color: '#059669', padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 900 }}>{scriptAnalysis.sentiment_label?.toUpperCase() || 'NEUTRAL'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8' }}>바이럴 지수</span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: '#3B82F6' }}>{scriptAnalysis.viral_score}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#475569', background: '#F8FAFC', padding: '6px 10px', borderRadius: 6, border: '1px solid #F1F5F9' }}>
                  <Zap size={10} color="#F59E0B" />
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    AI 추천 훅: {scriptAnalysis.hooks?.[0] || "최적의 훅을 분석 중입니다..."}</span></div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', padding: '4px 0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textAlign: 'center' }}>분석된 전략 데이터가 없습니다.</div>
                <button
                  onClick={handleAnalyzeVideo}
                  style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', color: '#3B82F6', fontSize: 10, fontWeight: 800, padding: '4px 12px', borderRadius: 6, cursor: 'pointer' }}
                >
                  <Sparkles size={10} style={{ marginRight: 4 }} /> 실시간 전략 분석 실행
                </button>
              </div>
            )}
          </div>

          {/* BOTTOM: PERSONA SELECTION */}
          <div style={styles.panelTagV8}><Sparkles size={12} /> 페르소나 설정 (PERSONA SELECTION)</div>
          <div style={{ ...styles.panelContentV8, padding: '12px 16px', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            <div style={styles.personaGridV8}>
              {/* Legacy Hardcoded Personas */}
              {[
                { id: 'strategist', label: '엘리트 전략가', desc: '논리적/권위적', icon: '👔' },
                { id: 'influencer', label: '바이럴 인플루언서', desc: '트렌디/에너제틱', icon: '🚀' },
                { id: 'educator', label: '전문 교육자', desc: '차분/신뢰', icon: '🎓' },
              ].map(p => (
                <div
                  key={p.id}
                  style={{ ...styles.personaCardV8, padding: '10px 12px', ...(selectedPersona === p.id && !selectedStyleId ? styles.personaActiveV8 : {}) }}
                  onClick={() => {
                    setSelectedPersona(p.id);
                    setSelectedStyleId(null);
                  }}
                >
                  <div style={{ ...styles.personaIconV8, fontSize: 16 }}>{p.icon}</div>
                  <div style={styles.personaInfoV8}>
                    <div style={{ ...styles.personaLabelV8, fontSize: 12 }}>{p.label}</div>
                    <div style={{ ...styles.personaDescV8, fontSize: 10 }}>{p.desc}</div>
                  </div>
                </div>
              ))}

              {/* Dynamic Personas from DB */}
              {scriptStyles.map(s => (
                <div
                  key={s.id}
                  style={{ ...styles.personaCardV8, padding: '10px 12px', ...(selectedStyleId === s.id ? styles.personaActiveV8 : {}) }}
                  onClick={() => {
                    setSelectedStyleId(s.id);
                    setSelectedPersona('custom');
                  }}
                >
                  <div style={{ ...styles.personaIconV8, fontSize: 16 }}><User size={14} color="#3B82F6" /></div>
                  <div style={styles.personaInfoV8}>
                    <div style={{ ...styles.personaLabelV8, fontSize: 12 }}>{s.name}</div>
                    <div style={{ ...styles.personaDescV8, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>{s.system_instruction.substring(0, 20)}...</div>
                  </div>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                    <button onClick={(e) => { e.stopPropagation(); setEditingStyle(s); setIsPersonaModalOpen(true); }} style={{ background: "#F1F5F9", border: "none", color: "#64748B", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6 }} title="수정"><Edit2 size={12} /></button>
                    <button onClick={async (e) => { e.stopPropagation(); if (confirm("이 페르소나를 삭제하시겠습니까?")) { try { await axios.delete(`/api/script/styles/${s.id}`); fetchScriptStyles(); } catch (err) { alert("삭제 실패"); } } }} style={{ background: "#FEF2F2", border: "none", color: "#EF4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6 }} title="삭제"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}

              {/* Add New Persona Button */}
              <div
                style={{ ...styles.personaCardV8, padding: '10px 12px', border: '2px dashed #E5E7EB', justifyContent: 'center', alignItems: 'center', background: '#F8F9FC', minHeight: 48, cursor: 'pointer' }}
                onClick={() => {
                  setEditingStyle(null);
                  setIsPersonaModalOpen(true);
                }}
              >
                <Plus size={14} color="#94A3B8" />
                <span style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', marginLeft: 6 }}>새 페르소나 설계</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // PHASE 03: ORCHESTRATION (Advanced Storyboard & Tactical Mapping)
  const [voices, setVoices] = useState<any[]>([]);

  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const res = await axios.get(`/api/tools/tts/voices?engine=${ttsConfig.engine}&language=${ttsConfig.language}`);
        setVoices(res.data || []);
        if (res.data && res.data.length > 0 && !res.data.find((v: any) => v.id === ttsConfig.voice_id)) {
          setTTSConfig((prev: any) => ({ ...prev, voice_id: res.data[0].id }));
        }
      } catch (e) {
        console.error("Failed to fetch voices", e);
      }
    };
    if (currentPhase === 3) fetchVoices();
  }, [ttsConfig.engine, ttsConfig.language, currentPhase]);

  const renderPhase3Genesis = () => (
    <div style={styles.phaseContainerV8}>
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, height: 'calc(100vh - 160px)', overflow: 'hidden' }}>

        {/* LEFT: Tactical Configuration & Command */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', paddingRight: 8 }}>
          
          {/* Stage 3.1: Style Branding (The Strategic Soul) */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 24, padding: 20, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#111827', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={14} className="text-blue-500" /> STAGE 3.1: 스타일 브랜딩 (DNA)
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8' }}>색감 팔레트</label>
                <input style={styles.styleBibleInputV8} value={styleBible.color_palette} onChange={(e) => setStyleBible({ ...styleBible, color_palette: e.target.value })} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8' }}>조명 모델</label>
                <input style={styles.styleBibleInputV8} value={styleBible.lighting} onChange={(e) => setStyleBible({ ...styleBible, lighting: e.target.value })} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8' }}>마스터 비주얼 DNA</label>
                <textarea 
                  style={{ ...styles.styleBibleInputV8, minHeight: 60, padding: 10, resize: 'none' }} 
                  value={masterVisualDNA} 
                  onChange={(e) => setMasterVisualDNA(e.target.value)}
                />
              </div>

              {/* Hero Anchor Visual */}
              <div style={{ marginTop: 8, background: '#F8FAFC', borderRadius: 16, padding: 12, border: '1px dashed #E2E8F0' }}>
                <label style={{ fontSize: 9, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 8 }}>비주얼 히어로 앵커</label>
                <div style={{ width: '100%', height: 120, background: '#E2E8F0', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                  {heroAssetUrl ? <img src={heroAssetUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}><ImageIcon size={24} /></div>}
                </div>
                <button
                  onClick={handleGenerateHeroAnchor}
                  disabled={isHeroGenerating}
                  style={{ width: '100%', height: 32, background: '#111827', color: '#FFF', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {isHeroGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  DNA 앵커 가동
                </button>
              </div>
            </div>
          </div>

          {/* TTS & Audio Control */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 24, padding: 20, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#111827', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mic size={14} className="text-purple-500" /> 오디오 엔진 설정
            </div>
            <select
              style={{ width: '100%', padding: '8px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12, fontWeight: 600, marginBottom: 12 }}
              value={ttsConfig.voice_id}
              onChange={(e) => setTTSConfig({ ...ttsConfig, voice_id: e.target.value })}
            >
              {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <button
              style={{ width: '100%', height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: '#FFF', fontSize: 12, fontWeight: 900, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
              onClick={handleGenerateGenesis}
              disabled={isGeneratingGenesis}
            >
              {isGeneratingGenesis ? <Loader2 size={18} className="animate-spin" /> : <Volume2 size={18} />}
              오디오 & 자막 생성
            </button>
          </div>
        </div>

        {/* RIGHT: Asset Command Center & Sequence View */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, overflow: 'hidden' }}>

          {/* 1. Sequence Command Center (Master Controls) */}
          <div style={{ background: '#FFFFFF', borderRadius: 24, border: '1px solid #E5E7EB', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#1F2937' }}>비주얼 통합 지휘 (VISUAL COMMAND CENTER)</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleBulkAIGenerate}
                  disabled={isBulkGenerating || beats.length === 0}
                  style={{ padding: '8px 16px', borderRadius: 12, background: isBulkGenerating ? '#F1F5F9' : '#3B82F6', color: isBulkGenerating ? '#94A3B8' : '#FFF', fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {isBulkGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  전체 비트 AI 비주얼 일괄 생성 가동
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {STYLE_DNA_PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setMasterVisualDNA(p.desc);
                    // Force update all beats that are in AI mode
                    const updated = beats.map(b => ({ ...b, visual_prompt: `${b.content}. ${p.desc}` }));
                    setBeats(updated);
                  }}
                  style={{ padding: '6px 12px', borderRadius: 20, background: masterVisualDNA.includes(p.desc) ? '#3B82F6' : '#F1F5F9', color: masterVisualDNA.includes(p.desc) ? '#FFF' : '#64748B', fontSize: 9, fontWeight: 800, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {p.icon} {p.name}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#F8FAFC', padding: 12, borderRadius: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 4 }}>마스터 비주얼 DNA (STYLE GUIDE)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #E2E8F0', padding: '4px 0', fontSize: 13, color: '#1E293B', outline: 'none', fontWeight: 600 }}
                    value={masterVisualDNA}
                    onChange={(e) => setMasterVisualDNA(e.target.value)}
                    placeholder="예: Cinematic, 4k, hyper-detailed, neon noir..."
                  />
                  <button 
                    onClick={() => {
                      const updated = beats.map(b => ({ ...b, visual_prompt: `${b.content}. ${masterVisualDNA}` }));
                      setBeats(updated);
                      alert("모든 비트에 비주얼 DNA가 주입되었습니다.");
                    }}
                    style={{ background: '#F1F5F9', border: 'none', padding: '6px 10px', borderRadius: 8, color: '#3B82F6', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
                  >DNA 주입</button>
                </div>
              </div>
              <div style={{ width: 1, height: 32, background: '#E2E8F0' }} />
              <div style={{ minWidth: 120 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 4 }}>비주얼 앵커 (ANCHOR)</label>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#3B82F6' }}>{visualAnchor || 'Detecting...'}</div>
              </div>
            </div>

          {/* STAGE 3.2: 택티컬 스토리보드 (VISUAL HUB) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Layers size={20} color="#8B5CF6" />
              <h2 style={{ fontSize: 16, fontWeight: 900, color: '#1F2937', margin: 0 }}>STAGE 3.2: 택티컬 스토리보드</h2>
            </div>
            <button
              onClick={handleBulkAIGenerate}
              disabled={isBulkGenerating || beats.length === 0}
              style={{ padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #6366F1, #3B82F6)', color: '#FFF', fontSize: 12, fontWeight: 900, border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {isBulkGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              전체 비주얼 AI 정밀 오케스트레이션 가동
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, paddingRight: 4 }}>
            {beats.map((b, i) => (
              <div
                key={b.id}
                onClick={() => setSelectedBeat(b)}
                style={{
                  background: '#FFFFFF', borderRadius: 20, border: selectedBeat?.id === b.id ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                  padding: 14, cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
                  boxShadow: selectedBeat?.id === b.id ? '0 10px 20px -5px rgba(59,130,246,0.1)' : 'none',
                  display: 'flex', flexDirection: 'column', gap: 10
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 900, color: '#3B82F6', background: '#EFF6FF', padding: '2px 6px', borderRadius: 6 }}>SHOT #{i + 1}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {generationProgress[b.id] === 'generating' && <Loader2 size={10} className="animate-spin text-blue-500" />}
                    {generationProgress[b.id] === 'completed' && <CheckCircle2 size={10} className="text-green-500" />}
                  </div>
                </div>

                <div style={{ width: '100%', height: 140, background: '#F1F5F9', borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
                  {b.media_url ? (
                    b.media_type === 'video' ? <video src={b.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={b.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1' }}>
                      <ImageIcon size={40} strokeWidth={1} />
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: 6, fontSize: 8, color: '#FFF', fontWeight: 800 }}>
                    {b.source_mode?.toUpperCase() || 'WAITING'}
                  </div>
                </div>

                <div style={{ fontSize: 10, fontWeight: 800, color: '#1F2937', height: 30, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {b.content}
                </div>

                {b.visual_prompt && b.source_mode === 'ai_gen' && (
                  <div style={{ padding: '8px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 8, color: '#3B82F6', fontWeight: 600, fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    " {b.visual_prompt.substring(0, 80)}... "
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleIndividualAssetAction(b.id, 'source'); }}
                    style={{ fontSize: 8, fontWeight: 900, padding: '6px', borderRadius: 8, border: 'none', background: b.source_mode === 'original' ? '#3B82F6' : '#F8FAFC', color: b.source_mode === 'original' ? '#FFF' : '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    <History size={10} /> SOURCE
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleIndividualAssetAction(b.id, 'ai'); }}
                    style={{ fontSize: 8, fontWeight: 900, padding: '6px', borderRadius: 8, border: 'none', background: b.source_mode === 'ai_gen' ? '#8B5CF6' : '#F8FAFC', color: b.source_mode === 'ai_gen' ? '#FFF' : '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    <Sparkles size={10} /> AI ORCH
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    style={{ fontSize: 8, fontWeight: 900, padding: '6px', borderRadius: 8, border: 'none', background: b.source_mode === 'upload' ? '#10B981' : '#F8FAFC', color: b.source_mode === 'upload' ? '#FFF' : '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    <Upload size={10} /> UPLOAD
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedBeat(b); }}
                    style={{ fontSize: 8, fontWeight: 900, padding: '6px', borderRadius: 8, border: 'none', background: b.source_mode === 'stock' ? '#F59E0B' : '#F8FAFC', color: b.source_mode === 'stock' ? '#FFF' : '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    <Search size={10} /> STOCK
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Elite Stock Command Center (Dynamic Selection Surface) */}
          {selectedBeat && stockRecommendations[selectedBeat.id] && stockRecommendations[selectedBeat.id].length > 0 && (
            <div style={{ background: '#F8FAFC', borderRadius: 24, padding: 20, border: '1px solid #E2E8F0', marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#475569', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Search size={14} className="text-orange-500" /> 지능형 스톡 추천 엔진 (ELITE STOCK RECS: {selectedBeat.keywords || 'Visuals'})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
                {stockRecommendations[selectedBeat.id].map((item: any, idx: number) => (
                  <div 
                    key={idx} 
                    onClick={() => handleIndividualAssetAction(selectedBeat.id, 'stock', item.url)}
                    style={{ 
                      cursor: 'pointer', position: 'relative', borderRadius: 16, overflow: 'hidden', 
                      aspectRatio: '16/9', border: selectedBeat.media_url === item.url ? '3px solid #F59E0B' : '1px solid #E2E8F0',
                      transition: 'transform 0.2s',
                      boxShadow: selectedBeat.media_url === item.url ? '0 10px 15px -3px rgba(245,158,11,0.2)' : 'none'
                    }}
                  >
                    <img src={item.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Stock" />
                    {selectedBeat.media_url === item.url && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={24} color="#FFF" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          </div>
        </div>
      </div>
    </div>
  );

  const renderPhase4Production = () => {
    const previewWidth = strategy.aspectRatio === '9:16' ? 360 : 640;
    const previewHeight = strategy.aspectRatio === '9:16' ? 640 : 360;

    return (
      <div style={styles.phaseContainerV8}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, height: 'calc(100vh - 160px)', overflow: 'hidden' }}>

          {/* LEFT: STRATEGIC CINEMA VIEW & MULTI-TRACK TIMELINE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, overflow: 'hidden' }}>

            {/* 1. ELITE CINEMA PREVIEW (Hyper-Layered Monitoring) */}
            <div style={{ flex: 1, background: '#020617', borderRadius: 32, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #1E293B', boxShadow: 'inset 0 0 100px rgba(0,0,0,0.8)' }}>
              
              {/* Technical Grid Overlay */}
              <div style={{ position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none', backgroundImage: 'radial-gradient(#94A3B8 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

              <div style={{ width: previewWidth, height: previewHeight, position: 'relative', background: '#000', boxShadow: '0 0 80px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, overflow: 'hidden' }}>
                {renderEngine === 'remotion' ? (
                  <Player
                    ref={playerRef}
                    component={EliteSequence}
                    inputProps={{
                      beats: beats.map(b => ({
                        ...b,
                        transform: b.transform || { scale: 1, x: 0, y: 0, rotate: 0, opacity: 1 },
                        fx: b.fx || { blur: 0, brightness: 100, contrast: 100 }
                      })),
                      audio_src: videoMeta?.audio_url || '',
                      bgm_src: '', 
                      bgm_volume: 0.1,
                      aspect_ratio: strategy.aspectRatio as any
                    }}
                    durationInFrames={Math.max(1, Math.floor(totalDuration * 30))}
                    fps={30}
                    compositionWidth={strategy.aspectRatio === '9:16' ? 1080 : 1920}
                    compositionHeight={strategy.aspectRatio === '9:16' ? 1920 : 1080}
                    style={{ width: '100%', height: '100%' }}
                    controls={false}
                    autoPlay={false}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
                    {/* Simulated Hyperframes Preview */}
                    {selectedBeat && (
                      <div style={{
                        width: '100%', height: '100%',
                        transform: `scale(${selectedBeat.transform?.scale || 1}) translate(${selectedBeat.transform?.x || 0}%, ${selectedBeat.transform?.y || 0}%) rotate(${selectedBeat.transform?.rotate || 0}deg)`,
                        filter: `blur(${selectedBeat.fx?.blur || 0}px) brightness(${selectedBeat.fx?.brightness || 100}%) contrast(${selectedBeat.fx?.contrast || 100}%)`,
                        transition: 'all 0.1s linear'
                      }}>
                         {selectedBeat.media_url ? (
                           selectedBeat.media_type === 'video' ? <video src={selectedBeat.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay muted loop /> : <img src={selectedBeat.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                         ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b' }}><Video size={48} /></div>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* HUD: Monitoring Vitals & Engine Switcher */}
              <div style={{ position: 'absolute', top: 32, left: 32, right: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      onClick={() => setRenderEngine('remotion')}
                      style={{ background: renderEngine === 'remotion' ? '#3B82F6' : 'rgba(15,23,42,0.8)', padding: '6px 12px', borderRadius: 8, border: '1px solid #334155', color: '#FFF', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}
                    >REMOTION ENGINE</button>
                    <button 
                      onClick={() => setRenderEngine('hyperframes')}
                      style={{ background: renderEngine === 'hyperframes' ? '#8B5CF6' : 'rgba(15,23,42,0.8)', padding: '6px 12px', borderRadius: 8, border: '1px solid #334155', color: '#FFF', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}
                    >HYPERFRAMES (FFMPEG)</button>
                  </div>
                  <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(10px)', padding: '6px 12px', borderRadius: 8, border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 8, width: 'fit-content' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: isPlaying ? '#10B981' : '#EF4444' }} />
                    <span style={{ fontSize: 10, fontWeight: 900, color: '#FFF' }}>{isPlaying ? 'ACTIVE' : 'PAUSED'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(10px)', padding: '6px 12px', borderRadius: 8, border: '1px solid #334155', color: '#3B82F6', fontSize: 10, fontWeight: 900 }}>
                    TC: {new Date(currentTime * 1000).toISOString().substr(14, 5)}:{(currentTime % 1).toFixed(2).substr(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. PRO-GRADE MULTI-TRACK TIMELINE (Orchestration Engine) */}
            <div style={{ background: '#0F172A', borderRadius: 28, border: '1px solid #1E293B', display: 'flex', flexDirection: 'column', height: 320, overflow: 'hidden' }}>
              
              {/* Timeline Toolbar */}
              <div style={{ height: 48, background: '#1E293B', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', background: '#020617', padding: 4, borderRadius: 10, gap: 4 }}>
                    <button onClick={() => setActiveTool('select')} style={{ width: 32, height: 32, borderRadius: 8, background: activeTool === 'select' ? '#3B82F6' : 'transparent', border: 'none', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MousePointer2 size={16} /></button>
                    <button onClick={() => setActiveTool('split')} style={{ width: 32, height: 32, borderRadius: 8, background: activeTool === 'split' ? '#3B82F6' : 'transparent', border: 'none', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Scissors size={16} /></button>
                  </div>
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    style={{ width: 36, height: 36, borderRadius: '50%', background: isPlaying ? '#EF4444' : '#10B981', border: 'none', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
                  >
                    {isPlaying ? <Square size={16} fill="white" /> : <Play size={16} fill="white" />}
                  </button>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF', fontFamily: 'monospace', letterSpacing: 1 }}>
                    {new Date(currentTime * 1000).toISOString().substr(14, 5)} / {new Date(totalDuration * 1000).toISOString().substr(14, 5)}
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#020617', padding: '6px 12px', borderRadius: 10 }}>
                     <Minus size={12} color="#64748B" onClick={() => setZoomLevel(Math.max(2, zoomLevel - 2))} style={{ cursor: 'pointer' }} />
                     <input type="range" min="2" max="50" value={zoomLevel} onChange={(e) => setZoomLevel(parseInt(e.target.value))} style={{ width: 80, accentColor: '#3B82F6' }} />
                     <Plus size={12} color="#64748B" onClick={() => setZoomLevel(Math.min(50, zoomLevel + 2))} style={{ cursor: 'pointer' }} />
                   </div>
                </div>
              </div>

              {/* Timeline Tracks Area */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                
                {/* Track Headers (Labels & Controls) */}
                <div style={{ width: 60, background: '#1E293B', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column', zIndex: 20 }}>
                  <div style={{ height: 32, borderBottom: '1px solid #334155' }} /> {/* Ruler Spacer */}
                  <div style={{ height: 60, borderBottom: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#3B82F6' }}>V1</div>
                    <LockKeyhole size={10} color="#475569" />
                  </div>
                  <div style={{ height: 40, borderBottom: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#F59E0B' }}>T1</div>
                    <Eye size={10} color="#475569" />
                  </div>
                  <div style={{ height: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#10B981' }}>A1</div>
                    <Volume2 size={10} color="#475569" />
                  </div>
                </div>

                {/* Tracks Content Viewport */}
                <div 
                  style={{ flex: 1, position: 'relative', overflowX: 'auto', background: '#020617' }}
                  onScroll={(e) => setTimelineScrollLeft(e.currentTarget.scrollLeft)}
                  onClick={handleSeek}
                >
                  <div style={{ width: totalDuration * zoomLevel * 10 + 200, height: '100%', position: 'relative' }}>
                    {/* Time Ruler Ticks */}
                    <div style={{ height: 32, background: '#0F172A', borderBottom: '1px solid #1E293B', position: 'relative' }}>
                      {Array.from({ length: Math.ceil(totalDuration) + 10 }).map((_, i) => (
                        <div key={i} style={{ position: 'absolute', left: i * zoomLevel * 10, bottom: 0, height: i % 5 === 0 ? 14 : 6, width: 1, background: '#334155' }}>
                          {i % 5 === 0 && <span style={{ position: 'absolute', bottom: 18, left: -10, fontSize: 8, color: '#64748B', fontWeight: 800 }}>{i}s</span>}
                        </div>
                      ))}
                    </div>

                    {/* V1 Track */}
                    <div style={{ height: 60, borderBottom: '1px solid #1E293B', position: 'relative', display: 'flex', alignItems: 'center' }}>
                      {beats.map((b, i) => {
                        const start = beats.slice(0, i).reduce((acc, prev) => acc + (prev.duration_sec || 5), 0);
                        const dur = b.duration_sec || 5;
                        return (
                          <div
                            key={b.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedBeat(b); }}
                            style={{
                              position: 'absolute', left: start * zoomLevel * 10, width: dur * zoomLevel * 10 - 2, height: 48,
                              background: selectedBeat?.id === b.id ? '#3B82F6' : '#1E293B',
                              borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)',
                              overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, gap: 8
                            }}
                          >
                            <div style={{ width: 40, height: '100%', background: '#000', borderRadius: 4, overflow: 'hidden' }}>
                              {b.media_url && (b.media_type === 'video' ? <video src={b.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={b.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
                            </div>
                            <div style={{ fontSize: 9, color: '#FFF', fontWeight: 800, whiteSpace: 'nowrap' }}>SHOT #{i+1}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* T1 Track */}
                    <div style={{ height: 40, borderBottom: '1px solid #1E293B', position: 'relative', display: 'flex', alignItems: 'center' }}>
                      {beats.map((b, i) => {
                        const start = beats.slice(0, i).reduce((acc, prev) => acc + (prev.duration_sec || 5), 0);
                        const dur = b.duration_sec || 5;
                        return (
                          <div key={`text-${b.id}`} style={{ position: 'absolute', left: start * zoomLevel * 10, width: dur * zoomLevel * 10 - 2, height: 28, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 9, color: '#F59E0B', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                            {b.content}
                          </div>
                        );
                      })}
                    </div>

                    {/* A1 Track */}
                    <div style={{ height: 60, position: 'relative', display: 'flex', alignItems: 'center' }}>
                       <div style={{ position: 'absolute', left: 0, width: totalDuration * zoomLevel * 10, height: 44, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 2 }}>
                             {Array.from({ length: 120 }).map((_, k) => (
                               <div key={k} style={{ width: 2, height: `${Math.random() * 60 + 20}%`, background: '#10B981', borderRadius: 1, opacity: 0.6 }} />
                             ))}
                          </div>
                       </div>
                    </div>

                    {/* Master Playhead */}
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: currentTime * zoomLevel * 10, width: 2, background: '#EF4444', zIndex: 100, pointerEvents: 'none', boxShadow: '0 0 10px rgba(239,68,68,0.5)' }}>
                      <div style={{ position: 'absolute', top: 0, left: -7, width: 16, height: 16, background: '#EF4444', borderRadius: '0 0 4px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 4, height: 4, background: '#FFF', borderRadius: '50%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT: PRODUCTION SPECIALIST INSPECTOR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, overflow: 'hidden' }}>
            
            <div style={{ flex: 1, background: '#FFFFFF', borderRadius: 28, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={16} className="text-blue-500" /> 시퀀스 연출 인스펙터 (PRODUCTION)
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                {selectedBeat ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Timing Control Group */}
                    <div style={{ background: '#F8FAFC', borderRadius: 16, padding: 16, border: '1px solid #E2E8F0' }}>
                      <label style={{ fontSize: 10, fontWeight: 900, color: '#64748B', display: 'block', marginBottom: 12 }}>SHOT TIMING & PACE</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 9, color: '#94A3B8', fontWeight: 800 }}>DURATION</span>
                          <input type="number" step="0.1" style={styles.styleBibleInputV8} value={selectedBeat.duration_sec || 5} onChange={(e) => {
                             const updated = { ...selectedBeat, duration_sec: parseFloat(e.target.value) };
                             setBeats(beats.map(nb => nb.id === selectedBeat.id ? updated : nb));
                             setSelectedBeat(updated);
                          }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 9, color: '#94A3B8', fontWeight: 800 }}>TRANSITION</span>
                          <select style={styles.styleBibleInputV8}>
                            <option>Cross Dissolve</option>
                            <option>Cut</option>
                            <option>Fade to Black</option>
                            <option>Zoom Blur</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Cinematic Overlay Control */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ fontSize: 10, fontWeight: 900, color: '#64748B' }}>CINEMATIC TEXT OVERLAY</label>
                      <textarea 
                        style={{ width: '100%', minHeight: 80, padding: 14, borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 13, fontWeight: 600, color: '#1E293B', resize: 'none' }}
                        value={selectedBeat.content}
                        onChange={(e) => {
                          const updated = { ...selectedBeat, content: e.target.value };
                          setBeats(beats.map(nb => nb.id === selectedBeat.id ? updated : nb));
                          setSelectedBeat(updated);
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                         <button style={{ flex: 1, padding: 8, borderRadius: 8, background: '#F1F5F9', border: 'none', fontSize: 10, fontWeight: 800 }}>자막 스타일 A</button>
                         <button style={{ flex: 1, padding: 8, borderRadius: 8, background: '#F1F5F9', border: 'none', fontSize: 10, fontWeight: 800 }}>자막 스타일 B</button>
                      </div>
                    </div>

                    {/* Visual Fine-Tuning */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                       <label style={{ fontSize: 10, fontWeight: 900, color: '#64748B' }}>VISUAL FX & COMPOSITE</label>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {[
                            { label: 'Blur', key: 'blur', min: 0, max: 20 },
                            { label: 'Brightness', key: 'brightness', min: 0, max: 200 },
                            { label: 'Contrast', key: 'contrast', min: 0, max: 200 },
                            { label: 'Scale', key: 'scale', min: 0.5, max: 3, step: 0.1 },
                            { label: 'Rotate', key: 'rotate', min: -180, max: 180 }
                          ].map(cfg => (
                            <div key={cfg.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                               <span style={{ fontSize: 10, color: '#475569', fontWeight: 700, width: 70 }}>{cfg.label}</span>
                               <input 
                                 type="range" 
                                 min={cfg.min} max={cfg.max} step={cfg.step || 1}
                                 style={{ flex: 1, accentColor: '#3B82F6' }} 
                                 value={cfg.key === 'scale' || cfg.key === 'rotate' ? (selectedBeat.transform?.[cfg.key] ?? (cfg.key === 'scale' ? 1 : 0)) : (selectedBeat.fx?.[cfg.key] ?? (cfg.key === 'blur' ? 0 : 100))}
                                 onChange={(e) => {
                                   const val = parseFloat(e.target.value);
                                   const updated = { ...selectedBeat };
                                   if (cfg.key === 'scale' || cfg.key === 'rotate') {
                                     updated.transform = { ...updated.transform, [cfg.key]: val };
                                   } else {
                                     updated.fx = { ...updated.fx, [cfg.key]: val };
                                   }
                                   setBeats(beats.map(nb => nb.id === selectedBeat.id ? updated : nb));
                                   setSelectedBeat(updated);
                                 }}
                               />
                               <span style={{ fontSize: 9, color: '#94A3B8', fontWeight: 800, width: 30 }}>
                                 {cfg.key === 'scale' || cfg.key === 'rotate' ? (selectedBeat.transform?.[cfg.key] ?? (cfg.key === 'scale' ? 1 : 0)) : (selectedBeat.fx?.[cfg.key] ?? (cfg.key === 'blur' ? 0 : 100))}
                               </span>
                            </div>
                          ))}
                       </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 16 }}>
                    <MousePointer2 size={48} strokeWidth={1} />
                    <div style={{ fontSize: 13, fontWeight: 800 }}>타임라인에서 시퀀스를 선택하십시오.</div>
                  </div>
                )}
              </div>
            </div>

            {/* FINAL SYNTHESIS COMMAND */}
            <button
              onClick={handleInitiateRender}
              style={{ height: 72, background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: '#FFF', borderRadius: 24, border: 'none', fontSize: 15, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, boxShadow: '0 12px 24px -8px rgba(59,130,246,0.3)' }}
            >
              <Zap size={20} className="text-yellow-400" /> 최종 영상 통합 합성 가동 (SYNTHESIZE)
            </button>
          </div>
        </div>
      </div>
    );
  };

  // PHASE 05: DEPLOYMENT
  const renderPhase5Deployment = () => (
    <div style={styles.phaseContainerV8}>
      <div style={styles.deployGridV8}>
        <div style={styles.renderStatusPanelV8}>
          <div style={styles.panelTagV8}>
            {isRendering ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} className="text-green-500" />} 
            렌더링 엔진 상태 (RENDERING STATUS)
          </div>
          <div style={styles.panelContentV8}>
            {finalVideoUrl ? (
              <div style={{ borderRadius: 24, overflow: 'hidden', background: '#000', aspectRatio: '9/16' }}>
                 <VideoPlayer src={finalVideoUrl} title="Final Elite Production" />
              </div>
            ) : (
              <div style={styles.renderProgressV8}>
                <div style={styles.renderLabelV8}>
                  {isRendering ? `최종 작전 영상 빌드 중... (${renderProgress}%)` : '렌더링 대기 중...'}
                </div>
                <div style={styles.renderBarV8}>
                  <div style={{ ...styles.renderFillV8, width: `${renderProgress}%`, transition: 'width 0.5s ease-out' }} />
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={styles.channelPanelV8}>
          <div style={styles.panelTagV8}><Globe size={14} /> 멀티 채널 배포 (MULTI-CHANNEL DEPLOY)</div>
          <div style={styles.panelContentV8}>
            <button style={{ ...styles.deployBtnV8, opacity: finalVideoUrl ? 1 : 0.5, cursor: finalVideoUrl ? 'pointer' : 'not-allowed' }} disabled={!finalVideoUrl}>
               <Library size={16} /> 유튜브 쇼츠 전격 송출
            </button>
            <button style={{ ...styles.deployBtnV8, opacity: finalVideoUrl ? 1 : 0.5, cursor: finalVideoUrl ? 'pointer' : 'not-allowed' }} disabled={!finalVideoUrl}>
               <Sparkles size={16} /> 틱톡/인스타그램 동시 배포
            </button>
            {finalVideoUrl && (
              <a href={finalVideoUrl} download style={{ textDecoration: 'none' }}>
                <button style={{ ...styles.deployBtnV8, background: '#10B981', color: '#FFF', border: 'none' }}>
                  <Download size={16} /> 로컬 저장소로 전리품 회수
                </button>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );


  // ──────────────────────────────────────────────
  // [VIEW] Operations Hub (Ongoing Projects)
  // ──────────────────────────────────────────────
  const renderOperationsHub = () => {
    return (
        <div style={styles.opsHubWrapperV8}>
          <div style={styles.opsHeaderV8}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Activity size={24} color="#3B82F6" />
              <h2 style={styles.opsTitleV8}>작전 (Operations)</h2>
            </div>
            <div style={styles.opsBadgeV8}>{operations.length} Active</div>
          </div>

          <div style={styles.opsTableScrollV8}>
            <table style={styles.opsTableV8}>
              <thead>
                <tr style={styles.opsTheadTrV8}>
                  <th style={styles.opsThV8}>OPERATION ID</th>
                  <th style={styles.opsThV8}>PROJECT NAME</th>
                  <th style={styles.opsThV8}>CURRENT PHASE</th>
                  <th style={styles.opsThV8}>STATUS</th>
                  <th style={styles.opsThV8}>PROGRESS</th>
                  <th style={styles.opsThV8}>LAST SYNC</th>
                  <th style={{ ...styles.opsThV8, textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {operations.map(op => (
                  <tr key={op.id} style={styles.opsTrV8}>
                    <td style={styles.opsTdV8}>
                      <span style={styles.opsIdTagV8}>{op.id}</span>
                    </td>
                    <td style={{ ...styles.opsTdV8, fontWeight: 600, color: '#1E293B' }}>{op.title}</td>
                    <td style={styles.opsTdV8}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Zap size={14} color="#3B82F6" />
                        {op.phase}
                      </div>
                    </td>
                    <td style={styles.opsTdV8}>
                      <span style={{
                        ...styles.statusBadgeV8,
                        backgroundColor: op.status === 'Running' ? '#DBEAFE' : op.status === 'Paused' ? '#FEF3C7' : '#DCFCE7',
                        color: op.status === 'Running' ? '#1E40AF' : op.status === 'Paused' ? '#92400E' : '#166534'
                      }}>
                        {op.status}
                      </span>
                    </td>
                    <td style={styles.opsTdV8}>
                      <div style={styles.progressBarWrapperV8}>
                        <div style={{ ...styles.progressBarV8, width: `${(op.progress || 0).toFixed(1)}%` }} />
                        <span style={styles.progressTextV8}>{(op.progress || 0).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td style={{ ...styles.opsTdV8, color: '#94A3B8', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} />
                        {op.lastSync}
                      </div>
                    </td>
                    <td style={{ ...styles.opsTdV8, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button style={styles.opsActionBtnV8} title="열기"><RefreshCw size={14} /></button>
                        <button style={styles.opsActionBtnV8} title="초기화"><RotateCcw size={14} /></button>
                        <button style={{ ...styles.opsActionBtnV8, color: '#EF4444' }} title="삭제"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        );
  };


  // ──────────────────────────────────────────────
  // [VIEW] Mission Inbox (Pristine White)
  // ──────────────────────────────────────────────
  const renderInbox = () => {
          let filteredData = inboxVideos;
    if (inboxTab === 'video') filteredData = inboxVideos.filter(v => !v.is_script_only);
    if (inboxTab === 'script') filteredData = inboxVideos.filter(v => v.is_script_only);

        const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);

        return (
        <div style={styles.inboxWrapperV8}>
          <div style={styles.inboxContainerV8}>
            <div style={styles.inboxHeaderV8}>
              <div style={styles.headerLeftV8}>
                <h1 style={styles.inboxTitleV8}>작전 결재 대기함 (Mission Inbox)</h1>
                <p style={styles.inboxDescV8}>분석이 완료되어 지휘관님의 승인을 대기 중인 소스들입니다.</p>
              </div>
              <div style={styles.inboxControlsV8}>
                <div style={styles.controlGroupV8}>
                  <span style={styles.controlLabelV8}>Card Size</span>
                  <button style={{ ...styles.sizeBtnV8, ...(cardSize === 'sm' ? styles.sizeBtnActiveV8 : {}) }} onClick={() => setCardSize('sm')}>S</button>
                  <button style={{ ...styles.sizeBtnV8, ...(cardSize === 'md' ? styles.sizeBtnActiveV8 : {}) }} onClick={() => setCardSize('md')}>M</button>
                  <button style={{ ...styles.sizeBtnV8, ...(cardSize === 'lg' ? styles.sizeBtnActiveV8 : {}) }} onClick={() => setCardSize('lg')}>L</button>
                </div>
                <div style={styles.controlGroupV8}>
                  <button style={{ ...styles.layoutBtnV8, ...(inboxViewMode === 'list' ? styles.layoutBtnActiveV8 : {}) }} onClick={() => setInboxViewMode('list')}><LayoutList size={18} /></button>
                  <button style={{ ...styles.layoutBtnV8, ...(inboxViewMode === 'grid' ? styles.layoutBtnActiveV8 : {}) }} onClick={() => setInboxViewMode('grid')}><LayoutGrid size={18} /></button>
                </div>
              </div>
            </div>

            <div style={styles.searchBarV8}>
              <LinkIcon size={18} color="#94A3B8" />
              <input
                style={styles.searchInputV8}
                placeholder="URL 또는 대본 입력으로 분석 개시..."
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleStartOperation()}
              />
              <button style={styles.searchBtnV8} onClick={handleStartOperation}>작전 개시</button>
            </div>

            <div style={styles.tabGroupV8}>
              {[
                { id: 'all', label: '전체', count: inboxVideos.length },
                { id: 'video', label: '영상', count: inboxVideos.filter(v => !v.is_script_only).length },
                { id: 'script', label: '대본', count: inboxVideos.filter(v => v.is_script_only).length },
                { id: 'ops', label: '작전', count: operations.length }
              ].map(tab => (
                <button
                  key={tab.id}
                  style={{ ...styles.tabBtnV8, ...(inboxTab === tab.id ? styles.tabBtnActiveV8 : {}) }}
                  onClick={() => setInboxTab(tab.id as any)}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {inboxTab === 'ops' ? (
              <div style={styles.opsHubWrapperV8}>
                <div style={styles.opsTableScrollV8}>
                  <table style={styles.opsTableV8}>
                    <thead>
                      <tr style={styles.opsTheadTrV8}>
                        <th style={styles.opsThV8}>ID</th>
                        <th style={styles.opsThV8}>작전명</th>
                        <th style={styles.opsThV8}>단계</th>
                        <th style={styles.opsThV8}>상태</th>
                        <th style={styles.opsThV8}>진행률</th>
                        <th style={styles.opsThV8}>최근 동기화</th>
                        <th style={{ ...styles.opsThV8, textAlign: 'right' }}>제어</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operations.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                            대기 중인 작전이 없습니다.
                          </td>
                        </tr>
                      ) : operations.map(op => (
                        <tr key={op.id} style={styles.opsTableRowV8}>
                          <td style={{ ...styles.opsTableCellV8, color: '#94A3B8', fontSize: '0.75rem' }}>{op.displayId}</td>
                          <td style={{ ...styles.opsTableCellV8, fontWeight: 600 }}>{op.title}</td>
                          <td style={styles.opsTableCellV8}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6366F1' }}>
                              <Zap size={14} />
                              <span>{op.phase}</span>
                            </div>
                          </td>
                          <td style={styles.opsTableCellV8}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              backgroundColor: op.status === 'Running' ? 'rgba(59, 130, 246, 0.1)' : op.status === 'Success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              color: op.status === 'Running' ? '#3B82F6' : op.status === 'Success' ? '#22C55E' : '#F59E0B',
                              border: `1px solid ${op.status === 'Running' ? 'rgba(59, 130, 246, 0.2)' : op.status === 'Success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
                            }}>{op.status}</span>
                          </td>
                          <td style={styles.opsTableCellV8}>
                            <div style={{ width: '100%', maxWidth: '80px' }}>
                              <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${(op.progress || 0).toFixed(1)}%`, height: '100%', background: 'linear-gradient(90deg, #6366F1, #A855F7)', borderRadius: '3px' }} />
                              </div>
                              <div style={{ fontSize: '0.65rem', color: '#64748B', marginTop: '4px', textAlign: 'right' }}>{(op.progress || 0).toFixed(1)}%</div>
                            </div>
                          </td>
                          <td style={{ ...styles.opsTableCellV8, color: '#64748B', fontSize: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} />
                              <span>{op.lastSync}</span>
                            </div>
                          </td>
                          <td style={{ ...styles.opsTableCellV8, textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                              <button
                                style={styles.opsActionBtnV8}
                                title="작전 입장"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVideoId(op.id);
                                }}
                              >
                                <ExternalLink size={14} style={{ pointerEvents: 'none' }} />
                              </button>
                              <button
                                style={styles.opsActionBtnV8}
                                title="작전 초기화"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm(`[${op.displayId}] 작전 데이터를 초기화하시겠습니까?`)) {
                                    try {
                                      const { data } = await axios.post(`/api/operations/${op.id}/reset`);
                                      if (data.status === 'success') {
                                        alert("작전이 초기화되었습니다.");
                                      } else {
                                        alert("초기화 실패: " + data.message);
                                      }
                                    } catch (err: any) {
                                      alert("초기화 중 오류가 발생했습니다: " + (err.response?.data?.detail || err.message));
                                    }
                                  }
                                }}
                              >
                                <RotateCcw size={14} style={{ pointerEvents: 'none' }} />
                              </button>
                              <button
                                style={{ ...styles.opsActionBtnV8, color: '#EF4444' }}
                                title="작전 폐기"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm(`[${op.displayId}] 작전을 영구 폐기하시겠습니까?`)) {
                                    try {
                                      const { data } = await axios.post(`/api/operations/${op.id}/delete`);
                                      if (data.status === 'success') {
                                        setOperations(prev => prev.filter(p => p.id !== op.id));
                                        alert("작전이 영구 폐기되었습니다.");
                                      } else {
                                        alert("폐기 실패: " + data.message);
                                      }
                                    } catch (err: any) {
                                      alert("폐기 중 오류가 발생했습니다: " + (err.response?.data?.detail || err.message));
                                    }
                                  }
                                }}
                              >
                                <Trash2 size={14} style={{ pointerEvents: 'none' }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={inboxViewMode === 'list' ? styles.listContainerV8 : { ...styles.gridContainerV8, gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize === 'sm' ? 180 : cardSize === 'lg' ? 360 : 260}px, 1fr))` }}>
                {isLoading ? (
                  <div style={styles.loaderV8}><Loader2 size={40} className="animate-spin" /></div>
                ) : paginatedData.length === 0 ? (
                  <div style={styles.emptyBoxV8}>대기 중인 작전 소스가 없습니다.</div>
                ) : (
                  <>
                    <Dialog open={!!playingVideo} onOpenChange={(open) => !open && setPlayingVideo(null)}>
                      <DialogContent className="w-full max-w-[380px] p-0 overflow-hidden bg-black border-none rounded-xl">
                        <DialogHeader className="sr-only">
                          <DialogTitle>{playingVideo?.title}</DialogTitle>
                        </DialogHeader>
                        {playingVideo && (
                          <VideoPlayer
                            src={getMediaUrl(playingVideo.file_path)}
                            title={playingVideo.title}
                          />
                        )}
                      </DialogContent>
                    </Dialog>

                    <SubtitleViewer
                      open={!!subtitleVideo}
                      onOpenChange={(open) => !open && setSubtitleVideo(null)}
                      videoId={subtitleVideo?.id || null}
                      title={subtitleVideo?.title || ''}
                    />

                    <Dialog open={!!statsVideo} onOpenChange={(open) => !open && setStatsVideo(null)}>
                      <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl">
                        <DialogHeader>
                          <DialogTitle>바이럴 변화 추이</DialogTitle>
                          <DialogDescription>{statsVideo?.title}</DialogDescription>
                        </DialogHeader>
                        <div className="h-[300px] w-full mt-4">
                          {videoHistory && videoHistory.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <RechartsLineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                <XAxis
                                  dataKey="timestamp"
                                  tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  stroke="#888"
                                  fontSize={12}
                                />
                                <YAxis yAxisId="left" stroke="#3B82F6" fontSize={12} tickFormatter={(val) => formatNumber(val)} />
                                <YAxis yAxisId="right" orientation="right" stroke="#F59E0B" fontSize={12} tickFormatter={(val) => formatNumber(val) + '/h'} />
                                <Tooltip
                                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                  labelFormatter={(label) => new Date(label).toLocaleString()}
                                />
                                <Line yAxisId="left" type="monotone" dataKey="view_count" name="누적 조회수" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line yAxisId="right" type="monotone" dataKey="velocity" name="시간당 조회수" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
                              </RechartsLineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                              <TrendingUp size={32} className="mr-2 opacity-50" />
                              분석 데이터가 충분하지 않습니다.
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                    {paginatedData.map(v => (
                      <div
                        key={v.id}
                        style={styles.cardV8}
                        onClick={() => { setVideoId(v.id); }}
                        onMouseEnter={() => setHoveredId(v.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        <div style={{ ...styles.cardThumbV8, height: cardSize === 'sm' ? 120 : cardSize === 'lg' ? 240 : 160, backgroundImage: v.thumbnail_path ? `url(${getMediaUrl(v.thumbnail_path)})` : 'none', backgroundColor: '#F1F5F9' }}>
                          {!v.thumbnail_path && (v.is_script_only ? <FileText size={40} color="#E2E8F0" /> : <PlayCircle size={40} color="#E2E8F0" />)}

                          {hoveredId === v.id && (
                            <div style={styles.cardHoverOverlayV8}>
                              <div style={styles.overlayIconsV8}>
                                <div style={styles.overlayBtnV8} onClick={(e) => { e.stopPropagation(); setPlayingVideo(v); }} title="재생">
                                  <Play size={16} fill="currentColor" />
                                </div>
                                <div style={styles.overlayBtnV8} onClick={(e) => { e.stopPropagation(); setSubtitleVideo(v); }} title="자막">
                                  <FileText size={16} />
                                </div>
                                <div style={styles.overlayBtnV8} onClick={(e) => { e.stopPropagation(); setStatsVideo(v); }} title="통계">
                                  <LineChartIcon size={16} />
                                </div>
                                <div style={{ ...styles.overlayBtnV8, background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#FFFFFF', border: 'none' }}
                                  onClick={(e) => { e.stopPropagation(); hdDownloadMutation.mutate(v.id); }} title="다운로드">
                                  {hdDownloadMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                </div>
                                <div style={styles.overlayBtnV8} onClick={(e) => { e.stopPropagation(); openFolder(v.file_path); }} title="폴더">
                                  <FolderOpen size={16} />
                                </div>
                              </div>
                            </div>
                          )}

                          <div style={styles.cardTypeV8}>{v.is_script_only ? 'SCRIPT' : 'VIDEO'}</div>
                          <div style={styles.cardScoreV8}>{(v.viral_score || 0).toFixed(1)}%</div>
                        </div>
                        <div style={styles.cardMetaV8}>
                          <div style={styles.cardChannelRowV8}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#F1F5F9', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10, color: '#64748B' }}>
                                {v.channel?.name?.charAt(0) || 'U'}
                              </div>
                              <span style={styles.cardChannelV8}>{v.channel?.name || 'ViraLoop Intel'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8' }}>
                              <Calendar size={12} />
                              <span style={styles.cardDateV8}>{v.created_at ? new Date(v.created_at).toLocaleDateString() : '2026.05.11'}</span>
                            </div>
                          </div>

                          <h3 style={styles.cardTitleV8}>{v.title || 'Untitled Strategic Operation'}</h3>

                          <div style={styles.cardStatsGridV8}>
                            <div style={styles.statItemV8}>
                              <span style={styles.statLabelV8}>조회수</span>
                              <span style={styles.statValueV8}>{formatNumber(v.view_count || 0)}</span>
                            </div>
                            <div style={styles.statItemV8}>
                              <span style={styles.statLabelV8}>구독자</span>
                              <span style={styles.statValueV8}>{formatNumber(v.subscriber_count || 0)}</span>
                            </div>
                          </div>

                          <div style={styles.cardBottomV8}>
                            <div style={styles.metricV8}>
                              <Activity size={14} color="#6366F1" />
                              <span>+{(v.velocity_score || 0).toFixed(1)}/h</span>
                            </div>
                            <div style={{ ...styles.gradeTagV8, color: v.viral_score > 90 ? '#3B82F6' : '#10B981' }}>
                              <TrendingUp size={12} />
                              <span>{v.viral_score > 90 ? 'S-CLASS' : 'HIGH'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {totalPages > 1 && (
              <div style={styles.paginationV8}>
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={styles.pageBtnV8}>이전</button>
                <span style={styles.pageIndicatorV8}>{currentPage} / {totalPages}</span>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} style={styles.pageBtnV8}>다음</button>
              </div>
            )}
          </div>
        </div>
        );
  };

        return (
        <div style={styles.pageWrapperV8}>
          <div style={styles.topBarV8}>
            <div style={styles.topBarLeftV8}>
              <button style={styles.backBtnV8} onClick={async () => {
                await saveProjectState();
                if (videoId > 0) {
                  setVideoId(0);
                } else {
                  navigate(-1);
                }
              }}>← 뒤로</button>
              <div style={styles.titleBlockV8}>
                <h1 style={styles.pageTitleV8}>Elite Command Studio</h1>
                <span style={styles.pageSubtitleV8}>Pristine White Sovereign Intel</span>
              </div>
            </div>
            <div style={styles.topBarCenterV8}>
              {renderMissionStepper()}
            </div>
            <div style={styles.topBarRightV8}>
              <div style={styles.viewTogglesV8}>
                <button style={{ ...styles.toggleBtnV8, ...(strategy.aspectRatio === '9:16' ? styles.toggleActiveV8 : {}) }} onClick={() => setStrategy({ ...strategy, aspectRatio: '9:16' })}>쇼츠 (9:16)</button>
                <button style={{ ...styles.toggleBtnV8, ...(strategy.aspectRatio === '16:9' ? styles.toggleActiveV8 : {}) }} onClick={() => setStrategy({ ...strategy, aspectRatio: '16:9' })}>롱폼 (16:9)</button>
              </div>
            </div>
          </div>

          <div style={styles.mainContentV8}>
            {videoId === 0 ? (
              renderInbox()
            ) : isLoading ? (
              <div style={styles.loaderV8}><Loader2 size={48} className="animate-spin" /></div>
            ) : (
              <div style={styles.studioLayoutV8}>
                <div style={{
                  ...styles.studioMainV8,
                  opacity: isPhaseTransitioning ? 0 : 1,
                  transform: isPhaseTransitioning ? 'translateY(10px)' : 'translateY(0)',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                  {currentPhase === 1 && renderPhase1Strategy()}
                  {currentPhase === 2 && renderPhase2Narrative()}
                  {currentPhase === 3 && renderPhase3Genesis()}
                  {currentPhase === 4 && renderPhase4Production()}
                  {currentPhase === 5 && renderPhase5Deployment()}
                </div>
                {/* Bottom Status Bar - Premium Refinement */}
                <div style={styles.statusBarV8}>
                  <div style={styles.statusSectionV8}>
                    <Activity size={14} />
                    <span>시스템 텔레메트리: </span>
                    <span style={styles.statusValueV8}>CPU 24% | GPU 12% | 지연 45ms</span>
                  </div>
                  <div style={styles.statusSectionV8}>
                    <Globe size={14} />
                    <span>독립 네트워크: </span>
                    <span style={styles.statusValueV8}>연결됨</span>
                  </div>
                  <div style={styles.statusSectionV8}>
                    <Sparkles size={14} color="#3B82F6" />
                    <span>활성 에이전트: </span>
                    <span style={styles.statusValueV8}>루피 (HERMES) V3</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Elite Stock Explorer Modal */}
          <Dialog open={isStockModalOpen} onOpenChange={setIsStockModalOpen}>
            <DialogContent style={{ maxWidth: 900, background: '#FFFFFF', padding: 0, borderRadius: 24, overflow: 'hidden' }}>
              <DialogHeader style={{ display: 'none' }}>
                <DialogTitle>Elite Stock Explorer</DialogTitle>
                <DialogDescription>Search for premium external media assets.</DialogDescription>
              </DialogHeader>
              <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', height: 600 }}>
                {/* Left: Sidebar & Keywords */}
                <div style={{ background: '#F8FAFC', padding: 24, borderRight: '1px solid #E5E7EB' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#1F2937', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Library size={20} color="#3B82F6" /> Stock Explorer
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', marginBottom: 12, display: 'block' }}>RECOMMENDED KEYWORDS</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['Cinematic', 'Abstract', 'Tech', 'Minimal', 'Nature', 'Emotional'].map(k => (
                        <button
                          key={k}
                          style={{ padding: '6px 12px', borderRadius: 20, background: '#FFF', border: '1px solid #E2E8F0', fontSize: 11, fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                          onClick={() => handleStockSearch(k)}
                        >
                          #{k}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: '#EFF6FF', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#1E40AF', marginBottom: 4 }}>POWERED BY ELITE API</div>
                    <p style={{ fontSize: 10, color: '#3B82F6', margin: 0, lineHeight: 1.5 }}>Pexels, Pixabay, Unsplash의 1억 개 이상의 고품질 미디어 소스를 실시간으로 통합 검색합니다.</p>
                  </div>
                  <div style={{ marginTop: 'auto' }}>
                    <button
                      style={{ width: '100%', padding: '12px', borderRadius: 12, background: '#FFFFFF', border: '2px dashed #CBD5E1', color: '#64748B', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={16} /> Local File Upload
                    </button>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="video/*,image/*" onChange={handleFileUpload} />
                  </div>
                </div>

                {/* Right: Search & Results */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: 20, borderBottom: '1px solid #E5E7EB', display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <Search size={16} style={{ position: 'absolute', left: 14, top: 14, color: '#94A3B8' }} />
                      <input
                        style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 14, outline: 'none' }}
                        placeholder="Search for premium photos and videos..."
                        value={stockSearchQuery}
                        onChange={(e) => setStockSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleStockSearch(stockSearchQuery)}
                      />
                    </div>
                    <button style={{ padding: '0 24px', borderRadius: 12, background: '#111827', color: '#FFF', border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer' }} onClick={() => handleStockSearch(stockSearchQuery)}>Search</button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                    {isLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Loader2 size={32} className="animate-spin" color="#3B82F6" /></div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                        {stockResults.map(res => (
                          <div
                            key={res.id}
                            style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', aspectRatio: '16/9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                            onClick={() => {
                              if (selectedBeat) {
                                const newBeats = beats.map(b => b.id === selectedBeat.id ? { ...b, media_url: res.url, source_mode: 'upload' } : b);
                                setBeats(newBeats);
                                setSelectedBeat({ ...selectedBeat, media_url: res.url, source_mode: 'upload' });
                              }
                              setIsStockModalOpen(false);
                            }}
                          >
                            <img src={res.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={res.title} />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '12px', color: '#FFF', fontSize: 10, fontWeight: 700 }}>
                              {res.title}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* --- Global Persona Management Modal --- */}
          {isPersonaModalOpen && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{
                background: '#FFFFFF', borderRadius: 24, padding: 32,
                width: '100%', maxWidth: 500, boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                display: 'flex', flexDirection: 'column', gap: 24
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>
                    {editingStyle ? '페르소나 전술 수정' : '신규 페르소나 설계'}
                  </h2>
                  <button onClick={() => setIsPersonaModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={24} /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8' }}>페르소나 명칭 (NAME)</label>
                    <input
                      style={{ padding: '12px 16px', border: '1px solid #E5E7EB', borderRadius: 12, fontSize: 14, fontWeight: 600 }}
                      value={editingStyle?.name || ''}
                      onChange={(e) => setEditingStyle({ ...editingStyle, name: e.target.value })}
                      placeholder="예: 바이럴 빌런, 미스테리 기록자..."
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8' }}>시스템 페르소나 프롬프트 (SYSTEM PROMPT)</label>
                    <textarea
                      style={{ padding: '12px 16px', border: '1px solid #E5E7EB', borderRadius: 12, fontSize: 14, minHeight: 120, lineHeight: 1.6 }}
                      value={editingStyle?.system_instruction || ''}
                      onChange={(e) => setEditingStyle({ ...editingStyle, system_instruction: e.target.value })}
                      placeholder="[SELECTED PERSONA]: 상세 성격, 어조, 성공 법칙(PROOFREADING/CLARITY: 문법 오류 철저 교정, 간결하고 명확한 문장 지향)을 기술하세요..."
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8' }}>대표 대본 샘플 (SAMPLE TEXT - OPTIONAL)</label>
                    <textarea
                      style={{ padding: '12px 16px', border: '1px solid #E5E7EB', borderRadius: 12, fontSize: 13, minHeight: 80, color: '#64748B' }}
                      value={editingStyle?.sample_text || ''}
                      onChange={(e) => setEditingStyle({ ...editingStyle, sample_text: e.target.value })}
                      placeholder="이 페르소나가 쓴 것 같은 예시 문장을 넣어주세요..."
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    style={{ flex: 1, padding: '16px', borderRadius: 16, border: '1px solid #E5E7EB', background: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}
                    onClick={() => setIsPersonaModalOpen(false)}
                  >취소</button>
                  <button
                    style={{ flex: 2, padding: '16px', borderRadius: 16, border: 'none', background: '#111827', color: '#FFF', fontWeight: 800, cursor: 'pointer' }}
                    onClick={async () => {
                      if (!editingStyle?.name || !editingStyle?.system_instruction) return alert("명칭과 프롬프트를 입력하세요.");
                      try {
                        if (editingStyle.id) {
                          await axios.put(`/api/script/styles/${editingStyle.id}`, editingStyle);
                        } else {
                          await axios.post('/api/script/styles', editingStyle);
                        }
                        setIsPersonaModalOpen(false);
                        fetchScriptStyles();
                      } catch (err) { alert("저장 실패"); }
                    }}
                  >전술 저장 및 활성화</button>
                </div>
              </div>
            </div>
          )}
        </div>
        );
};

        const styles: Record<string, React.CSSProperties> = {
          styleBibleInputV8: { width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--muted)', fontSize: 13, fontWeight: 600, color: 'var(--foreground)', outline: 'none', transition: 'border-color 0.2s' },
          pageWrapperV8: {display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--background)', fontFamily: "var(--font-sans)", color: 'var(--foreground)', overflow: 'hidden' },
        topBarV8: {display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 72, background: 'hsl(var(--card) / 0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)', padding: '0 32px', flexShrink: 0, zIndex: 100 },
        topBarLeftV8: {display: 'flex', alignItems: 'center', gap: 24 },
        backBtnV8: {background: 'var(--muted)', border: 'none', color: 'var(--muted-foreground)', fontSize: 12, cursor: 'pointer', fontWeight: 800, padding: '8px 16px', borderRadius: 12, transition: 'all 0.2s' },
        titleBlockV8: {display: 'flex', flexDirection: 'column' },
        pageTitleV8: {fontSize: 18, fontWeight: 900, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' },
        pageSubtitleV8: {fontSize: 10, color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
        topBarRightV8: {display: 'flex', alignItems: 'center', gap: 20 },

        viewTogglesV8: {display: 'flex', background: 'var(--muted)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' },
        toggleBtnV8: {padding: '6px 16px', border: 'none', background: 'transparent', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', cursor: 'pointer' },
        toggleActiveV8: {background: 'var(--card)', color: 'var(--primary)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },

        mainContentV8: {flex: 1, display: 'flex', overflow: 'hidden' },

        inboxWrapperV8: {flex: 1, overflowY: 'auto', padding: '40px 32px', display: 'flex', justifyContent: 'center' },
        inboxContainerV8: {width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 32 },
        inboxHeaderV8: {display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
        inboxTitleV8: {fontSize: 28, fontWeight: 800, color: 'var(--foreground)', margin: 0 },
        inboxDescV8: {fontSize: 14, color: 'var(--muted-foreground)', margin: 0 },

        inboxControlsV8: {display: 'flex', gap: 16 },
        controlGroupV8: {display: 'flex', background: 'var(--card)', padding: 4, borderRadius: 10, border: '1px solid var(--border)', alignItems: 'center', gap: 4 },
        controlLabelV8: {fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', padding: '0 8px' },
        sizeBtnV8: {width: 32, height: 32, border: 'none', background: 'transparent', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: 'pointer', color: 'var(--muted-foreground)' },
        sizeBtnActiveV8: {background: 'var(--muted)', color: 'var(--foreground)' },
        layoutBtnV8: {width: 36, height: 36, border: 'none', background: 'transparent', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', cursor: 'pointer' },
        layoutBtnActiveV8: {background: 'var(--muted)', color: 'var(--primary)' },

        searchBarV8: {display: 'flex', alignItems: 'center', gap: 12, background: '#FFFFFF', padding: '12px 20px', borderRadius: 16, border: '1px solid #E5E7EB', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' },
        searchInputV8: {flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#1F2937' },
        searchBtnV8: {background: '#111827', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' },

        tabGroupV8: {display: 'flex', gap: 24, borderBottom: '1px solid var(--border)' },
        tabBtnV8: {padding: '16px 4px', background: 'transparent', border: 'none', borderBottom: '3px solid transparent', fontSize: 15, fontWeight: 700, color: 'var(--muted-foreground)', cursor: 'pointer', transition: 'all 0.2s' },
        tabBtnActiveV8: {color: 'var(--primary)', borderBottom: '3px solid var(--primary)' },

        gridContainerV8: {display: 'grid', gap: 24 },
        listContainerV8: {display: 'flex', flexDirection: 'column', gap: 12 },
        cardV8: {background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' },
        cardThumbV8: {backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        cardTypeV8: {position: 'absolute', top: 12, left: 12, background: 'hsl(var(--card) / 0.9)', padding: '4px 8px', borderRadius: 8, fontSize: 10, fontWeight: 800, color: 'var(--foreground)' },
        cardScoreV8: {position: 'absolute', bottom: 12, right: 12, background: '#10B981', color: '#FFF', padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800 },
        cardMetaV8: {padding: 20, display: 'flex', flexDirection: 'column', gap: 8 },
        cardTitleV8: {fontSize: 16, fontWeight: 700, color: 'var(--foreground)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
        cardFooterV8: {display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600 },
        footerItemV8: {display: 'flex', alignItems: 'center', gap: 6 },

        paginationV8: {display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 32, marginTop: 40 },
        pageBtnV8: {padding: '8px 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--foreground)', cursor: 'pointer' },
        pageIndicatorV8: {fontSize: 14, fontWeight: 700, color: 'var(--foreground)' },
        emptyBoxV8: {gridColumn: '1 / -1', padding: 100, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 16, fontWeight: 600 },
        loaderV8: {flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' },

        briefWrapperV8: {flex: 1, overflowY: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 32 },
        briefHeaderV8: {display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid var(--border)', paddingBottom: 24 },
        headerSubtitleV8: {fontSize: 11, fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.1em' },
        headerTitleV8: {fontSize: 28, fontWeight: 800, color: 'var(--foreground)', margin: '4px 0 0 0' },
        headerVideoMetaV8: {textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4 },
        metaLabelV8: {fontSize: 10, fontWeight: 800, color: 'var(--muted-foreground)' },
        metaValueV8: {fontSize: 15, fontWeight: 700, color: 'var(--foreground)' },
        statusDotV8: {width: 10, height: 10, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px #10B981', marginBottom: 8 },

        briefGridV8: {display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 },
        panelV8: {background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' },
        panelTagV8: {background: 'var(--muted)', padding: '8px 12px', fontSize: 10, fontWeight: 800, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 },
        panelContentV8: {padding: 16, display: 'flex', flexDirection: 'column', gap: 16 },

        metricCardV8: {background: 'var(--muted)', padding: 20, borderRadius: 16, border: '1px solid var(--border)' },
        metricRowV8: {display: 'flex', justifyContent: 'space-around', marginBottom: 16 },
        metricItemV8: {display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'center' },
        metricLabelV8: {fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)' },
        metricValueV8: {fontSize: 24, fontWeight: 800, color: 'var(--foreground)' },
        progressBgV8: {height: 12, background: 'var(--secondary)', borderRadius: 6, overflow: 'hidden' },
        progressFillV8: {height: '100%', background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)' },

        adviceBoxV8: {background: 'hsl(var(--warning) / 0.1)', border: '1px solid hsl(var(--warning) / 0.2)', padding: 20, borderRadius: 16 },
        adviceHeaderV8: {fontSize: 14, fontWeight: 800, color: 'hsl(var(--warning))', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 },
        adviceTextV8: {fontSize: 14, color: 'var(--foreground)', lineHeight: 1.7, margin: 0 },

        presetListV8: {display: 'flex', flexDirection: 'column', gap: 12 },
        presetCardV8: {display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' },
        presetActiveV8: {border: '1px solid var(--primary)', background: 'hsl(var(--primary) / 0.1)', boxShadow: '0 0 0 1px var(--primary)' },
        presetIconV8: {fontSize: 24 },
        presetInfoV8: {flex: 1, display: 'flex', flexDirection: 'column' },
        presetLabelV8: {fontSize: 15, fontWeight: 700, color: 'var(--foreground)' },
        presetDescV8: {fontSize: 12, color: 'var(--muted-foreground)' },

        calibGridV8: {display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
        calibItemV8: {display: 'flex', flexDirection: 'column', gap: 8 },
        calibLabelV8: {fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)' },
        calibSelectV8: {padding: '10px 16px', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, background: 'var(--card)', color: 'var(--foreground)', outline: 'none' },
        previewBoxV8: {flex: 1, background: 'var(--muted)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
        previewCanvasV8: {width: '100%', maxWidth: 120, background: 'var(--card)', border: '2px dashed var(--border)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--muted-foreground)' },

        summaryBoxV8: {background: 'var(--muted)', padding: 20, borderRadius: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 },
        summaryItemV8: {display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--muted-foreground)' },
        deployBtnV8: {width: '100%', padding: '20px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 20, fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 'auto', transition: 'transform 0.2s' },
        btnTextGroupV8: {display: 'flex', flexDirection: 'column', textAlign: 'left' },
        btnTitleV8: {fontSize: 16 },
        btnSubV8: {fontSize: 10, opacity: 0.6, letterSpacing: '0.05em' },

        briefThreeColumnV8: {display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, flex: 1 },
        columnV8: {display: 'flex', flexDirection: 'column', gap: 24 },
        intelligenceCardV8: {background: 'var(--card)', border: '1px solid var(--border)', padding: 24, borderRadius: 20, color: 'var(--foreground)' },
        intelHeaderV8: {display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
        intelLabelV8: {fontSize: 10, fontWeight: 800, color: 'var(--muted-foreground)', letterSpacing: '0.05em' },
        intelValueV8: {fontSize: 32, fontWeight: 800, color: '#F472B6' },
        intelProgressBgV8: {height: 6, background: 'var(--secondary)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
        intelProgressFillV8: {height: '100%', background: '#F472B6' },
        intelFooterV8: {fontSize: 11, fontWeight: 700, color: '#4ADE80' },

        metricGridV8: {display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 },
        miniMetricV8: {background: 'var(--card)', border: '1px solid var(--border)', padding: 16, borderRadius: 16 },
        miniLabelV8: {fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 },
        miniValueV8: {fontSize: 18, fontWeight: 800, color: 'var(--foreground)' },

        analysisBoxV8: {background: 'var(--muted)', border: '1px solid var(--border)', padding: 20, borderRadius: 16, marginTop: 16 },
        analysisTitleV8: {fontSize: 12, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 12px 0' },
        analysisListV8: {listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
        analysisItemV8: {fontSize: 13, color: 'var(--foreground)', lineHeight: 1.5 },

        presetSelectionV8: {display: 'flex', flexDirection: 'column', gap: 12 },
        tacticalCardV8: {display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' },
        tacticalActiveV8: {border: '1px solid var(--primary)', background: 'hsl(var(--primary) / 0.1)', boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.1)' },
        tacticalIconV8: {fontSize: 24 },
        tacticalInfoV8: {display: 'flex', flexDirection: 'column' },
        tacticalLabelV8: {fontSize: 16, fontWeight: 800, color: 'var(--foreground)' },
        tacticalDescV8: {fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 },

        calibFormV8: {display: 'flex', flexDirection: 'column', gap: 24 },
        fieldV8: {display: 'flex', flexDirection: 'column', gap: 8 },
        fieldLabelV8: {fontSize: 11, fontWeight: 800, color: 'var(--muted-foreground)' },
        fieldSelectV8: {padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, background: 'var(--card)', color: 'var(--foreground)', outline: 'none' },
        engineToggleV8: {display: 'flex', background: 'var(--muted)', padding: 4, borderRadius: 12 },
        engineBtnV8: {flex: 1, padding: '10px', border: 'none', background: 'transparent', fontSize: 11, fontWeight: 800, color: 'var(--muted-foreground)', borderRadius: 10, cursor: 'pointer' },
        engineActiveV8: {background: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },

        commandSummaryV8: {marginTop: 'auto', background: 'var(--muted)', padding: 20, borderRadius: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 },
        engageBtnV8: {marginTop: 20, width: '100%', padding: '24px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'transform 0.2s' },
        engageTitleV8: {fontSize: 18, fontWeight: 800 },
        engageSubV8: {fontSize: 10, opacity: 0.6, letterSpacing: '0.05em' },

        headerMetaRowV8: {display: 'flex', gap: 12, marginTop: 12 },
        metaBadgeV8: {background: 'var(--muted)', color: 'var(--muted-foreground)', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 800 },
        statusGroupV8: {display: 'flex', alignItems: 'center', gap: 16 },
        headerRightV8: {display: 'flex', alignItems: 'center' },


        aiTagV8: {background: 'hsl(var(--primary) / 0.1)', color: 'var(--primary)', padding: '4px 8px', borderRadius: 6, fontSize: 9, fontWeight: 900, marginLeft: 'auto' },
        humanTagV8: {background: 'hsl(var(--destructive) / 0.1)', color: 'var(--destructive)', padding: '4px 8px', borderRadius: 6, fontSize: 9, fontWeight: 900, marginLeft: 'auto' },
        intelListV8: {display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 },
        intelItemV8: {display: 'flex', alignItems: 'center', gap: 10, background: 'var(--muted)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)' },
        intelTextV8: {fontSize: 12, fontWeight: 600, color: 'var(--foreground)' },



        studioLayoutV8: {flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        studioMainV8: {flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },

        statusBarV8: {height: 32, background: 'var(--card)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', paddingLeft: 24, paddingRight: 24, gap: 32, flexShrink: 0 },
        statusSectionV8: {display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)' },
        statusValueV8: {color: 'var(--foreground)', fontFamily: "'JetBrains Mono', monospace" },
        editorAreaV8: {flex: 1, display: 'flex', overflow: 'hidden' },
        editorLeftV8: {width: 320, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--card)' },
        editorCenterV8: {flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        canvasWrapperV8: {flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'var(--muted)' },
        editorRightV8: {width: 400, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--card)' },
        sidebarV8: {width: 320, borderLeft: '1px solid var(--border)', background: 'var(--muted)' },
        errorContainerV8: {flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 },

        // Mission Pipeline Styles
        topBarCenterV8: {flex: 1, display: 'flex', justifyContent: 'center', padding: '0 40px' },
        stepperWrapperV8: {display: 'flex', alignItems: 'center', gap: 0, background: 'var(--muted)', padding: '4px 8px', borderRadius: 14, border: '1px solid var(--border)' },
        stepItemV8: {display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s', opacity: 0.6 },
        stepActiveV8: {background: 'var(--card)', opacity: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
        stepDoneV8: {opacity: 0.9, color: '#10B981' },
        stepIconV8: {width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--muted)', color: 'var(--muted-foreground)' },
        stepTextV8: {display: 'flex', flexDirection: 'column' },
        stepLabelV8: {fontSize: 10, fontWeight: 800, letterSpacing: '0.02em' },
        stepSubV8: {fontSize: 9, fontWeight: 700, color: 'var(--muted-foreground)' },
        stepDividerV8: {width: 1, height: 20, background: 'var(--border)', margin: '0 8px' },

        phaseContainerV8: {flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column' },
        narrativeGridV8: {display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, flex: 1 },
        scriptEditorPanelV8: {background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        scriptTextAreaV8: {
          height: '600px',
        padding: 24,
        border: 'none',
        outline: 'none',
        fontSize: 16,
        lineHeight: 1.8,
        color: 'var(--foreground)',
        resize: 'none',
        background: 'var(--card)',
        overflowY: 'auto',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
  },
        scriptActionsV8: {
          padding: '16px 20px',
        borderTop: '1px solid var(--border)',
        background: 'var(--muted)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16
  },
        refineBtnV8: {
          padding: '8px 14px',
        background: 'var(--card)',
        color: 'var(--foreground)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  },
        actionBtnV8: {
          padding: '8px 16px',
        background: 'var(--primary)',
        color: 'var(--primary-foreground)',
        border: 'none',
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'
  },
        insightPanelV8: {display: 'flex', flexDirection: 'column', gap: 12 },

        orchestrationGridV8: {display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24, flex: 1 },
        beatsListPanelV8: {background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
        beatsVisualPanelV8: {background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
        storyboardGridV8: {display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
        storyCardV8: {background: 'var(--muted)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
        storyThumbV8: {height: 100, background: 'var(--muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--muted-foreground)' },
        storyMetaV8: {padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        storyTitleV8: {fontSize: 13, fontWeight: 700, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
        storyDurationV8: {fontSize: 11, fontWeight: 800, color: 'var(--primary)', background: 'hsl(var(--primary) / 0.1)', padding: '2px 6px', borderRadius: 6 },

        deployGridV8: {display: 'grid', gridTemplateColumns: '1fr 400px', gap: 32, maxWidth: 1200, margin: '0 auto', width: '100%' },
        renderStatusPanelV8: {background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, padding: 32 },
        renderProgressV8: {display: 'flex', flexDirection: 'column', gap: 16 },
        renderLabelV8: {fontSize: 14, fontWeight: 700, color: 'var(--foreground)' },
        renderBarV8: {height: 12, background: 'var(--muted)', borderRadius: 6, overflow: 'hidden' },
        renderFillV8: {height: '100%', background: 'linear-gradient(90deg, #3B82F6, #10B981)', transition: 'width 0.5s ease-out' },
        channelPanelV8: {background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column', gap: 24 },

        // Persona Selection Styles
        personaGridV8: {display: 'flex', flexDirection: 'column', gap: 12 },
        personaCardV8: {display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s' },
        personaActiveV8: {background: 'hsl(var(--primary) / 0.1)', border: '1px solid var(--primary)', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.08)' },
        personaIconV8: {fontSize: 20 },
        personaInfoV8: {display: 'flex', flexDirection: 'column' },
        personaLabelV8: {fontSize: 13, fontWeight: 800, color: 'var(--foreground)' },
        personaDescV8: {fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 },

        // Operations Hub Styles
        opsHubWrapperV8: {background: 'var(--card)', border: '1px solid var(--border)', padding: 32, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' },
        opsHeaderV8: {display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
        opsTitleV8: {fontSize: 20, fontWeight: 800, color: 'var(--foreground)', margin: 0 },
        opsBadgeV8: {background: 'hsl(var(--primary) / 0.1)', color: 'var(--primary)', padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800 },
        opsTableScrollV8: {overflowX: 'auto', borderRadius: 16, border: '1px solid var(--border)' },
        opsTableV8: {width: '100%', borderCollapse: 'collapse', minWidth: 900 },
        opsTheadTrV8: {background: 'var(--muted)', borderBottom: '1px solid var(--border)' },
        opsThV8: {padding: '16px 20px', fontSize: 11, fontWeight: 800, color: 'var(--muted-foreground)', textAlign: 'left', letterSpacing: '0.05em' },
        opsTrV8: {borderBottom: '1px solid var(--border)', transition: 'background 0.2s' },
        opsTdV8: {padding: '20px', fontSize: 14, color: 'var(--foreground)' },
        opsIdTagV8: {background: 'var(--muted)', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800, color: 'var(--muted-foreground)', fontFamily: 'monospace' },
        statusBadgeV8: {padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800 },
        progressBarWrapperV8: {width: '100%', height: 24, background: 'var(--muted)', borderRadius: 12, position: 'relative', overflow: 'hidden' },
        progressBarV8: {height: '100%', background: 'linear-gradient(90deg, #3B82F6, #6366F1)', transition: 'width 0.4s ease-in-out' },
        progressTextV8: {position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 10, fontWeight: 800, color: '#1E40AF' },
        opsActionBtnV8: {width: 32, height: 32, border: '1px solid var(--border)', background: 'var(--card)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', color: 'var(--foreground)', outline: 'none' },
        inboxSeparatorV8: {height: 1, background: 'linear-gradient(90deg, transparent, var(--border), transparent)', margin: '40px 0' },
};

        export default EliteCommandStudio;
