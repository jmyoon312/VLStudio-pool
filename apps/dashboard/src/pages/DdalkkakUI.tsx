import React, { useState, useEffect, useRef } from 'react';
import { ExportModal } from '../features/flow2capcut/components/ExportModal';
import { toast } from 'sonner';

declare global {
  interface Window {
    electronAPI?: {
      writeCapcutProject?: (args: any) => Promise<{ success: boolean; error?: string }>;
      openCapcut?: (path?: string) => Promise<{ success: boolean; error?: string }>;
      getSystemInfo?: () => Promise<any>;
      detectCapcutPath?: () => Promise<any>;
      getNextProjectNumber?: (args: any) => Promise<any>;
      checkCapcutInstalled?: () => Promise<{ installed: boolean }>;
    };
  }
}

const DdalkkakUI: React.FC = () => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportPhase, setExportPhase] = useState<'saving' | 'launching' | null>(null);
  const [currentJob, setCurrentJob] = useState<{ type: string; id: number } | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DDALKKAK_EXPORT_CAPCUT') {
        setCurrentJob({ type: event.data.jobType, id: event.data.jobId });
        setIsExportModalOpen(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  /**
   * 내보내기 핸들러
   * - Electron 앱: capcutLocalGenerator.js + electronAPI.writeCapcutProject() 사용 (미디어 일괄생성과 동일)
   * - 크롬 브라우저: Python 백엔드가 직접 파일 기록 (fallback)
   */
  const handleCapCutExport = async (settings: any) => {
    if (!currentJob || isExporting) return;
    setIsExporting(true);
    setExportPhase('saving');

    try {
      const type = currentJob.type;
      const targetPath = settings.capcutProjectNumber?.trim() || '';
      const token = localStorage.getItem('auth_token') || '';

      const isElectron = !!window.electronAPI?.writeCapcutProject;

      if (isElectron) {
        // ===== Electron 앱 모드: capcutLocalGenerator.js 사용 =====
        if (!targetPath) {
          toast.error('내보내기 경로를 설정해주세요.');
          return;
        }

        // 1단계: 백엔드에서 미디어/자막 데이터 가져오기
        const res = await fetch(`/api/ddalkkak/api/${type}/${currentJob.id}/capcut-data`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || `서버 오류: ${res.status}`);
        }
        const jobData = await res.json();

        // 2단계: capcutLocalGenerator.js로 프로젝트 JSON 생성
        const { generateCapcutProject } = await import('../features/flow2capcut/exporters/capcutLocalGenerator');

        const projectForGenerator = {
          name: jobData.project_name || `Ddalkkak_${type}_${currentJob.id}`,
          format: 'portrait',
          scenes: [{
            id: 'scene_1',
            video_path: jobData.video_path,
            video_duration: jobData.duration_sec,
            image_duration: jobData.duration_sec,
            subtitle_ko: '',
            subtitle_en: '',
          }],
          videos: [],
          _ddalkkak: {
            subtitles: jobData.subtitles || [],
            title: jobData.title || null,
            audio_path: jobData.audio_path || null,
            duration_sec: jobData.duration_sec,
          }
        };

        const { draftContent, draftMetaInfo, timelineLayout, extraFiles, mediaFiles } =
          await (generateCapcutProject as any)(projectForGenerator, {
            targetPath,
            projectName: projectForGenerator.name,
            subtitleOption: 'none',
            scaleMode: settings.scaleMode || 'fill',
            kenBurns: false,
          });

        // 3단계: 자막/타이틀/오디오 트랙을 draft_content에 직접 추가
        const ddalkkakData = (projectForGenerator as any)._ddalkkak;

        const generateId = () =>
          Math.random().toString(36).substring(2, 10).toUpperCase() +
          Math.random().toString(36).substring(2, 10).toUpperCase();
        const toMicros = (s: number) => Math.round(s * 1_000_000);

        function addSubtitleTrack(subtitleList: any[], trackName: string) {
          if (!subtitleList.length) return;
          const track: any = { id: generateId(), type: 'text', name: trackName, segments: [] };
          for (const seg of subtitleList) {
            const matId = generateId();
            const textContent = { text: seg.text, styles: [{ range: [0, seg.text.length], size: 8 }] };
            draftContent.materials.texts.push({ id: matId, content: JSON.stringify(textContent), type: 'text' });
            track.segments.push({
              id: generateId(), material_id: matId,
              target_timerange: { start: toMicros(seg.start), duration: toMicros(Math.max(seg.end - seg.start, 0.1)) },
              type: 'text', render_index: 1000
            });
          }
          draftContent.tracks.push(track);
        }

        addSubtitleTrack(ddalkkakData.subtitles.filter((s: any) => s.track === 'situation'), 'situation_desc');
        addSubtitleTrack(ddalkkakData.subtitles.filter((s: any) => s.track === 'jjapjjap'), 'jjapjjap');

        if (ddalkkakData.title) {
          const matId = generateId();
          const titleContent = { text: ddalkkakData.title, styles: [{ range: [0, ddalkkakData.title.length], size: 10 }] };
          draftContent.materials.texts.push({ id: matId, content: JSON.stringify(titleContent), type: 'text' });
          draftContent.tracks.push({
            id: generateId(), type: 'text', name: 'main_title',
            segments: [{ id: generateId(), material_id: matId, target_timerange: { start: 0, duration: toMicros(ddalkkakData.duration_sec) }, type: 'text', render_index: 3000 }]
          });
        }

        if (ddalkkakData.audio_path) {
          const audioMatId = generateId();
          const audioDur = toMicros(ddalkkakData.duration_sec);
          const audioTargetPath = `${targetPath.replace(/\\/g, '/')}/audio_mix.mp3`;
          draftContent.materials.audios.push({ id: audioMatId, path: audioTargetPath, name: 'audio_mix.mp3', duration: audioDur, type: 'extract_music' });
          draftContent.tracks.push({
            id: generateId(), type: 'audio', name: 'SFX/Dub Audio',
            segments: [{ id: generateId(), material_id: audioMatId, source_timerange: { duration: audioDur, start: 0 }, target_timerange: { duration: audioDur, start: 0 }, type: 'audio' }]
          });
        }

        // 오디오 파일 복사 목록 추가
        const allMediaFiles = [...mediaFiles];
        if (ddalkkakData.audio_path) {
          allMediaFiles.push({ source: ddalkkakData.audio_path, isBase64: false, targetName: 'audio_mix.mp3' });
        }

        // 4단계: Electron IPC로 파일 쓰기
        const writeResult = await window.electronAPI!.writeCapcutProject!({
          targetPath, draftInfo: draftContent, draftMetaInfo,
          timelineLayout, extraFiles, mediaFiles: allMediaFiles,
          srtContent: null, srtFilename: null
        });

        if (!writeResult.success) throw new Error(`파일 쓰기 실패: ${writeResult.error}`);

        toast.success('✅ CapCut 내보내기 완료!');
        setExportPhase('launching');

        if (window.electronAPI?.openCapcut) {
          const openResult = await window.electronAPI.openCapcut(targetPath).catch(() => ({ success: false }));
          if (openResult?.success) toast.info('🎬 CapCut이 실행되었습니다!');
          else toast.warning('CapCut을 자동으로 열지 못했습니다. 수동으로 열어주세요.');
        }

      } else {
        // ===== 크롬 브라우저 Fallback: Python 백엔드가 파일 기록 =====
        let endpoint = `/api/ddalkkak/api/${type}/${currentJob.id}/export-capcut`;
        if (targetPath) {
          endpoint += `?target_path=${encodeURIComponent(targetPath)}`;
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || JSON.stringify(data));

        toast.success('✅ CapCut 내보내기 완료!');
        toast.info('💡 데스크톱 앱에서 사용하시면 CapCut이 자동으로 열립니다.');
      }

      await new Promise(r => setTimeout(r, 1500));
      setIsExportModalOpen(false);

    } catch (e: any) {
      toast.error(`내보내기 에러: ${e.message}`);
    } finally {
      setIsExporting(false);
      setExportPhase(null);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border bg-card shadow-sm flex-shrink-0">
        <h1 className="text-2xl font-bold text-foreground">딸깍 자동 생성</h1>
        <p className="text-sm text-muted-foreground mt-1">
          기존 딸깍 인터페이스를 그대로 활용하여 미디어를 일괄 생성합니다.
        </p>
      </div>
      <div className="flex-1 w-full bg-white relative">
        <iframe
          src="/api/ddalkkak/"
          className="w-full h-full border-none absolute inset-0"
          title="Ddalkkak Studio"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
        />
      </div>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => !isExporting && setIsExportModalOpen(false)}
        onExport={handleCapCutExport}
        allowEmptyPath={true}
        loading={isExporting}
        exportPhase={exportPhase}
      />
    </div>
  );
};

export default DdalkkakUI;
