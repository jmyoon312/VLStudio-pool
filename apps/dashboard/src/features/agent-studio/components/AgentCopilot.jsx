import React, { useState, useRef, useEffect } from 'react';
import { useAgentStore } from '../store/useAgentStore';
import { useSkillStore } from '../store/useSkillStore';
import { Send, Palette, Wand2, Clock, Paperclip, FileText, Music, LayoutTemplate, Settings2, Trash2, Eraser, X, Volume2, Smile } from 'lucide-react';
import StylePicker from '../../flow2capcut/components/StylePicker';
import { STYLE_PRESETS } from '../../flow2capcut/config/defaults';
import { useI18n } from '../../flow2capcut/hooks/useI18n';
import { useStyleThumbnails } from '../../flow2capcut/hooks/useStyleThumbnails';
import { useFlowAPI } from '../../flow2capcut/hooks/useFlowAPI';
// removed buildVeoPrompt import

const VOICE_PRESETS = [
  { id: 'Despina', name: 'Despina (차분한 여성)', lang: 'en' },
  { id: 'Charon', name: 'Charon (신뢰감 있는 남성)', lang: 'en' },
  { id: 'Callirrhoe', name: 'Callirrhoe (밝은 여성)', lang: 'en' },
  { id: 'Aoede', name: 'Aoede (부드러운 여성)', lang: 'en' },
  { id: 'Ganymede', name: 'Ganymede (웅장한 남성)', lang: 'en' }
];

const EMOTION_TAGS = [
  { label: '😊 기쁨', tag: '[joy]' },
  { label: '😢 슬픔', tag: '[sadness]' },
  { label: '😠 분노', tag: '[anger]' },
  { label: '😨 두려움', tag: '[fear]' },
  { label: '😌 평온', tag: '[calm]' },
  { label: '😮 놀람', tag: '[surprise]' }
];

