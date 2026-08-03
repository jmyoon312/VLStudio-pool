import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Sparkles, Download, Play, FolderOpen, Globe, Loader2, Trash2, Scissors, CheckCheck, X, Search, CheckCircle2, ChevronRight, Video, FileVideo, Users, Image as ImageIcon, UploadCloud, Layers, Film, Wand2 } from 'lucide-react';

const CATEGORIES = [
  { id: 'family', name: '가족갈등', stars: ['婆媳关系','母爱感人'], cores: ['偏心','争遗产','不孝子'] },
  { id: 'reversal', name: '신분반전', stars: ['吊丝逆袭','隐姓埋名'], cores: ['首富','装穷','打脸','战神归来'] },
  { id: 'betrayal', name: '불륜복수', stars: ['出轨','手撕小三'], cores: ['渣男','净身出户','撕绿茶'] },
  { id: 'timeslip', name: '회귀·빙의', stars: ['重生'], cores: ['穿越','逆袭人生','虐渣'] },
  { id: 'tender', name: '모성·감동', stars: ['单亲妈妈','孤儿抚养'], cores: ['感人','养母之情'] },
];

const AdvancedTtsCard = ({ 
    category, 
    label, 
    config, 
    voices, 
    rvcModels,
    onChange 
}: { 
    category: string, 
    label: string, 
    config: { engine?: string, voice_id: string, speed: number, pitch: number, rvc_model?: string | null }, 
    voices: string[], 
    rvcModels: string[],
    onChange: (cat: string, newConf: any) => void 
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const currentEngine = config.engine || 'supertone-local';

    const ENGINE_OPTIONS = [
        { value: 'supertone-local', label: 'Supertone (감정/사투리)' },
        { value: 'typecast', label: 'Typecast (어린이/노인)' },
        { value: 'gemini', label: 'Gemini 3.1 (자연스러운 딕션)' },
        { value: 'elevenlabs', label: 'ElevenLabs (극사실적)' }
    ];

    const VOICE_PRESETS = {
        'supertone-local': ['M1', 'M2', 'M3', 'M4', 'M5', 'F1', 'F2', 'F3', 'F4', 'F5'],
        'typecast': [
            { id: '6220803c734e3a0b5a329ecb', label: '호빈 (소년)' },
            { id: '600a94432a514d348a245d65', label: '소진 (소녀)' },
            { id: '5f9b9f9e162f1c84cb1c6186', label: '춘식 (할아버지)' },
            { id: '5f9b9fa1162f1c84cb1c6187', label: '순남 (할머니)' }
        ],
        'gemini': [
            "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede", 
            "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba", 
            "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar", 
            "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi", 
            "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat"
        ].map(v => ({ id: v, label: v })),
        'elevenlabs': [
            { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel (여성 - 무료)' },
            { id: '29vD33N1CtxCmqQRPOHJ', label: 'Drew (남성 - 무료)' },
            { id: '2EiwWnXFjjIM0oIQjXcz', label: 'Clyde (남성 - 무료)' }
        ]
    };

    const togglePlay = () => {
        if (isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
        } else {
            const url = `/api/douyin-shorts/tts-preview/${category}?engine=${currentEngine}&voice_id=${encodeURIComponent(config.voice_id)}&speed=${config.speed}&pitch=${config.pitch}${config.rvc_model ? `&rvc_model=${encodeURIComponent(config.rvc_model)}` : ''}`;
            if (audioRef.current) {
                audioRef.current.pause();
            }
            audioRef.current = new Audio(url);
            audioRef.current.onended = () => setIsPlaying(false);
            audioRef.current.play().catch(e => {
                console.error("Audio playback failed", e);
                setIsPlaying(false);
            });
            setIsPlaying(true);
        }
    };

    return (
        <div className="border border-slate-200 rounded-xl p-3 hover:border-orange-200 transition-colors bg-white">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-[11px] font-bold text-slate-500">{label}</h4>
                <button 
                    onClick={togglePlay}
                    className="h-7 px-3 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-orange-100 hover:text-orange-600 transition-colors text-xs font-bold"
                    title={isPlaying ? "정지" : "미리듣기"}
                >
                    {isPlaying ? <div className="w-2.5 h-2.5 bg-current rounded-sm"></div> : <Play size={12} className="mr-1" />}
                    {isPlaying ? "중지" : "테스트"}
                </button>
            </div>
            <div className="space-y-2">
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">TTS 엔진</label>
                        <select 
                            value={currentEngine}
                            onChange={(e) => onChange(category, { ...config, engine: e.target.value, voice_id: e.target.value === 'supertone-local' ? 'M1' : (VOICE_PRESETS[e.target.value as keyof typeof VOICE_PRESETS]?.[0]?.id || VOICE_PRESETS[e.target.value as keyof typeof VOICE_PRESETS]?.[0] || '') })}
                            className="w-full text-xs p-1.5 border border-slate-200 rounded bg-slate-50 focus:outline-none focus:border-orange-300"
                        >
                            {ENGINE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">목소리 (Voice/Actor ID)</label>
                        {currentEngine === 'supertone-local' ? (
                            <select 
                                value={config.voice_id}
                                onChange={(e) => onChange(category, { ...config, voice_id: e.target.value })}
                                className="w-full text-xs p-1.5 border border-slate-200 rounded bg-slate-50 focus:outline-none focus:border-orange-300"
                            >
                                {voices.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        ) : (
                            <div className="flex flex-col gap-1">
                                <select
                                    value={config.voice_id}
                                    onChange={(e) => onChange(category, { ...config, voice_id: e.target.value })}
                                    className="w-full text-xs p-1 border border-slate-200 rounded bg-slate-50 focus:outline-none focus:border-orange-300"
                                >
                                    {(VOICE_PRESETS[currentEngine as keyof typeof VOICE_PRESETS] as any[]).map((v: any) => (
                                        <option key={v.id || v} value={v.id || v}>{v.label || v}</option>
                                    ))}
                                </select>
                                <input 
                                    type="text" 
                                    value={config.voice_id} 
                                    onChange={(e) => onChange(category, { ...config, voice_id: e.target.value })}
                                    className="w-full text-[10px] p-1 border border-slate-200 rounded bg-white text-slate-500 placeholder:text-slate-300"
                                    placeholder="커스텀 Actor ID 입력"
                                />
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="flex gap-2 mt-2">
                    <div className="flex-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 flex justify-between">
                            <span>속도</span> <span className="text-orange-500">{config.speed}x</span>
                        </label>
                        <input type="range" min="0.5" max="2.0" step="0.1" value={config.speed} 
                            onChange={e => onChange(category, { ...config, speed: parseFloat(e.target.value) })}
                            className="w-full accent-orange-500 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div className="flex-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 flex justify-between">
                            <span>피치</span> <span className="text-orange-500">{config.pitch}</span>
                        </label>
                        <input type="range" min="-5" max="5" step="1" value={config.pitch} 
                            onChange={e => onChange(category, { ...config, pitch: parseInt(e.target.value) })}
                            className="w-full accent-orange-500 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                    </div>
                </div>
            </div>
        </div>
    );
};

const SupertonicTestCard = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [model, setModel] = useState('supertone-local/default');
    const [speed, setSpeed] = useState(0);
    const [pitch, setPitch] = useState(0);
    const [emotion, setEmotion] = useState('normal');
    const [noiseScale, setNoiseScale] = useState(0.667);

    const togglePlay = () => {
        if (isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
        } else {
            const url = `/api/douyin-shorts/tts-preview/custom?voice_id=${encodeURIComponent(model)}&speed=${speed}&pitch=${pitch}&emotion=${emotion}&noise_scale=${noiseScale}`;
            if (audioRef.current) {
                audioRef.current.pause();
            }
            audioRef.current = new Audio(url);
            audioRef.current.onended = () => setIsPlaying(false);
            audioRef.current.play().catch(e => {
                console.error("Audio playback failed", e);
                setIsPlaying(false);
            });
            setIsPlaying(true);
        }
    };

    return (
        <div className="border border-indigo-200 bg-indigo-50/30 rounded-xl p-4 mt-4">
            <h4 className="text-[12px] font-bold text-indigo-700 mb-3 flex items-center gap-1">
                <Sparkles size={14} /> Supertonic Local 커스텀 테스트
            </h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">모델명 (Model)</label>
                    <input type="text" value={model} onChange={e => setModel(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded" placeholder="supertone-local/모델명" />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">감정 (Emotion)</label>
                    <select value={emotion} onChange={e => setEmotion(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded">
                        <option value="normal">Normal</option>
                        <option value="happy">Happy</option>
                        <option value="sad">Sad</option>
                        <option value="angry">Angry</option>
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex justify-between">
                        <span>속도 (Speed)</span> <span>{speed}%</span>
                    </label>
                    <input type="range" min="-50" max="50" value={speed} onChange={e => setSpeed(parseInt(e.target.value))} className="w-full" />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex justify-between">
                        <span>피치 (Pitch)</span> <span>{pitch}</span>
                    </label>
                    <input type="range" min="-10" max="10" value={pitch} onChange={e => setPitch(parseInt(e.target.value))} className="w-full" />
                </div>
                <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex justify-between">
                        <span>노이즈 스케일 (Noise)</span> <span>{noiseScale}</span>
                    </label>
                    <input type="range" min="0" max="1" step="0.01" value={noiseScale} onChange={e => setNoiseScale(parseFloat(e.target.value))} className="w-full" />
                </div>
            </div>
            <button 
                onClick={togglePlay}
                className="w-full py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
            >
                {isPlaying ? <div className="w-3 h-3 bg-white rounded-sm"></div> : <Play size={14} />}
                {isPlaying ? "재생 중지" : "커스텀 설정으로 미리듣기 생성"}
            </button>
        </div>
    );
};

type TabType = 'ingest' | 'batch' | 'timeline';

export default function SmartDouyinSearch() {
  const [activeTab, setActiveTab] = useState<TabType>('ingest');
  const [playingVideoId, setPlayingVideoId] = useState<number | null>(null);
  
  // Search State
  const [selected, setSelected] = useState<string[]>(['family']);
  const [aiKeys, setAiKeys] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [minDur, setMinDur] = useState(60);
  const [maxDur, setMaxDur] = useState(300);
  const [dateAfter, setDateAfter] = useState('20250101');
  const [count, setCount] = useState(5);
  const [deep, setDeep] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  // Job & Video State
  const [jobId, setJobId] = useState<number | null>(() => {
    const saved = localStorage.getItem('vlstudio_job_id');
    return saved ? parseInt(saved, 10) : null;
  });

  useEffect(() => {
    if (jobId) {
      localStorage.setItem('vlstudio_job_id', jobId.toString());
    } else {
      localStorage.removeItem('vlstudio_job_id');
    }
  }, [jobId]);

  useEffect(() => {
    if (jobId) {
      startPolling(jobId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [jobStatus, setJobStatus] = useState('idle');
  const [videos, setVideos] = useState<any[]>([]);
  const ingestVideos = videos.filter(v => v.pipeline_stage === 'ingest');
  const factoryVideos = videos.filter(v => v.pipeline_stage !== 'ingest');
  const [totalVideos, setTotalVideos] = useState(0);
  const [processMsg, setProcessMsg] = useState('');
  const [exportMsg, setExportMsg] = useState('');
  const [selectAll, setSelectAll] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<any | null>(null);
  const [showTtsModal, setShowTtsModal] = useState(false);
  const [ttsVoices, setTtsVoices] = useState<string[]>([]);
  const [ttsPresets, setTtsPresets] = useState<any>({});
  const [rvcModels, setRvcModels] = useState<string[]>([]);
  const [scriptStyle, setScriptStyle] = useState('base');
  const [expandedVideoId, setExpandedVideoId] = useState<number | null>(null);

  // Fetch TTS Data when modal opens
  useEffect(() => {
      if (showTtsModal) {
          fetch('/api/douyin-shorts/tts-voices').then(r=>r.json()).then(d => { if(d.ok) setTtsVoices(d.voices); });
          fetch('/api/douyin-shorts/tts-presets').then(r=>r.json()).then(d => { if(d.ok) setTtsPresets(d.presets); });
          fetch('/api/douyin-shorts/tts-rvc-models').then(r=>r.json()).then(d => { if(d.ok) setRvcModels(d.models); });
      }
  }, [showTtsModal]);

  const handleTtsPresetChange = (category: string, newConfig: any) => {
      setTtsPresets(prev => ({ ...prev, [category]: newConfig }));
      fetch('/api/douyin-shorts/tts-presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, ...newConfig })
      }).catch(e => console.error("Failed to save TTS preset", e));
  };

  const allKeywords = useMemo(() => {
    const kw: string[] = [];
    selected.forEach(cid => { const cat = CATEGORIES.find(c => c.id === cid); if (cat) kw.push(...cat.stars, ...cat.cores); });
    aiKeys.forEach(k => { if (!kw.includes(k)) kw.push(k); });
    return [...new Set(kw)].slice(0, 15);
  }, [selected, aiKeys]);

  const selectedVideos = useMemo(() => videos.filter(v => v.selected), [videos]);
  
  const uniqueChannels = useMemo(() => {
    const map = new Map();
    videos.forEach(v => {
      if (v.uploader && !map.has(v.uploader)) {
        map.set(v.uploader, { name: v.uploader, url: v.uploader_url, count: 1 });
      } else if (v.uploader) {
        map.get(v.uploader).count += 1;
      }
    });
    return Array.from(map.values()).sort((a,b) => b.count - a.count);
  }, [videos]);

  async function doPoll(jid: number) {
    try {
      const r = await fetch(`/api/douyin-shorts/${jid}`);
      if (r.status === 404) {
        setJobId(null);
        if (timerRef.current) clearInterval(timerRef.current);
        setProcessMsg('이전 작업(세션)이 만료되거나 삭제되었습니다.');
        return;
      }
      const data = await r.json();
      setJobStatus(data.status || 'error');
      setTotalVideos(data.total_videos ?? 0);
      if (data.videos?.length) {
        setVideos(prev => {
          const prevMap = new Map(prev.map(v => [v.idx, v.selected]));
          return data.videos.map((v: any) => ({ ...v, selected: prevMap.has(v.idx) ? prevMap.get(v.idx) : v.selected !== false }));
        });
      }
      if (data.status === 'downloaded_ready' || data.status === 'editing_done' || data.status === 'error') {
        if (timerRef.current) clearInterval(timerRef.current);
        if (data.status === 'error') {
          setProcessMsg(`실패: ${data.message || '오류 발생'}`);
        } else {
          setProcessMsg(`완료: ${data.total_videos}개 대기열 적재 완료`);
        }
      } else {
          setProcessMsg(data.message || `진행 중... ${data.status}`);
      }
    } catch {
      setProcessMsg('상태 갱신 오류');
    }
  }

  function startPolling(jid: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    doPoll(jid);
    const id = setInterval(() => doPoll(jid), 2500);
    timerRef.current = id;
  }

  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  useEffect(() => {
    fetch('/api/browser-profiles')
      .then(r => r.json())
      .then(data => {
        setProfiles(data);
        if (data.length > 0) setSelectedProfileId(data[0].id);
      })
      .catch(e => console.error(e));
  }, []);

  const handleSearch = async () => {
    if (allKeywords.length === 0) { alert('검색할 키워드를 선택해주세요.'); return; }
    setJobStatus('searching');
    setProcessMsg('스텔스 브라우저 구동 및 네트워크 분석 중 (약 10~15초 소요)...');
    try {
      const res = await fetch('/api/douyin-shorts/start-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword_seeds: allKeywords, category_tags: selected, min_duration_sec: minDur, max_duration_sec: maxDur, date_after: dateAfter, download_count: count, channel_deep: deep, expand_with_ai: true, profile_id: selectedProfileId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setJobId(data.job_id);
      startPolling(data.job_id);
    } catch (e: any) {
      setJobStatus('error');
      setProcessMsg('에러: ' + e.message);
    }
  };

  const handleAnalyzeVideo = async (idx: number) => {
    if (!jobId) return;
    setJobStatus('editing');
    setProcessMsg(`영상 #${idx} Vision AI 단독 분석 중...`);
    await fetch('/api/douyin-shorts/process-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: jobId, target_video_indices: [idx], stage: 'analyze', script_style: scriptStyle }) });
    startPolling(jobId);
  };

  const handleGenerateTTS = async (idx: number) => {
    if (!jobId) return;
    setJobStatus('editing');
    setProcessMsg(`영상 #${idx} TTS 및 자막 생성(조립) 중...`);
    await fetch('/api/douyin-shorts/process-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: jobId, target_video_indices: [idx], stage: 'tts_and_assemble', script_style: scriptStyle }) });
    startPolling(jobId);
  };

  const handleEdit = async () => {
    if (!jobId || selectedVideos.length === 0) return;
    const indices = selectedVideos.map(v => v.idx);
    setJobStatus('editing');
    setProcessMsg('AI 스튜디오 배치 프로세서 가동 중 (Vision ➡️ TTS ➡️ Slicer)...');
    await fetch('/api/douyin-shorts/process-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: jobId, target_video_indices: indices, script_style: scriptStyle }) });
    startPolling(jobId);
  };

  const handleExport = async () => {
    if (!jobId) return;
    setExportMsg('CapCut 프로젝트 분리 조립 중...');
    await fetch('/api/douyin-shorts/export-capcut', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: jobId, video_indices: selectedVideos.map(v => v.idx) }) });
    setExportMsg('CapCut 멀티 트랙 프로젝트 내보내기 및 레지스트리 등록 완료');
  };

  const handleOpenFolder = async () => {
    await fetch('/api/douyin-shorts/open-folder', { method: 'POST' });
  };

  const handleDelete = async (indices: number[]) => {
    if (!jobId) return;
    await fetch('/api/douyin-shorts/delete-videos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: jobId, indices }) });
    setVideos(prev => prev.filter(v => !indices.includes(v.idx)));
  };

  const handleSaveScript = async (idx: number, scriptData: any) => {
    if (!jobId) return;
    setProcessMsg(`영상 #${idx} 매핑 데이터 저장 중...`);
    try {
      await fetch('/api/douyin-shorts/update-script', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ job_id: jobId, video_idx: idx, script_data: scriptData }) 
      });
      setProcessMsg(`영상 #${idx} 대본 및 매핑 데이터가 성공적으로 저장되었습니다.`);
      setExpandedVideoId(null); // Close the editor upon saving
    } catch (e) {
      setProcessMsg(`저장 실패: ${e}`);
    }
  };
  
  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      
      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;
      
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
         formData.append('files', files[i]);
      }
      if (jobId) {
         formData.append('job_id', jobId.toString());
      }
      
      setProcessMsg("파일 업로드 중...");
      setJobStatus("searching");
      
      fetch('/api/douyin-shorts/upload-local', {
          method: 'POST',
          body: formData
      })
      .then(res => res.json())
      .then(data => {
          if (data.job_id) {
             setJobId(data.job_id);
             startPolling(data.job_id);
             setProcessMsg("업로드 완료! 아래 목록에서 확인하세요.");
          } else {
             setJobStatus('error');
             setProcessMsg("업로드 에러: " + (data.detail || data.message || "Unknown Error"));
          }
      })
      .catch(err => {
          setJobStatus('error');
          setProcessMsg("업로드 에러: " + err.message);
      });
  };

  const isWorking = jobStatus === 'searching' || (jobStatus && jobStatus.includes('downloading')) || jobStatus === 'editing';

  const updateSceneField = (videoIdx: number, sceneIndex: number, field: string, value: any) => {
      setVideos(prev => prev.map(v => {
          if (v.idx !== videoIdx) return v;
          const newScenes = [...(v.script_data?.scenes || [])];
          if (newScenes[sceneIndex]) {
              newScenes[sceneIndex] = { ...newScenes[sceneIndex], [field]: value };
          }
          return {
              ...v,
              script_data: {
                  ...v.script_data,
                  scenes: newScenes
              }
          };
      }));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm text-white">
                <Scissors size={24} />
              </div>
              Douyin Studio Pro <span className="text-xs font-black bg-slate-900 text-white px-2 py-0.5 rounded-full relative -top-3 left-1 tracking-widest">BATCH</span>
            </h1>
            <p className="mt-2 text-sm text-slate-500 font-medium tracking-wide">
              수백 개의 숏폼 영상을 동시 다발적으로 분석/편집하는 멀티모달 AI 팩토리
            </p>
          </div>
          <div className="flex gap-3">
             <button onClick={handleOpenFolder} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 shadow-sm text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all">
               <FolderOpen size={16} />
               로컬 팩토리 폴더 열기
             </button>
          </div>
        </div>

        {/* PROGRESS BANNER */}
        {jobId && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
             <div className="flex items-center gap-4">
                 {isWorking ? (
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                      <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />
                    </div>
                 ) : jobStatus === 'error' ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                      <X className="h-5 w-5" />
                    </div>
                 ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                 )}
                 <div>
                   <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                     배치 세션 #{jobId}
                     <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isWorking ? 'bg-indigo-100 text-indigo-700' : jobStatus === 'error' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                       {jobStatus}
                     </span>
                   </h3>
                   <p className="text-sm text-slate-500 font-medium">{processMsg}</p>
                 </div>
             </div>
          </div>
        )}

        {/* STUDIO TABS */}
        <div className="bg-white rounded-t-2xl border border-slate-200 shadow-sm p-2 flex items-center gap-2">
            <button onClick={() => setActiveTab('ingest')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'ingest' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                <Download size={16} /> 1단계: 수집 및 분석 큐
            </button>
            <button onClick={() => setActiveTab('batch')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'batch' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                <Scissors size={16} /> 2단계: AI 매핑 편집기
                {videos.length > 0 && <span className="ml-2 bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded-full text-xs">{videos.length}</span>}
            </button>
            <button onClick={() => setActiveTab('timeline')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'timeline' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                <CheckCheck size={16} /> 3단계: 최종 검수 및 내보내기
            </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="bg-white border-x border-b border-slate-200 shadow-sm rounded-b-2xl p-6 min-h-[600px]">
            
            {/* 탭 1: 수집 & 업로드 */}
            {activeTab === 'ingest' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 더우인 스크래퍼 */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                            <Globe className="text-indigo-600" size={24} />
                            <div>
                                <h3 className="font-bold text-slate-900 text-lg">Douyin 네트워크 수집</h3>
                                <p className="text-sm text-slate-500">프로필을 선택하고 키워드로 영상을 수집합니다.</p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">더우인 연동 프로필 선택</label>
                                <select value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg p-3">
                                    <option value="">-- 쿠키 없는 기본 스텔스 봇 --</option>
                                    {profiles.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} (연동: {p.douyin_count || 0})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">카테고리</label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORIES.map(c => (
                                    <button key={c.id} onClick={() => setSelected(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${selected.includes(c.id) ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}>
                                        {c.name}
                                    </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block flex justify-between items-center">
                                    세부 추출 키워드
                                    <button onClick={() => { setAiLoading(true); fetch('/api/douyin-shorts/expand-keywords', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword_seeds: allKeywords.slice(0,5), category_tags: selected, n:5 }) }).then(r => r.json()).then(d => { setAiKeys(d.additional || []); setAiLoading(false); }).catch(() => setAiLoading(false)); }} disabled={aiLoading}
                                    className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md text-xs">
                                    {aiLoading ? '분석 중...' : 'AI 자동 확장'}
                                    </button>
                                </label>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 min-h-[60px] flex flex-wrap gap-1.5">
                                    {allKeywords.map((k,i) => (
                                    <span key={i} className={`px-2.5 py-1 rounded-md text-xs font-medium border ${aiKeys.includes(k) ? 'bg-indigo-100 border-indigo-200 text-indigo-800' : 'bg-white text-slate-700'}`}>{k}</span>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">수집 수량</label>
                                    <input type="number" value={count} onChange={e => setCount(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                                </div>
                            </div>

                            <button onClick={handleSearch} disabled={isWorking || allKeywords.length === 0}
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                                {isWorking ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                                대기열로 수집 시작 (Queue)
                            </button>
                        </div>
                    </div>

                    {/* 로컬 업로드 */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                            <UploadCloud className="text-slate-600" size={24} />
                            <div>
                                <h3 className="font-bold text-slate-900 text-lg">로컬 영상 다중 업로드</h3>
                                <p className="text-sm text-slate-500">PC에 저장된 수십 개의 영상을 한 번에 업로드합니다.</p>
                            </div>
                        </div>

                        <div 
                            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={handleDrop}
                            className={`h-[400px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-colors ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50'}`}
                        >
                            <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                                <UploadCloud size={32} className={dragActive ? 'text-indigo-600' : 'text-slate-400'} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">여기로 영상 파일 드래그 앤 드롭</h3>
                            <p className="text-sm text-slate-500 mt-2 text-center max-w-xs">
                                MP4, MOV 파일을 여러 개 선택하여 한 번에 끌어다 놓으세요.
                            </p>
                        </div>
                    </div>

                    {/* 수집 큐 (스테이징 리스트) */}
                    {ingestVideos.length > 0 && (
                        <div className="col-span-1 lg:col-span-2 mt-8 space-y-4 border-t border-slate-200 pt-8">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                    <Layers className="text-indigo-600" size={20} />
                                    방금 수집/업로드된 영상 목록 ({ingestVideos.length}개)
                                </h3>
                                <div className="flex gap-2">
                                    <button onClick={() => handleDelete(selectedVideos.map(v => v.idx))} disabled={selectedVideos.length === 0} className="px-4 py-2 bg-slate-100 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-200 transition-colors">
                                        선택 삭제
                                    </button>
                                    <button onClick={async () => {
                                        if(!jobId) return;
                                        await fetch('/api/douyin-shorts/send-to-factory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: jobId, target_video_indices: ingestVideos.filter(v => v.selected).map(v => v.idx) }) });
                                        setActiveTab('batch');
                                    }} disabled={ingestVideos.filter(v => v.selected).length === 0} className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-2">
                                        선택 항목 2단계(AI 매핑 편집)로 전송 <CheckCircle2 size={16} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {ingestVideos.map(v => (
                                    <div key={v.idx} className={`bg-white rounded-xl overflow-hidden border ${v.selected ? 'border-indigo-500 shadow-md ring-2 ring-indigo-500/20' : 'border-slate-200 shadow-sm'} transition-all cursor-pointer relative`} onClick={() => setVideos(prev => prev.map(o => o.idx === v.idx ? { ...o, selected: !o.selected } : o))}>
                                        <div className="aspect-[9/16] bg-slate-900 relative group">
                                            {playingVideoId === v.idx ? (
                                                <video src={v.url || v.path} controls autoPlay className="w-full h-full object-cover z-10 relative" onClick={e => e.stopPropagation()} />
                                            ) : (
                                                <>
                                                    {v.thumbnail ? (
                                                        <img src={v.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500"><Video size={32} /></div>
                                                    )}
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                                                        <button onClick={e => { e.stopPropagation(); setPlayingVideoId(v.idx); }} className="p-3 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/40">
                                                            <Play size={24} className="ml-1" />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                            <div className="absolute top-2 left-2 z-20">
                                                <input type="checkbox" checked={v.selected} readOnly className="w-5 h-5 rounded text-indigo-600 border-white bg-white/50 backdrop-blur-sm shadow-sm" />
                                            </div>
                                            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] text-white font-mono font-bold">
                                                {v.duration_fmt || '1:00'}
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <p className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug" title={v.title}>{v.title}</p>
                                            <p className="text-[11px] text-slate-500 mt-2 truncate">{v.uploader || 'Local'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 탭 2: 배치 매니저 (매핑 편집) */}
            {activeTab === 'batch' && (
                <div className="flex flex-col h-[700px]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-bold text-slate-900">2단계: AI 매핑 및 컷편집 ({factoryVideos.length}개)</h2>
                            <select 
                                value={scriptStyle} 
                                onChange={(e) => setScriptStyle(e.target.value)}
                                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                            >
                                <option value="base">🔥 자극적 어그로 (기본)</option>
                                <option value="old_people">👵 50~70대 공감형</option>
                                <option value="drama">🎭 과몰입 드라마형</option>
                                <option value="info">💡 정보 전달형</option>
                            </select>
                            <button onClick={() => setShowTtsModal(true)} className="px-3 py-1.5 bg-orange-50 text-orange-600 text-xs font-bold rounded border border-orange-200 hover:bg-orange-100 transition flex items-center gap-1">
                                <Wand2 size={14} /> AI TTS 보이스 매핑 설정
                            </button>
                        </div>
                        <button onClick={() => handleDelete(selectedVideos.map(v => v.idx))} disabled={selectedVideos.length === 0} className="px-4 py-2 bg-red-50 text-red-600 text-sm font-bold rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2">
                            <Trash2 size={16} /> 삭제
                        </button>
                    </div>

                    <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-200 bg-white text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <div className="col-span-1 flex justify-center">
                                <input type="checkbox" checked={selectAll} onChange={() => { const n = !selectAll; setSelectAll(n); setVideos(prev => prev.map(v => ({ ...v, selected: n }))); }} className="rounded text-indigo-600" />
                            </div>
                            <div className="col-span-5">비디오 제목</div>
                            <div className="col-span-2 text-center">진행 단계</div>
                            <div className="col-span-4 text-center">작업 제어</div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {factoryVideos.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <Layers size={48} className="mb-4 opacity-50" />
                                    <p>대기열에 영상이 없습니다.</p>
                                </div>
                            ) : factoryVideos.map(v => (
                                <div key={v.idx} className={`flex flex-col bg-white rounded-xl border ${expandedVideoId === v.idx ? 'border-indigo-400 shadow-lg' : 'border-slate-100 shadow-sm'} transition-all`}>
                                    <div className="grid grid-cols-12 gap-4 items-center px-4 py-3 cursor-pointer" onClick={() => setExpandedVideoId(expandedVideoId === v.idx ? null : v.idx)}>
                                        <div className="col-span-1 flex justify-center" onClick={e => e.stopPropagation()}>
                                            <input type="checkbox" checked={v.selected} onChange={() => setVideos(prev => prev.map(o => o.idx === v.idx ? { ...o, selected: !o.selected } : o))} className="rounded text-indigo-600" />
                                        </div>
                                        <div className="col-span-5 flex items-center gap-3">
                                            <div className="w-16 h-10 bg-slate-200 rounded overflow-hidden flex-shrink-0">
                                                {v.thumbnail ? <img src={v.thumbnail} className="w-full h-full object-cover" /> : <Video size={14} className="m-auto h-full text-slate-400" />}
                                            </div>
                                            <p className="text-sm font-bold text-slate-800 truncate" title={v.title}>{v.title}</p>
                                        </div>
                                        <div className="col-span-2 flex flex-col items-center justify-center">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold w-full text-center ${v.pipeline_stage === 'analyzed' ? 'bg-blue-100 text-blue-700' : v.pipeline_stage === 'generated' ? 'bg-purple-100 text-purple-700' : v.pipeline_stage === 'assembled' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {v.pipeline_stage === 'analyzed' ? '분석완료' : v.pipeline_stage === 'generated' ? '음성생성됨' : v.pipeline_stage === 'assembled' ? '조립완료' : '대기중'}
                                            </span>
                                        </div>
                                        <div className="col-span-4 flex justify-center gap-2" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => handleAnalyzeVideo(v.idx)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded text-xs font-bold hover:bg-indigo-100 border border-indigo-200 shadow-sm transition-colors">분석하기</button>
                                            <button 
                                                onClick={() => handleGenerateTTS(v.idx)} 
                                                disabled={v.pipeline_stage !== 'analyzed' && v.pipeline_stage !== 'generated' && v.pipeline_stage !== 'assembled'}
                                                className={`px-3 py-1.5 rounded text-xs font-bold transition-colors shadow-sm ${
                                                    (v.pipeline_stage === 'analyzed' || v.pipeline_stage === 'generated' || v.pipeline_stage === 'assembled') 
                                                        ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200' 
                                                        : 'bg-slate-50 text-slate-400 border border-slate-200 opacity-50 cursor-not-allowed'
                                                }`}
                                            >
                                                TTS/자막 생성
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {expandedVideoId === v.idx && (
                                        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl shadow-inner">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                    <Scissors size={16} className="text-indigo-500" />
                                                    대본 및 보이스 매핑 편집
                                                </h4>
                                                <button onClick={() => handleSaveScript(v.idx, v.script_data)} className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold shadow hover:bg-slate-800 transition-colors">
                                                    수정 사항 저장
                                                </button>
                                            </div>
                                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-slate-100 text-slate-500 text-[10px] uppercase tracking-wider">
                                                        <tr>
                                                            <th className="px-3 py-2 border-b text-center">Scene #</th>
                                                            <th className="px-3 py-2 border-b">원본 컷 구간 (초)</th>
                                                            <th className="px-3 py-2 border-b">AI 생성 대사/나레이션</th>
                                                            <th className="px-3 py-2 border-b">화자 (보이스 매핑)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {v.script_data?.scenes?.length > 0 ? v.script_data.scenes.map((row: any, i: number) => (
                                                            <tr key={i} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                                                                <td className="px-3 py-2 w-20 text-center text-slate-400 font-bold">{row.index || i+1}</td>
                                                                <td className="px-3 py-2 w-56">
                                                                    <div className="flex flex-col gap-2">
                                                                        <div className="flex items-center gap-1">
                                                                            <input type="number" step="0.1" className="w-16 text-xs p-1.5 border border-slate-200 rounded text-emerald-600 font-mono font-bold focus:ring-1 focus:ring-indigo-400 outline-none" value={row.start_time} onChange={e => updateSceneField(v.idx, i, 'start_time', parseFloat(e.target.value) || 0)} />
                                                                            <span className="text-slate-400">-</span>
                                                                            <input type="number" step="0.1" className="w-16 text-xs p-1.5 border border-slate-200 rounded text-emerald-600 font-mono font-bold focus:ring-1 focus:ring-indigo-400 outline-none" value={row.end_time} onChange={e => updateSceneField(v.idx, i, 'end_time', parseFloat(e.target.value) || 0)} />
                                                                        </div>
                                                                        {v.path && (
                                                                            <div className="relative group overflow-hidden rounded border border-slate-200 bg-black aspect-video w-full flex items-center justify-center">
                                                                                <video
                                                                                    src={`/api/douyin-shorts/media?path=${encodeURIComponent(v.path)}#t=${row.start_time},${row.end_time}`}
                                                                                    controls
                                                                                    controlsList="nodownload nofullscreen noremoteplayback"
                                                                                    disablePictureInPicture
                                                                                    className="w-full h-full object-contain"
                                                                                    onContextMenu={(e) => e.preventDefault()}
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2"><textarea className="w-full text-xs p-1.5 border border-slate-200 rounded min-h-[80px] focus:ring-1 focus:ring-indigo-400 outline-none resize-y" value={row.content} onChange={e => updateSceneField(v.idx, i, 'content', e.target.value)} /></td>
                                                                <td className="px-3 py-2 w-64 align-top">
                                                                    <div className="flex flex-col gap-2">
                                                                        <div className="bg-slate-100 px-2 py-1.5 rounded border border-slate-200 text-xs flex flex-col gap-1">
                                                                            <span className="font-bold text-slate-800 flex items-center gap-1">
                                                                                <Users size={12} className="text-slate-500" />
                                                                                {row.speaker || "캐릭터 미상"}
                                                                            </span>
                                                                            <span className="text-slate-500 text-[10px]">
                                                                                {row.speaker_gender || "-"} / {row.speaker_age || "-"} / {row.speaker_tone || "-"}
                                                                            </span>
                                                                        </div>
                                                                        <select className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-semibold text-indigo-700 focus:ring-1 focus:ring-indigo-400 outline-none shadow-sm" value={row.tts_preset || ""} onChange={e => updateSceneField(v.idx, i, 'tts_preset', e.target.value)}>
                                                                            <option value="">-- 자동 (나레이션) --</option>
                                                                            <option value="male_child">👦 어린이 (남)</option>
                                                                            <option value="female_child">👧 어린이 (여)</option>
                                                                            <option value="male_20s">👨 청년 (남)</option>
                                                                            <option value="female_20s">👩 청년 (여)</option>
                                                                            <option value="male_40s_50s">👴 중년 (남)</option>
                                                                            <option value="female_40s_50s">👵 중년 (여)</option>
                                                                            <option value="male_70s">🧓 노인 (남)</option>
                                                                            <option value="female_70s">👵 노인 (여)</option>
                                                                        </select>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )) : (
                                                            <tr>
                                                                <td colSpan={4} className="text-center p-8 text-slate-400 text-sm">
                                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                                        <Sparkles size={24} className="opacity-50" />
                                                                        <span>상단의 [분석하기] 버튼을 눌러 영상 분석 및 대본 매핑을 시작하세요.</span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 탭 3: 타임라인 검수 */}
            {activeTab === 'timeline' && (
                <div className="flex flex-col h-[700px]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <select 
                                className="bg-white border border-slate-200 rounded-lg p-2 text-sm font-bold w-64"
                                onChange={e => setPreviewVideo(videos.find(v => v.idx === Number(e.target.value)))}
                            >
                                <option value="">검수할 영상을 선택하세요</option>
                                {videos.filter(v => v.editing === 'done').map(v => (
                                    <option key={v.idx} value={v.idx}>{v.title}</option>
                                ))}
                            </select>
                            {previewVideo && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">분석 완료</span>}
                        </div>
                        <button onClick={handleExport} disabled={!jobId || videos.filter(v=>v.editing==='done').length === 0} 
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white text-sm font-bold uppercase tracking-wider rounded-xl shadow-md hover:bg-slate-800 disabled:opacity-50">
                            <Play size={16} /> 선택된 배치 전체 CapCut 내보내기
                        </button>
                    </div>

                    {exportMsg && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-bold flex items-center justify-center gap-2 rounded-xl">
                        <CheckCircle2 size={16} /> {exportMsg}
                        </div>
                    )}

                    <div className="flex-1 bg-slate-900 rounded-2xl overflow-hidden relative border border-slate-800 shadow-inner flex flex-col">
                        {previewVideo ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-4">
                                <div className="w-full max-w-2xl bg-black rounded-lg overflow-hidden shadow-2xl relative aspect-video flex items-center justify-center border border-slate-700">
                                    {/* Video Player Mockup / Actual player if URL available */}
                                    {previewVideo.path ? (
                                        <video 
                                            controls 
                                            className="w-full h-full object-contain"
                                            src={`/download/${previewVideo.path.split('/').pop()}`} // assuming download folder mapping or mock
                                            onError={(e) => {
                                                // Fallback if video can't be loaded directly
                                                (e.target as HTMLVideoElement).style.display = 'none';
                                                (e.target as HTMLVideoElement).nextElementSibling?.classList.remove('hidden');
                                            }}
                                        />
                                    ) : null}
                                    <div className={`absolute inset-0 flex flex-col items-center justify-center ${previewVideo.path ? 'hidden' : ''}`}>
                                        <Film size={64} className="text-slate-600 mb-4" />
                                        <p className="text-slate-400 font-medium">Video Preview Unavailable</p>
                                        <p className="text-slate-500 text-sm mt-2">{previewVideo.title}</p>
                                    </div>
                                </div>
                                <div className="w-full max-w-2xl mt-6 bg-slate-800 p-4 rounded-xl border border-slate-700">
                                    <h4 className="text-slate-300 font-bold mb-3 flex items-center gap-2">
                                        <FileText size={16} /> 분석된 대본 & 자막
                                    </h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                        <div className="bg-slate-700/50 p-3 rounded-lg text-sm text-slate-300">
                                            <span className="text-emerald-400 font-mono mr-2">[00:00 - 00:03]</span> 
                                            <span className="text-indigo-300 font-bold mr-2">[나레이션]</span>
                                            쓰레기 남편이 바람을 피우고도 당당하게 본처를 내쫓으려 합니다!
                                        </div>
                                        <div className="bg-slate-700/50 p-3 rounded-lg text-sm text-slate-300">
                                            <span className="text-emerald-400 font-mono mr-2">[00:03 - 00:06]</span> 
                                            <span className="text-orange-300 font-bold mr-2">[화자A]</span>
                                            너 같은 거렁뱅이는 내 집에서 당장 나가!
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="m-auto text-slate-500 flex flex-col items-center">
                                <Film size={48} className="mb-4 opacity-30" />
                                <p className="font-medium text-sm">목록에서 완료된 영상을 선택하면 타임라인이 활성화됩니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* TTS 프리셋 모달 */}
            {showTtsModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <Sparkles size={18} className="text-orange-500" />
                                AI TTS 보이스 매핑 프리셋 (자가 학습)
                            </h3>
                            <button onClick={() => setShowTtsModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            <p className="text-sm text-slate-600 leading-relaxed mb-4">
                                Vision AI가 영상을 분석하여 식별한 <strong>인물(페르소나)</strong>에 따라 아래에 할당된 목소리가 자동으로 적용됩니다.
                                영상 내내 동일한 인물에게는 동일한 목소리가 유지되며(화자 고정), 감정(분노/슬픔 등)만 변동됩니다.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="col-span-1 md:col-span-2 lg:col-span-4 text-xs font-bold text-slate-500 uppercase tracking-wider mt-2 border-b border-slate-100 pb-1">남성 (Male)</div>
                                {ttsPresets['male_child'] && <AdvancedTtsCard category="male_child" label="어린이 (10대 전후)" config={ttsPresets['male_child']} voices={ttsVoices} rvcModels={rvcModels} onChange={handleTtsPresetChange} />}
                                {ttsPresets['male_20s'] && <AdvancedTtsCard category="male_20s" label="청년 (20대)" config={ttsPresets['male_20s']} voices={ttsVoices} rvcModels={rvcModels} onChange={handleTtsPresetChange} />}
                                {ttsPresets['male_40s_50s'] && <AdvancedTtsCard category="male_40s_50s" label="중년 (40~50대)" config={ttsPresets['male_40s_50s']} voices={ttsVoices} rvcModels={rvcModels} onChange={handleTtsPresetChange} />}
                                {ttsPresets['male_70s'] && <AdvancedTtsCard category="male_70s" label="노년 (70대)" config={ttsPresets['male_70s']} voices={ttsVoices} rvcModels={rvcModels} onChange={handleTtsPresetChange} />}

                                <div className="col-span-1 md:col-span-2 lg:col-span-4 text-xs font-bold text-slate-500 uppercase tracking-wider mt-2 border-b border-slate-100 pb-1">여성 (Female)</div>
                                {ttsPresets['female_child'] && <AdvancedTtsCard category="female_child" label="어린이 (10대 전후)" config={ttsPresets['female_child']} voices={ttsVoices} rvcModels={rvcModels} onChange={handleTtsPresetChange} />}
                                {ttsPresets['female_20s'] && <AdvancedTtsCard category="female_20s" label="청년 (20대)" config={ttsPresets['female_20s']} voices={ttsVoices} rvcModels={rvcModels} onChange={handleTtsPresetChange} />}
                                {ttsPresets['female_40s_50s'] && <AdvancedTtsCard category="female_40s_50s" label="중년 (40~50대)" config={ttsPresets['female_40s_50s']} voices={ttsVoices} rvcModels={rvcModels} onChange={handleTtsPresetChange} />}
                                {ttsPresets['female_70s'] && <AdvancedTtsCard category="female_70s" label="노년 (70대)" config={ttsPresets['female_70s']} voices={ttsVoices} rvcModels={rvcModels} onChange={handleTtsPresetChange} />}

                                <div className="col-span-1 md:col-span-2 lg:col-span-4 text-xs font-bold text-slate-500 uppercase tracking-wider mt-2 border-b border-slate-100 pb-1">공통 (Common)</div>
                                <div className="col-span-2">
                                    {ttsPresets['narrator'] && <AdvancedTtsCard category="narrator" label="나레이션 / 해설자" config={ttsPresets['narrator']} voices={ttsVoices} rvcModels={rvcModels} onChange={handleTtsPresetChange} />}
                                </div>
                            </div>
                            <div className="bg-orange-50 text-orange-800 text-xs p-3 rounded-lg flex items-start gap-2 mt-4 border border-orange-100">
                                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                                <p><strong>자가 학습 모드 활성화:</strong> 새로운 유형의 인물(예: 10대 소년)이 식별되면 시스템이 가장 유사한 목소리를 찾아 <code className="bg-orange-100 px-1 rounded">tts_presets.json</code>에 영구적으로 자동 등록합니다.</p>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 text-right">
                            <button onClick={() => setShowTtsModal(false)} className="px-5 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-slate-800 transition-colors">확인</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}