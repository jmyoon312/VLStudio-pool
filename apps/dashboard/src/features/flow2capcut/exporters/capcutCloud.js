/**
 * CapCut Cloud Exporter — Electron Desktop Edition
 *
 * Cloud Functions를 통해 JSON 생성하고 Electron IPC로 디스크에 직접 쓰기
 * - 서버 전송: 메타데이터만 (~100KB)
 * - 로컬 처리: 미디어 파일을 수집 후 IPC로 디스크 기록
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { fileSystemAPI } from '../hooks/useFileSystem';
import { cleanBase64 as stripBase64Prefix } from '../utils/urls';
import { APP_ID } from '@/firebase/config';

/**
 * base64 데이터에서 이미지 크기 추출
 */
function getImageSizeFromBase64(base64Data) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      resolve(null); // 실패 시 null 반환
    };
    if (!base64Data.startsWith('data:')) {
      base64Data = `data:image/png;base64,${base64Data}`;
    }
    img.src = base64Data;
  });
}

/**
 * base64 시그니처로 이미지 확장자 감지
 */
function detectImageExtension(base64Data) {
  if (!base64Data) return 'png';
  const clean = base64Data.replace(/^data:[^;]+;base64,/, '');
  if (clean.startsWith('/9j/')) return 'jpg';
  if (clean.startsWith('iVBOR')) return 'png';
  if (clean.startsWith('R0lGOD')) return 'gif';
  if (clean.startsWith('UklGR')) return 'webp';
  return 'png';
}

/**
 * 파일 경로인지 체크
 */
function isFilePath(data) {
  if (!data) return false;
  if (data.startsWith('data:')) return false;
  if (data.startsWith('http')) return false;
  if (data.startsWith('/9j/') || data.startsWith('iVBOR') ||
      data.startsWith('AAAA') || data.startsWith('//u') || data.startsWith('SUQ')) {
    return false;
  }
  return data.includes('/') || data.includes('\\');
}

/**
 * 파일명 생성
 */
function getFilename(path, sceneId, type) {
  if (!path) return `${type}_${sceneId}.bin`;

  if (path.startsWith('data:')) {
    const mimeMatch = path.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const extMap = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav'
    };
    const ext = extMap[mime] || 'bin';
    return `${type}_${sceneId}.${ext}`;
  }

  if (path.startsWith('/9j/') || path.startsWith('iVBOR') ||
      path.startsWith('R0lGOD') || path.startsWith('UklGR')) {
    const ext = detectImageExtension(path);
    return `${type}_${sceneId}.${ext}`;
  }

  if (isFilePath(path)) {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || `${type}_${sceneId}.bin`;
  }

  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || `${type}_${sceneId}.bin`;
}

/**
 * 프로젝트 데이터를 Cloud Functions용 포맷으로 변환
 */
