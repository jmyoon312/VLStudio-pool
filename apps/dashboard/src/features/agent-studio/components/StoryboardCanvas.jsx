import React, { useState, useEffect, useRef } from 'react';
import { useAgentStore } from '../store/useAgentStore';
import { Play, Download, Trash2, RefreshCw, MoveVertical, Image as ImageIcon, ChevronDown, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { useExport } from '../../flow2capcut/hooks/useExport';
import { ExportModal } from '../../flow2capcut/components/ExportModal';

const StoryboardCanvas = () => {
  const { scenes, removeScene, updateScene, chapters } = useAgentStore();
  const [refinePrompts, setRefinePrompts] = useState({});
  const [expandedChapters, setExpandedChapters] = useState({});

  // Flow Multi-Profile Manager
  const [profileConfig, setProfileConfig] = useState({ activeProfileId: 'default', profiles: [] });
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef(null);

  const loadFlowProfiles = async () => {
    try {
      const config = await window.electronAPI?.loadProfiles?.();
      if (config) setProfileConfig(config);
    } catch (err) {
      console.error('Failed to load flow profiles:', err);
    }
  };

  const handleProfileSwitch = async (profileId) => {
    setShowProfileDropdown(false);
    try {
      const result = await window.electronAPI?.switchProfile?.({ profileId });
      if (result?.success) {
        await loadFlowProfiles();
      } else {
        alert(`프로필 전환 실패: ${result?.error}`);
      }
    } catch (err) {
      alert(`프로필 전환 에러: ${err.message}`);
    }
  };

  const handleDeleteProfile = async (profileId) => {
    const activeProfile = profileConfig.profiles.find(p => p.id === profileId);
    if (!window.confirm(`정말 "${activeProfile?.name || '선택한'}" 프로필을 삭제하시겠습니까?`)) return;
    try {
      const result = await window.electronAPI?.deleteProfile?.({ profileId });
      if (result?.success) {
        await loadFlowProfiles();
      } else {
        alert(`프로필 삭제 실패: ${result?.error}`);
      }
    } catch (err) {
      alert(`프로필 삭제 에러: ${err.message}`);
    }
  };

  useEffect(() => {
    loadFlowProfiles();
    const handleClickOutsideProfile = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideProfile);
    return () => document.removeEventListener('mousedown', handleClickOutsideProfile);
  }, []);

  // Hook into the same workspace's audioPackage (scanned/loaded in this workspace)
  const savedAudioPath = localStorage.getItem('audioFolderPath');
  const [audioPackage, setAudioPackage] = useState(null);

  useEffect(() => {
    if (savedAudioPath && window.electronAPI?.rescanAudioPackage) {
      window.electronAPI.rescanAudioPackage({ folderPath: savedAudioPath }).then(res => {
        if (res && res.success) {
          setAudioPackage(res);
        }
      }).catch(err => console.warn('Failed to load audio package in Storyboard:', err));
    }
  }, [savedAudioPath]);

  const { 
    showExportModal, 
    setShowExportModal, 
    exporting, 
    exportPhase, 
    handleExportClick, 
    handleExportConfirm 
  } = useExport({
    settings: { aspectRatio: '16:9', projectName: 'Agentic Storyboard', defaultDuration: 3 },
    scenes,
    isAuthenticated: true,
    audioPackage,
  });

  const toggleChapter = (chapterId) => {
    setExpandedChapters(prev => ({
      ...prev,
      [chapterId]: !prev[chapterId]
    }));
  };

  const handleRefine = (id) => {
    const prompt = refinePrompts[id];
    if (!prompt) return;
    
    // Set status to pending/generating
    updateScene(id, { status: 'generating' });
    
    // TODO: Send local refinement prompt to backend via CDP
    setTimeout(() => {
      updateScene(id, { status: 'done', prompt: `[교정됨] ${prompt}` });
    }, 2000);
  };

  // 챕터별로 씬 그룹핑
  const scenesByChapter = {};
  scenes.forEach(scene => {
    const cid = scene.chapterId || 'default';
    if (!scenesByChapter[cid]) scenesByChapter[cid] = [];
    scenesByChapter[cid].push(scene);
  });

  return (
    <div className="flex flex-col flex-1 w-full h-full bg-gray-100 dark:bg-zinc-950">
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">스토리보드 캔버스</h2>
          <p className="text-xs text-gray-500 mt-1">생성된 씬을 정렬하고 교정하세요.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Flow Multi-Profile Selector */}
          <div className="relative" ref={profileDropdownRef}>
            <button
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded border transition-colors ${showProfileDropdown ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-800'}`}
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              title="Flow 구글 계정 프로필 전환"
            >
              <span>👤</span>
              <span className="font-medium max-w-[80px] truncate">
                {profileConfig.profiles.find(p => p.id === profileConfig.activeProfileId)?.name || '프로필'}
              </span>
              <span className="text-[10px] ml-1 opacity-60">{showProfileDropdown ? '▲' : '▼'}</span>
            </button>

            {showProfileDropdown && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xl rounded-lg z-50 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-gray-400">
                  구글 계정 프로필 선택
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {profileConfig.profiles.map(prof => (
                    <div
                      key={prof.id}
                      className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${prof.id === profileConfig.activeProfileId ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                      onClick={() => handleProfileSwitch(prof.id)}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-[10px]">🟢</span>
                        <div className="flex flex-col overflow-hidden">
                          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{prof.name}</span>
                          {prof.email && <span className="text-xs text-gray-500 truncate">{prof.email}</span>}
                        </div>
                      </div>
                      {prof.id !== 'default' && (
                        <button
                          className="ml-2 p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={(e) => { e.stopPropagation(); handleDeleteProfile(prof.id); }}
                          title="프로필 삭제"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button 
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold shadow disabled:opacity-50"
            onClick={handleExportClick}
            disabled={scenes.length === 0 || exporting}
          >
            {exporting ? (
              <RefreshCw size={16} className="mr-2 animate-spin" />
            ) : (
              <Download size={16} className="mr-2" />
            )}
            {exporting ? (exportPhase === 'saving' ? '저장 중...' : '실행 중...') : '내보내기'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex relative custom-scrollbar">
        {chapters.length === 0 && scenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full w-full text-gray-400">
            <ImageIcon size={64} className="mb-4 opacity-50" />
            <p className="text-lg font-medium">아직 기획된 씬이 없습니다.</p>
            <p className="text-sm mt-2">왼쪽 코파일럿 창에서 1만 자 대본을 입력하면 AI가 자동으로 챕터를 분할합니다.</p>
          </div>
        ) : (
          <div className="flex-1 max-w-4xl mx-auto pb-32">
            {chapters.map((chapter) => {
              const chapterScenes = scenesByChapter[chapter.id] || [];
              const isExpanded = expandedChapters[chapter.id] !== false; // 기본적으로 펼침
              
              const completedCount = chapterScenes.filter(s => s.status === 'done').length;
              const isGenerating = chapter.status === 'generating';

              return (
                <div key={chapter.id} id={`chapter-${chapter.id}`} className="mb-6 bg-white dark:bg-zinc-950 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                  {/* Chapter Header (Accordion Toggle) */}
                  <div 
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-900 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    onClick={() => toggleChapter(chapter.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown size={20} className="text-gray-500" /> : <ChevronRight size={20} className="text-gray-500" />}
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">{chapter.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{chapter.summary}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {isGenerating ? (
                        <div className="flex items-center text-blue-500 text-sm font-semibold">
                          <RefreshCw size={14} className="animate-spin mr-1.5" />
                          대본 기획 및 씬 생성 중...
                        </div>
                      ) : (
                        <div className="flex items-center text-green-600 text-sm font-semibold">
                          <CheckCircle2 size={14} className="mr-1.5" />
                          완료 ({completedCount}/{chapterScenes.length})
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chapter Body (Lazy Loaded / Collapsed) */}
                  {isExpanded && (
                    <div className="p-4 space-y-4 bg-gray-100 dark:bg-zinc-950">
                      {chapterScenes.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-xl">
                          AI가 씬 분할 구조를 계산하고 있습니다...
                        </div>
                      ) : (
                        chapterScenes.map((scene, index) => (
                          <div key={scene.id} className="flex bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow relative">
                            
                            {/* I2V vs T2V Indicator */}
                            <div className="absolute top-2 left-2 z-10">
                              {scene.transitionType === 'T2V' ? (
                                <span className="px-2 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded shadow-sm">NEW SCENE</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded shadow-sm">I2V 이어가기</span>
                              )}
                            </div>

                            {/* Drag Handle & Order */}
                            <div className="w-12 bg-gray-50 dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800 flex flex-col items-center justify-center cursor-move text-gray-400 hover:text-gray-600">
                              <span className="text-lg font-bold mb-2">{index + 1}</span>
                              <MoveVertical size={20} />
                            </div>
                            
                            {/* Media Preview */}
                            <div className="w-64 bg-black relative flex-shrink-0">
                              {scene.status === 'generating' ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white">
                                  <RefreshCw className="animate-spin mb-2" size={24} />
                                  <span className="text-xs font-semibold">생성 중...</span>
                                </div>
                              ) : scene.previewUrl ? (
                                <>
                                  {(scene.previewUrl.startsWith('data:video/') || scene.previewUrl.startsWith('data:application/octet-stream') || scene.previewUrl.startsWith('http') || scene.type === 'video' || scene.videoT2V) ? (
                                    <video src={scene.previewUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                                  ) : (
                                    <img src={scene.previewUrl} alt={scene.prompt} className="w-full h-full object-cover" />
                                  )}
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500">
                                  <ImageIcon size={32} />
                                </div>
                              )}
                            </div>

                            {/* Details & Refinement */}
                            <div className="flex-1 p-4 flex flex-col">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1">
                                    [화면 지시문]
                                  </p>
                                  <p className="text-sm text-gray-800 dark:text-gray-200 font-medium line-clamp-2">
                                    {scene.prompt}
                                  </p>
                                </div>
                                <button 
                                  onClick={() => removeScene(scene.id)}
                                  className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 ml-2 flex-shrink-0"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                              
                              <div className="mt-2 bg-gray-50 dark:bg-zinc-950 p-2 rounded-lg border border-gray-100 dark:border-zinc-800">
                                <p className="text-xs text-purple-600 dark:text-purple-400 font-bold mb-1">
                                  [자막/나레이션]
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                                  "{scene.script}"
                                </p>
                              </div>
                              
                              <div className="mt-auto pt-4 flex gap-2">
                                <input
                                  type="text"
                                  className="flex-1 bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                                  placeholder="이 씬만 교정 (예: 배경을 밤으로 변경)"
                                  value={refinePrompts[scene.id] || ''}
                                  onChange={(e) => setRefinePrompts({ ...refinePrompts, [scene.id]: e.target.value })}
                                  onKeyDown={(e) => e.key === 'Enter' && handleRefine(scene.id)}
                                />
                                <button 
                                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium flex items-center"
                                  onClick={() => handleRefine(scene.id)}
                                  disabled={scene.status === 'generating'}
                                >
                                  <RefreshCw size={14} className={`mr-1 ${scene.status === 'generating' ? 'animate-spin' : ''}`} />
                                  교정
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Floating Mini-map Index */}
        {chapters.length > 0 && (
          <div className="absolute right-6 top-6 w-48 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden flex flex-col z-50">
            <div className="bg-gray-50 dark:bg-zinc-950 px-3 py-2 border-b border-gray-200 dark:border-zinc-800">
              <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300">스토리보드 진행률</h4>
            </div>
            <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {chapters.map(chapter => {
                const chapterScenes = scenesByChapter[chapter.id] || [];
                const completedCount = chapterScenes.filter(s => s.status === 'done').length;
                const isGenerating = chapter.status === 'generating';
                
                return (
                  <button 
                    key={chapter.id}
                    onClick={() => {
                      document.getElementById(`chapter-${chapter.id}`)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors flex flex-col gap-1"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-gray-800 dark:text-gray-200 truncate pr-2">{chapter.title}</span>
                      {isGenerating ? (
                        <RefreshCw size={12} className="text-blue-500 animate-spin shrink-0" />
                      ) : (
                        <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                      )}
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full ${isGenerating ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}
                        style={{ width: chapterScenes.length > 0 ? `${(completedCount / chapterScenes.length) * 100}%` : (isGenerating ? '5%' : '100%') }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ExportModal 
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExportConfirm}
        projectName="Agentic Storyboard"
        loading={exporting}
        exportPhase={exportPhase}
        hasSubtitles={true}
      />
    </div>
  );
};

export default StoryboardCanvas;