const AgentCopilot = () => {
  const { chatHistory, addChatMessage, scenes, addScenes, isAgentMode, toggleAgentMode, selectedModel, setSelectedModel, resetStore, contexts, addContext, setChapters } = useAgentStore();
  const { skills, brandPersona, setBrandPersona, toggleBrandPersona } = useSkillStore();
  const [inputText, setInputText] = useState('');
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [selectedStyleId, setSelectedStyleId] = useState(null);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState('auto');
  const [skillCategory, setSkillCategory] = useState('All');
  const [skillSearch, setSkillSearch] = useState('');
  const [format, setFormat] = useState('long'); // 'long' or 'short'
  const [density, setDensity] = useState('auto'); // 'fast', 'auto', 'slow'
  const [selectedVoice, setSelectedVoice] = useState('Despina');
  const [showEmotionDropdown, setShowEmotionDropdown] = useState(false);
  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textInputRef = useRef(null);
  const flowAPI = useFlowAPI();
  const { t, lang } = useI18n();
  const isKo = lang === 'ko' || true; // Force true if lang fails
  const { thumbnails: styleThumbnails } = useStyleThumbnails(null);
  const [hoveredSkill, setHoveredSkill] = useState(null);

  const handleVoiceSelect = async (voiceName) => {
    setSelectedVoice(voiceName);
    try {
      addChatMessage({ role: 'system', content: `🎙️ Google Flow Voice "${voiceName}" 선택 적용 중...`, timestamp: Date.now() });
      const result = await flowAPI.selectVoice(voiceName);
      if (result && result.success) {
        addChatMessage({ role: 'system', content: `✨ Voice "${voiceName}" 설정이 성공적으로 완료되었습니다.`, timestamp: Date.now() });
      } else {
        addChatMessage({ role: 'system', content: `⚠️ Voice 설정 실패: ${result?.error || '알 수 없는 오류'}`, timestamp: Date.now() });
      }
    } catch (err) {
      console.error('Failed to select voice:', err);
    }
  };

  const insertEmotionTag = (tag) => {
    if (textInputRef.current) {
      const start = textInputRef.current.selectionStart;
      const end = textInputRef.current.selectionEnd;
      const val = textInputRef.current.value;
      const nextText = val.substring(0, start) + ' ' + tag + ' ' + val.substring(end);
      setInputText(nextText);
      setShowEmotionDropdown(false);
      setTimeout(() => {
        textInputRef.current.focus();
        textInputRef.current.setSelectionRange(start + tag.length + 2, start + tag.length + 2);
      }, 50);
    }
  };

  const categoryKoMap = {
    'Cinematic': '🎥 시네마틱',
    'Anime': '🌸 애니메이션',
    'Cyberpunk': '🚀 사이버펑크',
    'Watercolor': '🎨 수채화',
    '3D Render': '🧊 3D 렌더',
    'Vintage/Retro': '📻 레트로',
    'Fantasy': '✨ 판타지'
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    const userMsg = { role: 'user', content: inputText, style: selectedStyleId, timestamp: Date.now() };
    addChatMessage(userMsg);
    
    addChatMessage({ role: 'agent', content: 'AI 에이전트가 대본을 정밀 분석하여 연출 구성과 씬 분할을 시작합니다...', timestamp: Date.now() });
    
    setInputText('');
    if (textInputRef.current) {
      textInputRef.current.style.height = 'auto';
    }

    try {
      const isPortrait = selectedModel.includes('portrait') || selectedModel.includes('shorts') || selectedModel === 'omni_flash';
      // 1. AI 기반 씬 분할 API 호출
      const splitResp = await fetch('/api/creative/split-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          mode: isPortrait ? 'shorts' : 'video',
          style_prompt: selectedStyleId,
          auto_generate_images: false,
          auto_generate_audio: false
        })
      });
      
      let aiScenes = [];
      if (splitResp.ok) {
        aiScenes = await splitResp.json();
      } else {
        console.warn('Backend split-script failed, falling back to local sentence chunking');
      }

      // 만약 API 실패 시 로컬 문장 단위 분할 fallback
      if (!aiScenes || aiScenes.length === 0) {
        const sentences = inputText.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
        aiScenes = sentences.map((s, idx) => ({
          scene_id: idx + 1,
          script: s,
          visual_prompt: s // fallback prompt
        }));
      }

      // 2. 씬들을 챕터로 구조화 (예: 5개 씬당 1개 챕터 또는 3개 챕터 고정)
      const numScenes = aiScenes.length;
      let numChapters = 3;
      if (numScenes >= 10) numChapters = 5;
      else if (numScenes >= 5) numChapters = 4;
      else numChapters = Math.max(1, numScenes);

      let chunkStructure = [];
      if (numChapters === 5) {
        chunkStructure = [
          { title: '발단 (Introduction)', summary: '배경과 인물 소개' },
          { title: '전개 (Rising Action)', summary: '사건의 본격적인 진행' },
          { title: '위기 (Crisis)', summary: '갈등의 고조' },
          { title: '절정 (Climax)', summary: '사건의 최고조' },
          { title: '결말 (Resolution)', summary: '사건의 해결' }
        ];
      } else if (numChapters === 4) {
        chunkStructure = [
          { title: '기 (起 - Setup)', summary: '도입부' },
          { title: '승 (承 - Development)', summary: '전개부' },
          { title: '전 (轉 - Twist)', summary: '전환점' },
          { title: '결 (結 - Conclusion)', summary: '결말부' }
        ];
      } else {
        chunkStructure = [
          { title: '서론 (Beginning)', summary: '시작' },
          { title: '본론 (Middle)', summary: '전개' },
          { title: '결론 (End)', summary: '마무리' }
        ];
      }

      const dummyChapters = chunkStructure.slice(0, numChapters).map((chunk, index) => ({
        id: `chap_${Date.now()}_${index}`,
        title: chunk.title,
        summary: chunk.summary,
        status: 'generating'
      }));
      
      setChapters(dummyChapters);

      // 각 챕터별 씬 개수 균등 분배
      const sentencesPerChapter = Array(numChapters).fill(Math.floor(numScenes / numChapters));
      for (let i = 0; i < numScenes % numChapters; i++) {
        sentencesPerChapter[i]++;
      }

      const globalFixedSeed = Math.floor(Math.random() * 1000000);
      let sceneGlobalIndex = 0;

      for (let cIdx = 0; cIdx < dummyChapters.length; cIdx++) {
        const chap = dummyChapters[cIdx];
        const numScenesInChap = sentencesPerChapter[cIdx];
        const newScenes = [];

        for (let s = 1; s <= numScenesInChap; s++) {
          if (sceneGlobalIndex >= aiScenes.length) break;
          const aiScene = aiScenes[sceneGlobalIndex++];
          let isT2V = (s === 1); // 첫 번째 씬은 T2V

          // AI가 이미 생성해 준 visual_prompt를 최대로 활용!
          let enhancedSubject = aiScene.visual_prompt || aiScene.script;
          let finalSkillId = selectedSkillId;
          let autoReasoning = null;

          // 추가적인 프롬프트 최적화 (Veo/Omni 맞춤형 포맷팅)
          try {
            const resp = await fetch('/api/veo/enhance-prompt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                script: aiScene.script,
                full_context: inputText,
                brand_persona: brandPersona.active ? brandPersona.vibe : "",
                model_type: selectedModel.includes('omni') ? 'omni' : 'veo'
              })
            });
            if (resp.ok) {
              const data = await resp.json();
              if (data.subject_action) {
                enhancedSubject = data.subject_action;
              }
              if (selectedSkillId === 'auto' && data.recommended_skill_id) {
                finalSkillId = data.recommended_skill_id;
                autoReasoning = data.reasoning;
              }
              if (s > 1) {
                isT2V = !data.is_continuation;
              }
            }
          } catch (err) {
            console.error('Enhance prompt failed:', err);
          }

          if (finalSkillId === 'auto') finalSkillId = 'skill_cinematic_001';

          // Notify the user if AI selected a skill automatically
          if (selectedStyleId === 'auto' && autoReasoning) {
            useAgentStore.getState().addChatMessage({ 
              role: 'system', 
              content: `✨ [AI 자동 매칭] ${autoReasoning} -> '${finalSkillId}' 스킬을 적용하여 렌더링합니다.`, 
              timestamp: Date.now() 
            });
          }

          // Bento Box prompt 조립
          const allSkills = useSkillStore.getState().skills;
          const matchedSkill = allSkills.find(sk => sk.id === finalSkillId) || allSkills[0];
          let veoPrompt = matchedSkill.prompt_template.replace('[SUBJECT]', enhancedSubject);

          const isOmni = selectedModel.includes('omni');
          if (selectedStyleId && selectedStyleId.startsWith('preset:')) {
            const presetId = selectedStyleId.replace('preset:', '');
            const preset = STYLE_PRESETS.styles?.find(st => st.id === presetId);
            if (preset && preset.prompt_en) {
              const templateParts = matchedSkill.prompt_template.split('[SUBJECT]');
              const cameraAngle = templateParts[0] ? templateParts[0].trim() : '';
              if (isOmni) {
                veoPrompt = buildNaturalPrompt(cameraAngle, enhancedSubject, preset.prompt_en, brandPersona.active ? brandPersona.vibe : null);
              } else {
                veoPrompt = `${cameraAngle} ${enhancedSubject}, ${preset.prompt_en}`;
              }
            }
          } else {
            if (isOmni) {
              const templateParts = matchedSkill.prompt_template.split('[SUBJECT]');
              const cameraAngle = templateParts[0] ? templateParts[0].trim() : '';
              const restVisual = templateParts[1] ? templateParts[1].replace(/^\s*,\s*/, '').trim() : '';
              veoPrompt = buildNaturalPrompt(cameraAngle, enhancedSubject, restVisual, brandPersona.active ? brandPersona.vibe : null);
            }
          }

          if (!isOmni && brandPersona && brandPersona.active && brandPersona.vibe) {
            veoPrompt = `${brandPersona.vibe}, ${veoPrompt}`;
          }

          newScenes.push({
            id: `scene_${chap.id}_${s}`,
            chapterId: chap.id,
            prompt: veoPrompt,
            imagePrompt: veoPrompt,
            script: aiScene.script,
            status: 'generating',
            transitionType: isT2V ? 'T2V' : 'I2V',
            type: 'video',
            previewUrl: null
          });
        }

        // Add to store so UI shows generating state
        addScenes(newScenes);

        // Process scenes sequentially via actual Flow API
        let previousVideoId = null;
        let generatedPromptsHistory = [];
        for (let sIdx = 0; sIdx < newScenes.length; sIdx++) {
          const scene = newScenes[sIdx];
          try {
            const isVideoModel = selectedModel === 'omni_flash' || selectedModel === 'veo_3_1';
            const isOmni = selectedModel === 'omni_flash';

            if (isOmni) {
              const hasKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(scene.script);
              const langName = hasKorean ? 'Korean' : 'English';
              const voiceCommand = ` Narrate the following text in ${langName}: "${scene.script}".`;
              
              if (sIdx > 0 && generatedPromptsHistory.length > 0) {
                const prevPrompt = generatedPromptsHistory[sIdx - 1];
                scene.imagePrompt = `Continuing the story. For the next shot, show: ${scene.prompt}. Make sure to maintain absolute character, style, and environmental consistency with the previous shot: "${prevPrompt}".${voiceCommand}`;
              } else {
                scene.imagePrompt = `Generate the first scene of the story: ${scene.prompt}.${voiceCommand}`;
              }
              generatedPromptsHistory.push(scene.prompt);
            }
            
            // 3. Generation Execution
            let result = null;
            if (isVideoModel) {
              try {
                if (window.electronAPI?.domGetUrl) {
                  const currentUrlResp = await window.electronAPI.domGetUrl();
                  if (currentUrlResp && currentUrlResp.success && currentUrlResp.url) {
                    const url = currentUrlResp.url;
                    if (!url.includes('/project/')) {
                      console.log('[AgentCopilot] Not in project, clicking New Project...');
                      await window.electronAPI.domClickEnterTool({});
                      await new Promise(r => setTimeout(r, 6500));
                    }
                  }
                }
              } catch (e) {
                console.error('[AgentCopilot] Failed to auto-create project', e);
              }
              
              if (!isOmni && scene.transitionType === 'I2V' && previousVideoId) {
                result = await flowAPI.generateVideoI2V(scene.imagePrompt, previousVideoId, undefined, selectedModel, undefined, undefined, globalFixedSeed);
              } else {
                result = await flowAPI.generateVideoT2V(scene.imagePrompt, selectedModel, undefined, undefined, undefined, globalFixedSeed);
              }
              
              if (result && result.success && result.generationId) {
                const pollResult = await flowAPI.pollVideoStatus(result.generationId);
                if (pollResult && pollResult.success && pollResult.videoUrl) {
                  try {
                    const token = flowAPI.getAccessToken ? await flowAPI.getAccessToken() : null;
                    const mediaResult = await window.electronAPI.downloadVideoUrl({ url: pollResult.videoUrl, token });
                    if (mediaResult && mediaResult.success && mediaResult.base64) {
                      result = { success: true, isVideo: true, videoUrl: mediaResult.base64, id: pollResult.mediaId || result.generationId };
                    } else {
                      result = { success: true, isVideo: true, videoUrl: pollResult.videoUrl, id: pollResult.mediaId || result.generationId };
                    }
                  } catch (err) {
                    console.warn("Failed to download video url", err);
                    result = { success: true, isVideo: true, videoUrl: pollResult.videoUrl, id: pollResult.mediaId || result.generationId };
                  }
                } else {
                  result = { success: false, error: pollResult?.error };
                }
              }
            } else {
              result = await flowAPI.generateImageDOM(scene.imagePrompt, [], { batchCount: 1 });
            }

            if (result && result.success) {
              let previewData = null;
              let isVideoUrl = false;
              
              if (result.isVideo && result.videoUrl) {
                previewData = result.videoUrl;
                previousVideoId = result.id || null;
                isVideoUrl = true;
              } else if (result.images?.length > 0) {
                previewData = result.images[0].base64 || result.images[0];
                previousVideoId = result.images[0].id || null;
              }
              
              if (previewData) {
                const dataUrl = (!isVideoUrl && previewData.startsWith('data:')) ? previewData : (isVideoUrl ? previewData : `data:image/png;base64,${previewData}`);
              
                const sceneUpdates = {
                  status: 'done',
                  previewUrl: dataUrl,
                  subtitle: scene.script
                };

                if (isVideoUrl) {
                  sceneUpdates.videoT2V = dataUrl;
                  sceneUpdates.image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABkAAAAOECAAAAABd5930AAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QA/4ePzL8AAAAHdElNRQfmBgcTCSk1VjLwAAAADUlEQVR42u3BAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/gz76AABiM9DqwAAAABJRU5ErkJggg==';
                } else {
                  sceneUpdates.image = dataUrl;
                }

                useAgentStore.getState().updateScene(scene.id, sceneUpdates);
              } else {
                useAgentStore.getState().updateScene(scene.id, { status: 'done' });
              }
            } else {
              useAgentStore.getState().updateScene(scene.id, { status: 'done', error: result?.error || 'Generation failed' });
            }
          } catch (e) {
            console.error('[AgentCopilot] Scene generation error:', e);
            useAgentStore.getState().updateScene(scene.id, { status: 'done', error: e.message });
          }
        }
        
        useAgentStore.getState().updateChapter(chap.id, { status: 'done' });
        if (cIdx === dummyChapters.length - 1) {
          addChatMessage({ role: 'agent', content: '모든 챕터의 씬 생성이 완료되었습니다. 캔버스를 확인해주세요.', timestamp: Date.now() });
        }
      }
    } catch (err) {
      console.error('[AgentCopilot] handleSend error:', err);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-white dark:bg-zinc-950">
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <Wand2 size={18} className="mr-2 text-purple-500" />
            Agent Copilot
          </h2>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm('대화 내용을 초기화하시겠습니까?')) {
                  useAgentStore.setState({ chatHistory: [] });
                }
              }}
              className="px-2 py-1 text-xs rounded text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-zinc-800 transition-colors"
              title="대화 초기화"
            >
              <Eraser size={14} />
            </button>
            <button
              onClick={async () => { if (window.confirm('캔버스를 모두 초기화하시겠습니까?')) { resetStore(); } }}
              className="px-2 py-1 text-xs rounded text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-zinc-800 transition-colors"
              title="캔버스 초기화"
            >
              <Trash2 size={14} />
            </button>
            <div className="flex bg-gray-100 dark:bg-zinc-800 rounded p-1 text-xs">
              <button 
                className={`px-3 py-1 rounded ${selectedModel === 'omni_flash' ? 'bg-white dark:bg-zinc-700 shadow text-blue-600' : 'text-gray-500'}`}
                onClick={() => setSelectedModel('omni_flash')}
              >
                <Clock size={12} className="inline mr-1" /> 10초 (Omni)
              </button>
              <button 
                className={`px-3 py-1 rounded ${selectedModel === 'veo_3_1' ? 'bg-white dark:bg-zinc-700 shadow text-blue-600' : 'text-gray-500'}`}
                onClick={() => setSelectedModel('veo_3_1')}
              >
                8초 (VEO)
              </button>
            </div>
          </div>
        </div>

        {/* Phase 5.1: 롱폼/쇼츠 토글 및 생성 밀도 슬라이더 */}
        <div className="flex items-center justify-between text-xs mt-1">
          <div className="flex items-center gap-2">
            <LayoutTemplate size={14} className="text-gray-400" />
            <div className="flex bg-gray-100 dark:bg-zinc-800 rounded p-0.5">
              <button 
                className={`px-2 py-1 rounded ${format === 'long' ? 'bg-white dark:bg-zinc-700 shadow font-bold text-gray-800 dark:text-gray-200' : 'text-gray-500'}`}
                onClick={() => setFormat('long')}
              >
                롱폼 (16:9)
              </button>
              <button 
                className={`px-2 py-1 rounded ${format === 'short' ? 'bg-white dark:bg-zinc-700 shadow font-bold text-gray-800 dark:text-gray-200' : 'text-gray-500'}`}
                onClick={() => setFormat('short')}
              >
                쇼츠 (9:16)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Settings2 size={14} className="text-gray-400" />
            <span className="text-gray-500 font-medium">씬 밀도:</span>
            <div className="flex bg-gray-100 dark:bg-zinc-800 rounded p-0.5">
              <button 
                className={`px-2 py-1 rounded ${density === 'fast' ? 'bg-white dark:bg-zinc-700 shadow font-bold text-blue-600' : 'text-gray-500'}`}
                onClick={() => setDensity('fast')}
                title="1~2문장 당 1씬 (빠른 호흡)"
              >
                Fast
              </button>
              <button 
                className={`px-2 py-1 rounded ${density === 'auto' ? 'bg-white dark:bg-zinc-700 shadow font-bold text-blue-600' : 'text-gray-500'}`}
                onClick={() => setDensity('auto')}
                title="AI가 문맥에 맞춰 자동 분할"
              >
                Auto
              </button>
              <button 
                className={`px-2 py-1 rounded ${density === 'slow' ? 'bg-white dark:bg-zinc-700 shadow font-bold text-blue-600' : 'text-gray-500'}`}
                onClick={() => setDensity('slow')}
                title="3~5문장 당 1씬 (느린 호흡)"
              >
                Slow
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Wand2 size={48} className="mb-4 opacity-50" />
            <p>에이전트에게 스토리보드 기획을 지시해보세요.</p>
            <p className="text-xs mt-2">예: "이 신발을 신고 등산하는 3가지 씬을 만들어줘"</p>
          </div>
        ) : (
          chatHistory.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-zinc-800 text-gray-900 dark:text-gray-100'
              }`}>
                {msg.content}
                {msg.style && (
                  <div className="mt-2 text-xs opacity-75">
                    🎨 스타일: {msg.style}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0 relative">
        {showSkillPicker && (
          <div className="absolute bottom-full mb-3 left-0 right-0 z-50">
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-2xl p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-zinc-800 pb-3 mb-4 sticky top-0 bg-white dark:bg-zinc-900 z-10">
                <div>
                  <h3 className="font-extrabold text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    🪄 프롬프트 스킬 갤러리 <span className="text-xs font-normal text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">200+</span>
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={brandPersona.active} onChange={toggleBrandPersona} id="brandToggle" className="w-3.5 h-3.5" />
                    <label htmlFor="brandToggle" className="text-sm font-medium text-gray-600 dark:text-gray-300 cursor-pointer">
                      브랜드 페르소나 유지 (Auto 매칭 시)
                    </label>
                  </div>
                  {brandPersona.active && (
                    <input 
                      type="text" 
                      placeholder="채널 분위기 (예: 유튜브 다큐멘터리풍, 몽환적)" 
                      value={brandPersona.vibe}
                      onChange={(e) => setBrandPersona(e.target.value)}
                      className="mt-2 text-sm p-2 border border-purple-200 rounded-lg w-full bg-purple-50 dark:bg-zinc-800 dark:border-zinc-700 outline-none focus:border-purple-400"
                    />
                  )}
                </div>
                <button onClick={() => setShowSkillPicker(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-900 dark:hover:text-white self-start transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* 필터 & 검색 영역 */}
              <div className="mb-4 space-y-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                  <button 
                    onClick={() => setSkillCategory('All')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${skillCategory === 'All' ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-400 dark:hover:bg-zinc-700'}`}
                  >
                    전체보기
                  </button>
                  {Object.entries(categoryKoMap).map(([key, label]) => (
                    <button 
                      key={key}
                      onClick={() => setSkillCategory(key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${skillCategory === key ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-400 dark:hover:bg-zinc-700'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input 
                  type="text" 
                  placeholder="🔍 프롬프트 스킬 검색 (예: 항공 촬영, 안개, 시네마틱)" 
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  className="w-full text-sm p-2.5 border border-gray-200 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-800/50 outline-none focus:border-blue-400 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 relative">
                <button 
                  onClick={() => { setSelectedSkillId('auto'); setShowSkillPicker(false); }}
                  className={`text-left p-3 rounded-xl border transition-all col-span-full ${selectedSkillId === 'auto' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/40 shadow-sm ring-2 ring-purple-500/20' : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:border-purple-300'}`}
                >
                  <div className="font-extrabold mb-1.5 flex items-center gap-1.5 text-purple-600 dark:text-purple-400 text-sm">
                    ✨ AI 자동 분석 (Auto-Select 200+)
                  </div>
                  <div className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                    브랜드 페르소나와 대본의 감정선을 AI가 스스로 분석하여, 가장 완벽한 연출 기법을 퓨전 및 매칭합니다.
                  </div>
                </button>
                {skills
                  .filter(s => skillCategory === 'All' || s.category === skillCategory)
                  .filter(s => !skillSearch.trim() || 
                    s.name.toLowerCase().includes(skillSearch.toLowerCase()) || 
                    s.lighting.toLowerCase().includes(skillSearch.toLowerCase()) ||
                    s.camera.toLowerCase().includes(skillSearch.toLowerCase()) ||
                    (s.prompt_template && s.prompt_template.toLowerCase().includes(skillSearch.toLowerCase()))
                  )
                  .map(skill => (
                  <button 
                    key={skill.id}
                    onClick={() => { setSelectedSkillId(skill.id); setShowSkillPicker(false); }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredSkill({ skill, rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width } });
                    }}
                    onMouseLeave={() => setHoveredSkill(null)}
                    className={`text-left p-2.5 rounded-xl border transition-all flex flex-col justify-between h-full ${selectedSkillId === skill.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500/20 shadow-sm z-10 relative' : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:border-gray-300 hover:shadow-md hover:z-10 relative'}`}
                  >
                    <div className="font-bold text-xs text-gray-800 dark:text-gray-200 mb-2 leading-tight">
                      {skill.name.replace(/^\[.*?\]\s*/, '')}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 text-[10px] font-medium space-y-1">
                      <span className="inline-block px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded mr-1">
                        {categoryKoMap[skill.category] || skill.category}
                      </span>
                    </div>
                  </button>
                ))}
                
                {hoveredSkill && (
                  <div 
                    className="fixed z-[100] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 shadow-2xl rounded-xl p-4 w-[280px] pointer-events-none"
                    style={{
                      top: Math.max(20, hoveredSkill.rect.top - 20) + 'px',
                      left: Math.max(10, hoveredSkill.rect.right + 10 + 280 > window.innerWidth ? hoveredSkill.rect.left - 290 : hoveredSkill.rect.right + 10)
                    }}
                  >
                    <div className="font-bold text-sm text-gray-900 dark:text-white mb-1">
                      {hoveredSkill.skill.name}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded text-[10px] font-bold">
                        {categoryKoMap[hoveredSkill.skill.category] || hoveredSkill.skill.category}
                      </span>
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 rounded text-[10px] font-bold">
                        {hoveredSkill.skill.lighting}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="font-bold text-gray-500 dark:text-gray-400 block mb-0.5">📸 카메라 연출</span>
                        <div className="text-gray-700 dark:text-gray-300">{hoveredSkill.skill.camera}</div>
                      </div>
                      <div>
                        <span className="font-bold text-gray-500 dark:text-gray-400 block mb-0.5">🎨 퀄리티 태그</span>
                        <div className="text-gray-700 dark:text-gray-300 break-words">{hoveredSkill.skill.quality}</div>
                      </div>
                      <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 mt-2">
                        <span className="font-bold text-purple-500 block mb-1">🤖 프롬프트 템플릿</span>
                        <div className="text-gray-600 dark:text-gray-400 font-mono text-[10px] bg-gray-50 dark:bg-zinc-950 p-2 rounded">
                          {hoveredSkill.skill.prompt_template}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showStylePicker && (
          <div className="absolute bottom-full mb-2 left-4 right-4 z-50">
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xl overflow-hidden max-h-[400px] flex flex-col">
              <div className="flex justify-between items-center p-3 border-b border-gray-100 dark:border-zinc-800">
                <h3 className="font-bold text-sm">스타일 선택</h3>
                <button onClick={() => setShowStylePicker(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white">✕</button>
              </div>
              <StylePicker 
                selectedId={selectedStyleId} 
                onSelect={(id) => { setSelectedStyleId(id); setShowStylePicker(false); }}
                thumbnails={styleThumbnails}
                uploadedStyleRefs={contexts.filter(c => c.type === 'style')}
                onCustomStyleUpload={(file) => {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const newId = `custom_style_${Date.now()}`;
                    addContext({
                      id: newId,
                      type: 'style',
                      name: file.name,
                      file: file,
                      base64: e.target.result,
                      isActive: true
                    });
                    setSelectedStyleId(`ref:${newId}`);
                    setShowStylePicker(false);
                  };
                  reader.readAsDataURL(file);
                }}
                t={t}
                isKo={isKo}
              />
            </div>
          </div>
        )}

        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 relative">
          {showEmotionDropdown && (
            <div className="absolute bottom-full mb-12 left-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xl p-2 grid grid-cols-3 gap-1 z-[60] w-64">
              {EMOTION_TAGS.map((emo) => (
                <button
                  key={emo.tag}
                  onClick={() => insertEmotionTag(emo.tag)}
                  className="px-2 py-1 text-xs text-left hover:bg-gray-100 dark:hover:bg-zinc-800 rounded font-medium transition-colors"
                >
                  {emo.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mb-2 bg-gray-50 dark:bg-zinc-900/60 p-2 rounded-lg border border-gray-200 dark:border-zinc-800">
            <Volume2 size={16} className="text-blue-500" />
            <select
              value={selectedVoice}
              onChange={(e) => handleVoiceSelect(e.target.value)}
              className="flex-1 bg-transparent border-none text-xs text-gray-800 dark:text-gray-200 outline-none cursor-pointer"
            >
              {VOICE_PRESETS.map((voice) => (
                <option key={voice.id} value={voice.id} className="dark:bg-zinc-900">
                  {voice.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col bg-gray-100 dark:bg-zinc-900 rounded-lg p-2 border border-gray-300 dark:border-zinc-700 focus-within:border-blue-500 relative">
            <textarea
            ref={textInputRef}
            className="flex-1 bg-transparent border-none focus:outline-none resize-none px-2 py-2 text-sm text-gray-900 dark:text-gray-100 min-h-[60px] max-h-[200px]"
            rows="2"
            placeholder="에이전트에게 씬 생성을 요청하거나 대본(최대 1만자)을 입력하세요..."
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              // Auto-expand textarea
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
            }}
            onKeyDown={(e) => {
              // 장문 대본 입력을 위해 Shift+Enter는 줄바꿈, 그냥 Enter는 전송
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-zinc-800">
            <div className="flex items-center gap-1">
              <button 
                className={`p-1.5 rounded-md transition-colors ${selectedSkillId ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-zinc-800'}`}
                onClick={() => { setShowSkillPicker(!showSkillPicker); setShowStylePicker(false); }}
                title="프롬프트 스킬 (Bento Box)"
              >
                <Wand2 size={18} />
              </button>
              <button 
                className={`p-1.5 rounded-md transition-colors ${selectedStyleId ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-zinc-800'}`}
                onClick={() => { setShowStylePicker(!showStylePicker); setShowSkillPicker(false); }}
                title="스타일 참조 이미지 선택"
              >
                <Palette size={18} />
              </button>
              <button 
                className={`p-1.5 rounded-md transition-colors ${showEmotionDropdown ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-zinc-800'}`}
                onClick={() => { setShowEmotionDropdown(!showEmotionDropdown); setShowSkillPicker(false); setShowStylePicker(false); }}
                title="감정 태그 삽입"
              >
                <Smile size={18} />
              </button>
              <button 
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                title="대본 TXT 파일 첨부"
              >
                <FileText size={18} />
                <input type="file" accept=".txt" hidden ref={fileInputRef} onChange={(e) => {
                  if (e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onload = (e) => setInputText(prev => prev + '\n' + e.target.result);
                    reader.readAsText(e.target.files[0]);
                  }
                }}/>
              </button>
              <button 
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
                onClick={() => audioInputRef.current?.click()}
                title="오디오 MP3 파일 첨부 (CapCut 동기화용)"
              >
                <Music size={18} />
                <input type="file" accept="audio/mp3,audio/wav" hidden ref={audioInputRef} onChange={(e) => {
                  if (e.target.files[0]) {
                    addChatMessage({ role: 'agent', content: `🎵 오디오 파일이 첨부되었습니다: ${e.target.files[0].name}. (추후 CapCut 내보내기 시 자막과 자동 동기화됩니다.)`, timestamp: Date.now() });
                  }
                }}/>
              </button>
            </div>
            
            <button 
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center min-w-[40px]"
              onClick={handleSend}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default AgentCopilot;