async function prepareCloudRequest(project, options = {}) {
  const {
    scaleMode = 'fill',  // 'fill' | 'fit' | 'none'
    kenBurns = false,
    kenBurnsMode = 'random',
    kenBurnsCycle = 5,
    kenBurnsScaleMin = 1.0,  // 스케일 최소값 (1.0 = 100%)
    kenBurnsScaleMax = 1.3, // 스케일 최대값 (1.3 = 130%)
    subtitleOption = 'both',
    subtitleFontSize = 8,
    capcutProjectNumber = '',
    audioPackage = null
  } = options;

  const scenes = project.scenes && project.scenes.length > 0 
    ? project.scenes 
    : [{ 
        id: 'scene_1', 
        subtitle_ko: 'Debug Scene', 
        image_duration: 3, 
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABkAAAAOECAAAAABd5930AAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QA/4ePzL8AAAAHdElNRQfmBgcTCSk1VjLwAAAADUlEQVR42u3BAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/gz76AABiM9DqwAAAABJRU5ErkJggg==' // Standard 1920x1080 solid black PNG
      }]; 
  const format = project.format || 'landscape';

  // 씬 메타데이터 준비 — 이미지 트랙(기본) + 영상 트랙(선택) 분리
  const cloudScenes = [];
  const cloudVideoOverlays = []; // 영상 오버레이 (씬 뒤쪽 배치)
  const mediaFiles = []; // 로컬에서 처리할 미디어 파일 정보

  let cumulativeTime = 0; // 씬 시작 시간 누적 (ms)

  for (let index = 0; index < scenes.length; index++) {
    const scene = scenes[index];
    const sceneId = scene.id || `scene_${index + 1}`;
    let imageSize = scene.upscaled_size || scene.image_size;
    const sceneDuration = scene.image_duration || 3;

    // 이미지 (항상 존재)
    const imagePath = scene.image_path || scene.media_path || scene.image;
    const fallback = scene.image_fallback || scene.image;

    if (!imagePath && !fallback) { cumulativeTime += sceneDuration * 1000; continue; }

    const imageFilename = getFilename(imagePath, sceneId, 'image');

     // image_size가 없으면 실제 이미지 파일에서 크기 추출
    if (!imageSize && imagePath) {
      try {
        imageSize = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.onerror = () => resolve(null);
          img.src = imagePath.startsWith('/') ? `file://${imagePath}` : imagePath;
        });
        if (imageSize) {
          console.log(`[CapCut Cloud] Image size from file: ${imageSize.width}x${imageSize.height} (${sceneId})`);
        }
      } catch (e) { /* ignore */ }
    }
    // fallback: base64에서 추출
    if (!imageSize && fallback) {
      imageSize = await getImageSizeFromBase64(fallback);
      if (imageSize) {
        console.log(`[CapCut Cloud] Extracted size from base64: ${imageSize.width}x${imageSize.height}`);
      }
    }
    const imgWidth = imageSize?.width || 1024;
    const imgHeight = imageSize?.height || 1024;

    cloudScenes.push({
      id: sceneId,
      type: 'image',
      filename: imageFilename,
      width: imgWidth,
      height: imgHeight,
      duration: sceneDuration,
      subtitleKo: scene.subtitle_ko || null,
      subtitleEn: scene.subtitle_en || null
    });

    mediaFiles.push({
      sceneId,
      type: 'image',
      filename: imageFilename,
      path: imagePath,
      fallback
    });

    // 영상 오버레이 (있으면 배치: 영상이 짧으면 씬 뒤쪽, 영상이 길면 처음부터 씬 길이만큼 자름)
    const videoPath = scene.video_path;
    const videoDuration = scene.video_duration || 0;
    if (videoPath && videoDuration > 0) {
      const videoFilename = getFilename(videoPath, sceneId, 'video');
      const clipDuration = Math.min(videoDuration, sceneDuration); // 씬 길이 초과 시 자름
      const videoStartMs = videoDuration < sceneDuration
        ? cumulativeTime + (sceneDuration - videoDuration) * 1000  // 영상이 짧으면 뒤쪽 배치
        : cumulativeTime;  // 영상이 길면 처음부터 시작

      cloudVideoOverlays.push({
        sceneId,
        filename: videoFilename,
        width: imgWidth,  // 영상도 동일 캔버스
        height: imgHeight,
        durationMs: clipDuration * 1000,
        startMs: videoStartMs
      });

      mediaFiles.push({
        sceneId,
        type: 'video',
        filename: videoFilename,
        path: videoPath,
        fallback: null
      });
    }

    cumulativeTime += sceneDuration * 1000;
  }

  // SFX 메타데이터 준비
  const cloudSfxItems = [];
  const sfxFiles = [];

  scenes.forEach((scene, index) => {
    const sceneId = scene.id || `scene_${index + 1}`;
    if (scene.sfx_path) {
      const filename = getFilename(scene.sfx_path, sceneId, 'sfx');
      cloudSfxItems.push({
        sceneId,
        filename,
        duration: scene.sfx_duration || 3
      });
      sfxFiles.push({
        sceneId,
        filename,
        path: scene.sfx_path
      });
    }
  });

  // mediaPathBase — 항상 'media'로 고정 (데스크톱 모드: 클라이언트에서 절대경로로 치환)
  const mediaPathBase = 'media';

  // OS 감지 (Windows vs macOS)
  const detectedOS = (() => {
    try {
      if (navigator.userAgentData?.platform) return navigator.userAgentData.platform;
      if (/Win/.test(navigator.userAgent)) return 'Windows';
      return 'macOS';
    } catch { return 'macOS'; }
  })();

  // 오디오 패키지 메타데이터 준비
  const cloudAudioTracks = [];
  const audioFiles = [];

  if (audioPackage) {
    // 원본 오디오 (나레이션 트랙)
    if (audioPackage.media?.video) {
      const mediaFilename = audioPackage.media.video.filename;
      cloudAudioTracks.push({
        type: 'narration',
        filename: mediaFilename,
        path: audioPackage.media.video.path
      });
      audioFiles.push({
        type: 'narration',
        filename: mediaFilename,
        path: audioPackage.media.video.path
      });
    }

    // 인물 음성 (대사 트랙)
    for (const character of (audioPackage.voices || [])) {
      for (const file of character.files) {
        const voiceFilename = `voice_${character.character}_${file.filename}`;
        cloudAudioTracks.push({
          type: 'voice',
          character: character.character,
          filename: voiceFilename,
          timecodeMs: file.timecodeMs,
          durationMs: file.durationMs || 3000,
          seq: file.seq
        });
        audioFiles.push({
          type: 'voice',
          filename: voiceFilename,
          path: file.path
        });
      }
    }

    // SFX 파일 — 타임코드가 있는 파일만 미디어 등록 + 트랙 배치
    for (const sfxCat of (audioPackage.sfx || [])) {
      for (const file of sfxCat.files) {
        if (file.timecodeMs == null) continue; // 타임코드 없는 템플릿 제외
        const sfxFilename = `sfx_${sfxCat.category}_${file.filename}`;
        audioFiles.push({
          type: 'sfx',
          filename: sfxFilename,
          path: file.path
        });

        cloudAudioTracks.push({
          type: 'sfx_timed',
          filename: sfxFilename,
          timecodeMs: file.timecodeMs,
          durationMs: file.durationMs || 3000,
          category: sfxCat.category
        });
      }
    }
  }

  // filename → absolutePath 매핑 생성 (데스크톱 모드: 절대경로 치환용)
  const pathMap = {};
  for (const m of mediaFiles) {
    if (m.path && isFilePath(m.path)) pathMap[m.filename] = m.path;
  }
  for (const s of sfxFiles) {
    if (s.path && isFilePath(s.path)) pathMap[s.filename] = s.path;
  }
  for (const a of audioFiles) {
    if (a.path && isFilePath(a.path)) pathMap[a.filename] = a.path;
  }

  return {
    cloudRequest: {
      projectName: project.name || 'Untitled',
      os: detectedOS,
      format,
      titleKo: project.thumbnail_titles?.korean || project.title_ko || null,
      titleEn: project.thumbnail_titles?.english || project.title_en || null,
      scaleMode,  // 'fill' | 'fit' | 'none'
      kenBurns: {
        enabled: kenBurns,
        mode: kenBurnsMode,
        cycle: kenBurnsCycle,
        scaleMin: kenBurnsScaleMin,
        scaleMax: kenBurnsScaleMax
      },
      subtitleOption,
      subtitleFontSize,
      srtEntries: audioPackage?.srtEntries || null,
      audioDurationSec: audioPackage?.media?.video?.durationMs
        ? audioPackage.media.video.durationMs / 1000
        : null,
      scenes: cloudScenes,
      videoOverlays: cloudVideoOverlays.length > 0 ? cloudVideoOverlays : null,
      sfxItems: cloudSfxItems,
      audioTracks: cloudAudioTracks.length > 0 ? cloudAudioTracks : null,
      mediaPathBase
    },
    mediaFiles,
    sfxFiles,
    audioFiles,
    pathMap
  };
}

/**
 * CapCut 프로젝트를 로컬에서 직접 생성 (서버 우회 버전)
 */
export async function exportCapcutPackageCloud(project, options = {}) {
  const { capcutProjectNumber } = options;

  if (!capcutProjectNumber) {
    throw new Error('CapCut project folder path is required.');
  }

  const targetPath = capcutProjectNumber;
  console.log('[CapCut Local Export] Starting local generation to:', targetPath);

  try {
    // 1. 로컬 생성기 로드
    const { generateCapcutProject } = await import('./capcutLocalGenerator');

    // 2. 프로젝트 JSON 데이터 생성 (서버 호출 없이 로컬에서 수행)
    const { draftContent, draftMetaInfo, timelineLayout, extraFiles, mediaFiles } = await generateCapcutProject(project, {
      targetPath,
      projectName: project.name || options.projectName || 'ViraLoop_Project',
      username: options.username || 'User',
      subtitleOption: options.subtitleOption || 'ko',
      subtitleFontSize: options.subtitleFontSize || 6.0,
      audioPackage: options.audioPackage,
      scaleMode: options.scaleMode || 'fill',
      kenBurns: options.kenBurns ?? true,
      kenBurnsMode: options.kenBurnsMode || 'random',
      kenBurnsCycle: options.kenBurnsCycle || 5,
      kenBurnsScaleMin: options.kenBurnsScaleMin || 1.0,
      kenBurnsScaleMax: options.kenBurnsScaleMax || 1.3
    });

    // 3. 자막(SRT) 생성
    let srtContent = null;
    let srtFilename = null;
    if (options.subtitleOption !== 'none') {
      const { generateSRT } = await import('./capcut');
      srtContent = generateSRT(project, options.subtitleOption || 'ko');
      srtFilename = `subtitles_${options.subtitleOption || 'ko'}.srt`;
    }

    // 4. Electron IPC를 통해 파일 쓰기
    console.log('[CapCut Local Export] Writing files via IPC...');
    const writeResult = await window.electronAPI.writeCapcutProject({
      targetPath,
      draftInfo: draftContent,
      draftMetaInfo,
      timelineLayout,
      extraFiles,
      mediaFiles,
      srtContent,
      srtFilename
    });

    if (!writeResult.success) {
      throw new Error(`Failed to write project files: ${writeResult.error}`);
    }

    console.log('[CapCut Local Export] Successfully generated project at:', targetPath);
    return { success: true, targetPath };

  } catch (error) {
    console.error('[CapCut Local Export] Critical Error:', error);
    throw error;
  }
}

export default {
  exportCapcutPackageCloud
};
