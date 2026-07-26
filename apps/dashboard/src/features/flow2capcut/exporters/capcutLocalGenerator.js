/**
 * capcutLocalGenerator - CapCut 프로젝트 폴더 구조 및 JSON 생성 (V6 Platinum Pro Max 버전)
 */

import { resolveImageSrc } from '../utils/formatters';

function generateId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().toUpperCase();
    }
  } catch (e) {}
  return 'XXXXXXXX-XXXX-4XXX-YXXX-XXXXXXXXXXXX'.replace(/[XY]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'X' ? r : (r & 0x3 | 0x8);
    return v.toString(16).toUpperCase();
  });
}

const toMicros = (seconds) => Math.round(seconds * 1000000);

/**
 * 캡컷 타임라인 프리징을 100% 영구 소멸시키기 위한 초정밀 겹침 방지(Safe Sequential Overlap Prevention) 헬퍼
 * 동일한 트랙 안의 기존 세그먼트들과 절대 겹치지 않도록 시작 시간(target_start)을 정밀 계산하여 순차 조율합니다.
 */
function addSegmentWithoutOverlap(track, segment, renderIndexStart = 20000) {
  let targetStart = segment.target_timerange.start;
  const duration = segment.target_timerange.duration;

  // 겹치지 않는 완전 안전 구간을 찾을 때까지 무한 반복하며 뒤로 밉니다.
  let hasOverlap = true;
  while (hasOverlap) {
    hasOverlap = false;
    for (const existing of track.segments) {
      const eStart = existing.target_timerange.start;
      const eEnd = eStart + existing.target_timerange.duration;
      const targetEnd = targetStart + duration;

      // 시간 구간이 미세하게라도 겹치는지 체크
      if (Math.max(eStart, targetStart) < Math.min(eEnd, targetEnd)) {
        // 겹침 발견! 기존 클립이 끝나는 안전한 시점으로 시작 지점을 뒤로 밀어냅니다.
        targetStart = eEnd;
        hasOverlap = true;
        break; // 루프를 빠져나와 처음부터 다시 겹침 체크 수행
      }
    }
  }

  // 안전이 확보된 새 시간대로 세그먼트를 갱신하여 푸시합니다.
  segment.target_timerange.start = targetStart;
  segment.render_index = renderIndexStart + track.segments.length;
  track.segments.push(segment);
}

export async function generateCapcutProject(project, options = {}) {
  const projectId = generateId();
  const targetPath = options.targetPath || '';
  const isPortrait = project.format === 'portrait' || project.format === 'short' || project.aspectRatio === '9:16';
  const canvasRatio = isPortrait ? '9:16' : '16:9';
  const canvasWidth = isPortrait ? 1080 : 1920;
  const canvasHeight = isPortrait ? 1920 : 1080;

  const scenes = project.scenes || [];
  
  const audioPackage = options.audioPackage;

  const videoTrack = { id: generateId(), type: 'video', segments: [] };
  const textTrack = { id: generateId(), type: 'text', segments: [] };
  const globalVideoKeyframes = [];
  
  // 1순위: 나레이터 전용 동적 멀티트랙 배열
  const narratorTracks = [];
  const getOrCreateNarratorTrack = (index) => {
    if (!narratorTracks[index]) {
      narratorTracks[index] = {
        id: generateId(),
        type: 'audio',
        name: index === 0 ? 'Voice - NARRATOR' : `Voice - NARRATOR (${index + 1})`,
        segments: []
      };
    }
    return narratorTracks[index];
  };

  // 2순위: 일반 캐릭터 대사용 동적 멀티트랙 배열
  const characterTracks = [];
  const getOrCreateCharTrack = (index) => {
    if (!characterTracks[index]) {
      characterTracks[index] = {
        id: generateId(),
        type: 'audio',
        name: index === 0 ? 'Voice - CHARACTERS' : `Voice - CHARACTERS (${index + 1})`,
        segments: []
      };
    }
    return characterTracks[index];
  };

  // 3순위: 효과음용 동적 멀티트랙 배열
  const sfxTracksList = [];
  const getOrCreateSfxTrack = (index) => {
    if (!sfxTracksList[index]) {
      sfxTracksList[index] = {
        id: generateId(),
        type: 'audio',
        name: index === 0 ? 'SFX - GENERAL' : `SFX - GENERAL (${index + 1})`,
        segments: []
      };
    }
    return sfxTracksList[index];
  };

  // 두 오디오 세그먼트의 타임라인상 시간 겹침(Overlap) 여부 판정기
  function checkOverlap(seg1, seg2) {
    const s1 = seg1.target_timerange.start;
    const e1 = s1 + seg1.target_timerange.duration;
    const s2 = seg2.target_timerange.start;
    const e2 = s2 + seg2.target_timerange.duration;
    return Math.max(s1, s2) < Math.min(e1, e2);
  }

  const materials = {
    flowers: [],
    videos: [],
    tail_leaders: [],
    audios: [],
    images: [],
    texts: [],
    effects: [],
    stickers: [],
    canvases: [],
    transitions: [],
    audio_effects: [],
    audio_fades: [],
    beats: [],
    material_animations: [],
    placeholders: [],
    placeholder_infos: [],
    speeds: [],
    common_mask: [],
    chromas: [],
    text_templates: [],
    realtime_denoises: [],
    audio_pannings: [],
    audio_pitch_shifts: [],
    video_trackings: [],
    hsl: [],
    drafts: [],
    color_curves: [],
    hsl_curves: [],
    primary_color_wheels: [],
    log_color_wheels: [],
    video_effects: [],
    audio_balances: [],
    handwrites: [],
    manual_deformations: [],
    manual_beautys: [],
    plugin_effects: [],
    sound_channel_mappings: [],
    green_screens: [],
    shapes: [],
    material_colors: [],
    digital_humans: [],
    digital_human_model_dressing: [],
    smart_crops: [],
    ai_translates: [],
    audio_track_indexes: [],
    loudnesses: [],
    vocal_beautifys: [],
    vocal_separations: [],
    smart_relights: [],
    time_marks: [],
    multi_language_refs: [],
    video_shadows: [],
    video_strokes: [],
    video_radius: []
  };

  let cumulativeTime = 0;
  const mediaFilesToCopy = [];

  // Sort scenes by ID numeric value just like generateSRT to ensure order consistency
  const sortedScenes = [...scenes].sort((a, b) => {
    const aNum = parseInt(String(a.id || '').replace('scene_', '')) || 0;
    const bNum = parseInt(String(b.id || '').replace('scene_', '')) || 0;
    return aNum - bNum;
  });

  for (let index = 0; index < sortedScenes.length; index++) {
    const scene = sortedScenes[index];
    const duration = scene.image_duration || scene.duration || 3;
    let mediaSource = scene.video_path || scene.video || scene.media_path || scene.image_path || scene.imagePath || scene.image || scene.image_fallback; 
    const isVideo = !!(scene.video_path || scene.video || (mediaSource && mediaSource.match(/\.(mp4|mov|avi|webm)$/i)));
    
    if (mediaSource) {
      const materialId = generateId();
      const segmentId = generateId();

      const isBase64 = mediaSource.startsWith('data:');
      let ext = isVideo ? 'mp4' : 'jpg';
      if (isBase64) {
        const match = mediaSource.match(/^data:image\/(\w+);base64,/);
        ext = match ? (match[1] === 'jpeg' ? 'jpg' : match[1]) : 'jpg';
      } else if (!isVideo) {
        ext = mediaSource.match(/\.(png|jpg|jpeg|webp|gif)$/i)?.[1] || 'jpg';
      }
      
      const targetName = `Resources/media_scene_${index + 1}.${ext}`;
      const absoluteTargetFilePath = `${targetPath}/${targetName}`.replace(/\\/g, '/');

      mediaFilesToCopy.push({
        source: mediaSource,
        isBase64: isBase64,
        targetName: targetName
      });

      let imgWidth = canvasWidth;
      let imgHeight = canvasHeight;
      
      if (scene.upscaled_size) {
        imgWidth = scene.upscaled_size.width || canvasWidth;
        imgHeight = scene.upscaled_size.height || canvasHeight;
      } else if (scene.image_size) {
        imgWidth = scene.image_size.width || canvasWidth;
        imgHeight = scene.image_size.height || canvasHeight;
      } else if (scene.width && scene.height) {
        imgWidth = scene.width;
        imgHeight = scene.height;
      } else if (mediaSource && !isVideo) {
        try {
          const resolvedSrc = resolveImageSrc({ imagePath: scene.media_path || scene.image_path || scene.imagePath, image: scene.image || scene.image_fallback }) || mediaSource;
          const loadedSize = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = () => resolve(null);
            img.src = resolvedSrc;
          });
          if (loadedSize && loadedSize.width && loadedSize.height) {
            imgWidth = loadedSize.width;
            imgHeight = loadedSize.height;
            console.log(`[CapCut Local Generator] Extracted image size for scene ${index + 1}: ${imgWidth}x${imgHeight}`);
          }
        } catch (e) {
          console.warn(`[CapCut Local Generator] Failed to load image size for scene ${index + 1}, using canvas fallback.`);
        }
      } else if (mediaSource && isVideo) {
        try {
          const resolvedSrc = resolveImageSrc({ imagePath: scene.media_path || scene.image_path || scene.imagePath, image: scene.video || scene.video_path }) || mediaSource;
          const loadedSize = await new Promise((resolve) => {
            const vid = document.createElement('video');
            vid.onloadedmetadata = () => resolve({ width: vid.videoWidth, height: vid.videoHeight });
            vid.onerror = () => resolve(null);
            vid.src = resolvedSrc;
          });
          if (loadedSize && loadedSize.width && loadedSize.height) {
            imgWidth = loadedSize.width;
            imgHeight = loadedSize.height;
            console.log(`[CapCut Local Generator] Extracted video size for scene ${index + 1}: ${imgWidth}x${imgHeight}`);
          }
        } catch (e) {
          console.warn(`[CapCut Local Generator] Failed to load video size for scene ${index + 1}, using canvas fallback.`);
        }
      }

      // materials.videos (Golden Template Applied)
      materials.videos.push({
        id: materialId,
        path: absoluteTargetFilePath,
        type: isVideo ? "video" : "photo",
        duration: toMicros(duration),
        width: imgWidth,
        height: imgHeight,
        import_time: Math.floor(Date.now() / 1000),
        source_platform: 0,
        category_name: "local",
        category_id: "local",
        check_flag: 63487, // Magic number
        material_name: `media_scene_${index + 1}.${ext}`
      });

      const scaleMode = options.scaleMode || 'fill';
      let baseScale = 1.0; // default Fit

      const fitScaleX = canvasWidth / imgWidth;
      const fitScaleY = canvasHeight / imgHeight;
      const minFitScale = Math.min(fitScaleX, fitScaleY);
      const maxFitScale = Math.max(fitScaleX, fitScaleY);

      if (scaleMode === 'fill') {
        baseScale = maxFitScale / minFitScale;
      } else if (scaleMode === 'fit') {
        baseScale = 1.0;
      } else if (scaleMode === 'none') {
        baseScale = 1.0 / minFitScale;
      }

      const kenBurnsEnabled = !isVideo && (options.kenBurns ?? true);
      const kenBurnsMode = options.kenBurnsMode || 'random';
      const kenBurnsCycle = options.kenBurnsCycle || 5;
      const kenBurnsScaleMin = parseFloat(options.kenBurnsScaleMin) || 1.0;
      const kenBurnsScaleMax = parseFloat(options.kenBurnsScaleMax) || 1.3;

      let startScaleVal = baseScale;
      let endScaleVal = baseScale;
      let startXVal = 0.0;
      let endXVal = 0.0;
      let startYVal = 0.0;
      let endYVal = 0.0;

      if (kenBurnsEnabled) {
        // [테두리 까만색 원천 소멸 및 줌아웃 사전 확대(Pre-scale) 알고리즘]
        // 1. Ken Burns가 활성화된 경우, 캔버스 전체를 꽉 채우는 비율(Fill 기준: maxFitScale / minFitScale)을 최소 baseScale로 강제하여 종횡비 차이로 인한 레터박스/필러박스를 원천 제거합니다.
        const fillBaseScale = Math.max(baseScale, maxFitScale / minFitScale);

        // 2. 사용자가 지적한 "너무 좌에서 우로 움직하다보니까 빈공백이 생기고 테두리에 까만색이 만들어져" 문제를 방어하기 위해 패닝 최대 범위를 3%(-0.03 ~ 0.03)로 제한하고, 패닝 버퍼(1.06배)를 확보합니다.
        const maxPan = 0.03; 
        const panBuffer = 1.0 + (2.0 * maxPan);
        let safeBaseScale = fillBaseScale * panBuffer;

        // 3. 사용자가 지적한 "줌 아웃이 되면 테두리가 검게 보이는데 줌 아웃인 경우에는 이걸 고려해서 미리 좀 더 확대해야하지 않을까?" 문제를 완벽 해결합니다!
        // kenBurnsScaleMin이 1.0 미만(예: 0.8)으로 설정되어 줌아웃 시 이미지가 캔버스보다 작아지는 현상을 완벽 방어하기 위해,
        // 최소 스케일 비율(effectiveMinScale)의 역수(1.0 / effectiveMinScale)를 safeBaseScale에 사전 곱셈(Pre-scale)하여 미리 확대해 둡니다.
        const effectiveMinScale = Math.min(kenBurnsScaleMin, kenBurnsScaleMax);
        if (effectiveMinScale < 1.0) {
          const zoomOutBuffer = 1.0 / effectiveMinScale;
          safeBaseScale = safeBaseScale * zoomOutBuffer;
          console.log(`[CapCut Local Generator] Applied Zoom-Out Pre-scale buffer: ${zoomOutBuffer.toFixed(2)}x (safeBaseScale: ${safeBaseScale.toFixed(2)})`);
        }

        if (kenBurnsMode === 'pattern') {
          const patternIdx = index % 6;
          if (patternIdx === 0) { // Zoom In (정중앙 줌인)
            startScaleVal = safeBaseScale * kenBurnsScaleMin;
            endScaleVal = safeBaseScale * kenBurnsScaleMax;
          } else if (patternIdx === 1) { // Zoom Out (정중앙 줌아웃)
            startScaleVal = safeBaseScale * kenBurnsScaleMax;
            endScaleVal = safeBaseScale * kenBurnsScaleMin;
          } else if (patternIdx === 2) { // Pan Right + Zoom In
            startScaleVal = safeBaseScale * kenBurnsScaleMin;
            endScaleVal = safeBaseScale * kenBurnsScaleMax;
            startXVal = -maxPan;
            endXVal = maxPan;
          } else if (patternIdx === 3) { // Pan Left + Zoom In
            startScaleVal = safeBaseScale * kenBurnsScaleMin;
            endScaleVal = safeBaseScale * kenBurnsScaleMax;
            startXVal = maxPan;
            endXVal = -maxPan;
          } else if (patternIdx === 4) { // Pan Up + Zoom In
            startScaleVal = safeBaseScale * kenBurnsScaleMin;
            endScaleVal = safeBaseScale * kenBurnsScaleMax;
            startYVal = -maxPan;
            endYVal = maxPan;
          } else if (patternIdx === 5) { // Pan Down + Zoom In
            startScaleVal = safeBaseScale * kenBurnsScaleMin;
            endScaleVal = safeBaseScale * kenBurnsScaleMax;
            startYVal = maxPan;
            endYVal = -maxPan;
          }
        } else { // random
          const minS = safeBaseScale * kenBurnsScaleMin;
          const maxS = safeBaseScale * kenBurnsScaleMax;
          if (Math.random() < 0.5) { // Zoom In
            startScaleVal = minS;
            endScaleVal = minS + (maxS - minS) * (0.5 + Math.random() * 0.5);
          } else { // Zoom Out
            startScaleVal = minS + (maxS - minS) * (0.5 + Math.random() * 0.5);
            endScaleVal = minS;
          }
          startXVal = (Math.random() - 0.5) * (maxPan * 1.5);
          endXVal = (Math.random() - 0.5) * (maxPan * 1.5);
          startYVal = (Math.random() - 0.5) * (maxPan * 1.5);
          endYVal = (Math.random() - 0.5) * (maxPan * 1.5);
        }
      }

      const scaleKfList = [];
      const xKfList = [];
      const yKfList = [];

      if (kenBurnsEnabled) {
        const totalMicros = toMicros(duration);
        const cycleMicros = toMicros(kenBurnsCycle);
        let currentMicros = 0;
        let cycleIdx = 0;

        while (currentMicros < totalMicros) {
          const isEven = cycleIdx % 2 === 0;
          const sVal = isEven ? startScaleVal : endScaleVal;
          const xVal = isEven ? startXVal : endXVal;
          const yVal = isEven ? startYVal : endYVal;

          scaleKfList.push({
            id: generateId(),
            time_offset: currentMicros,
            values: [sVal],
            curveType: "Line"
          });
          xKfList.push({
            id: generateId(),
            time_offset: currentMicros,
            values: [xVal],
            curveType: "Line"
          });
          yKfList.push({
            id: generateId(),
            time_offset: currentMicros,
            values: [yVal],
            curveType: "Line"
          });

          currentMicros += cycleMicros;
          cycleIdx++;
        }

        if (scaleKfList.length > 0 && scaleKfList[scaleKfList.length - 1].time_offset < totalMicros) {
          const isEven = cycleIdx % 2 === 0;
          const sVal = isEven ? startScaleVal : endScaleVal;
          const xVal = isEven ? startXVal : endXVal;
          const yVal = isEven ? startYVal : endYVal;

          scaleKfList.push({
            id: generateId(),
            time_offset: totalMicros,
            values: [sVal],
            curveType: "Line"
          });
          xKfList.push({
            id: generateId(),
            time_offset: totalMicros,
            values: [xVal],
            curveType: "Line"
          });
          yKfList.push({
            id: generateId(),
            time_offset: totalMicros,
            values: [yVal],
            curveType: "Line"
          });
        }
      }

      const commonKeyframes = [];
      const keyframeRefs = [];

      if (kenBurnsEnabled && scaleKfList.length > 1) {
        const kfScaleId = generateId();
        const kfScaleXId = generateId();
        const kfScaleYId = generateId();
        const kfXId = generateId();
        const kfYId = generateId();

        // 캡컷 데스크톱 버전별 호환성을 완벽 보장하기 위해 KFTypeScaleUniform뿐만 아니라 KFTypeScaleX, KFTypeScaleY까지 전부 주입합니다!
        const kfScaleObj = {
          id: kfScaleId,
          keyframe_list: scaleKfList,
          property_type: "KFTypeScaleUniform"
        };
        const kfScaleXObj = {
          id: kfScaleXId,
          keyframe_list: scaleKfList,
          property_type: "KFTypeScaleX"
        };
        const kfScaleYObj = {
          id: kfScaleYId,
          keyframe_list: scaleKfList,
          property_type: "KFTypeScaleY"
        };
        const kfXObj = {
          id: kfXId,
          keyframe_list: xKfList,
          property_type: "KFTypePositionX"
        };
        const kfYObj = {
          id: kfYId,
          keyframe_list: yKfList,
          property_type: "KFTypePositionY"
        };

        commonKeyframes.push(kfScaleObj, kfScaleXObj, kfScaleYObj, kfXObj, kfYObj);
        keyframeRefs.push(kfScaleId, kfScaleXId, kfScaleYId, kfXId, kfYId);

        globalVideoKeyframes.push(kfScaleObj, kfScaleXObj, kfScaleYObj, kfXObj, kfYObj);
      }

      videoTrack.segments.push({
        id: segmentId,
        material_id: materialId,
        source_timerange: { start: 0, duration: toMicros(duration) },
        target_timerange: { start: toMicros(cumulativeTime), duration: toMicros(duration) },
        render_index: 10000 + index,
        clip: {
          scale: { x: startScaleVal, y: startScaleVal },
          transform: { x: startXVal, y: startYVal }
        },
        uniform_scale: {
          on: true,
          value: startScaleVal
        },
        keyframe_refs: keyframeRefs,
        common_keyframes: commonKeyframes,
        extra_material_refs: [materialId]
      });
    } else {
      // 이미지가 없는 씬도 비디오 트랙에 빈 투명 갭(Transparent Gap) 세그먼트를 반드시 배치하여
      // 비디오 트랙의 총 연장 길이를 자막/오디오 트랙과 100% 일치시켜 캡컷 로딩 프리징을 원천 예방합니다!
      const segmentId = generateId();
      videoTrack.segments.push({
        id: segmentId,
        material_id: "", // 빈 머티리얼로 투명 처리
        source_timerange: null,
        target_timerange: { start: toMicros(cumulativeTime), duration: toMicros(duration) },
        render_index: 10000 + index,
        clip: {
          scale: { x: 1.0, y: 1.0 },
          transform: { x: 0, y: 0 }
        },
        extra_material_refs: []
      });
    }

    // Extract subtitle (defaulting to Korean, or options.subtitleOption || 'ko')
    const subtitleLang = options.subtitleOption || 'ko';
    const subtitleText = subtitleLang === 'ko' ? (scene.subtitle_ko || scene.subtitle) : (scene.subtitle_en || scene.subtitle);

    if (subtitleText && subtitleText.trim()) {
      // 1. Semantic Chunking based on AI or User markers (// or \n)
      let chunks = subtitleText.split(/\/\/|\n/).map(c => c.trim()).filter(c => c.length > 0);
      
      const subConfig = options.subtitleConfig || {};
      const splitLimit = parseInt(subConfig.splitLimit || 20, 10);
      
      // Auto-chunking for long text if no manual markers exist
      if (chunks.length === 1 && chunks[0].length > splitLimit * 1.5) {
          const newChunks = [];
          const words = chunks[0].split(/\s+/);
          let currentChunk = "";
          for (const word of words) {
            if ((currentChunk + word).length > splitLimit) {
              if (currentChunk.trim()) newChunks.push(currentChunk.trim());
              currentChunk = word + " ";
            } else {
              currentChunk += word + " ";
            }
          }
          if (currentChunk.trim()) newChunks.push(currentChunk.trim());
          chunks = newChunks;
      }
      
      if (chunks.length > 0) {
        
        const subtitleDuration = duration;
        const chunkDuration = subtitleDuration / chunks.length;

        // Configuration setup
        
        const hexToRgbFloat = (hex) => {
          if (!hex) return [1.0, 1.0, 1.0];
          const clean = hex.replace('#', '');
          if (clean.length === 6) {
            return [
              parseInt(clean.substr(0, 2), 16) / 255.0,
              parseInt(clean.substr(2, 2), 16) / 255.0,
              parseInt(clean.substr(4, 2), 16) / 255.0
            ];
          }
          return [1.0, 1.0, 1.0];
        };

        const textColorHex = subConfig.textColor || "#FFFFFF";
        const textColorRgb = hexToRgbFloat(textColorHex);
        const isBold = subConfig.isBold !== undefined ? subConfig.isBold : true;
        const isItalic = subConfig.isItalic !== undefined ? subConfig.isItalic : false;
        
        const hasShadow = subConfig.shadowSize && subConfig.shadowSize > 0;
        const shadowColor = subConfig.shadowColor || "#000000";
        const shadowDist = (subConfig.shadowSize || 0) * 0.8;
        
        const hasOutline = subConfig.outlineSize && subConfig.outlineSize > 0;
        const outlineColor = subConfig.outlineColor || "#000000";
        const outlineWidth = (subConfig.outlineSize || 0) * 0.02;
        
        const useBox = subConfig.useBox || false;
        const boxColor = subConfig.boxColor || "#000000";
        const boxAlpha = useBox ? (subConfig.boxOpacity || 50) / 100.0 : 0.0;
        
        let alignment = 1;
        if (subConfig.textAlign === 'left') alignment = 0;
        else if (subConfig.textAlign === 'right') alignment = 2;

        const fontSize = parseFloat(subConfig.fontSize || 10);
        const baseMarginY = parseFloat(subConfig.marginV || 50) / 1000.0;
        let transformY = isPortrait ? -0.65 : -0.85;
        const pos = subConfig.position || 'bottom';
        if (pos === 'top') {
          transformY = (isPortrait ? 0.65 : 0.85) - baseMarginY;
        } else if (pos === 'middle') {
          transformY = 0.0 + baseMarginY;
        } else if (pos === 'bottom') {
          transformY = (isPortrait ? -0.65 : -0.85) + baseMarginY;
        } else if (pos === 'custom') {
          transformY = 0.0 + baseMarginY;
        }

        // Font selection
        let fontPath = "";
        let fontName = subConfig.font || "맑은 고딕";
        const isWin = typeof process !== 'undefined' ? process.platform === 'win32' : /Win/.test(navigator.userAgent);
        if (isWin) {
          fontPath = "C:/Windows/Fonts/malgun.ttf";
        } else {
          fontPath = "/System/Library/Fonts/AppleSDGothicNeo.ttc";
          fontName = "Apple SD 산돌고딕 Neo";
        }

        // Loop over semantic chunks
        for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
          const rawChunk = chunks[cIdx];
          const chunkStart = cumulativeTime + (cIdx * chunkDuration);
          
          let cleanText = rawChunk.replace(/<[^>]*>/g, '').trim();

          // 2. Line Breaking within chunk
          const splitLimit = parseInt(subConfig.splitLimit || 20, 10);
          let splitText = "";
          let currentLine = "";
          const words = cleanText.split(/\s+/);
          
          for (const word of words) {
            if ((currentLine + word).length > splitLimit) {
              splitText += (splitText ? "\n" : "") + currentLine.trim();
              currentLine = word + " ";
            } else {
              currentLine += word + " ";
            }
          }
          if (currentLine.trim()) {
            splitText += (splitText ? "\n" : "") + currentLine.trim();
          }
          cleanText = splitText || cleanText;

          const textMaterialId = generateId();
          const textSegmentId = generateId();

      // Detect OS to use premium, beautiful Korean fonts that are guaranteed to exist locally
      let fontPath = "";
      let fontName = subConfig.font || "맑은 고딕";
      
      const isWin = typeof process !== 'undefined' ? process.platform === 'win32' : /Win/.test(navigator.userAgent);
      
      const winFontPaths = {
        "맑은 고딕": "C:/Windows/Fonts/malgun.ttf",
        "Arial": "C:/Windows/Fonts/arial.ttf",
        "Gmarket Sans": "C:/Windows/Fonts/GmarketSansTTFMedium.ttf",
        "Noto Sans KR": "C:/Windows/Fonts/NotoSansKR-Regular.otf",
        "배달의민족 도현": "C:/Windows/Fonts/BMDOHYEON_ttf.ttf"
      };

      if (isWin) {
        fontPath = winFontPaths[fontName] || "C:/Windows/Fonts/malgun.ttf";
      } else {
        fontPath = "/System/Library/Fonts/AppleSDGothicNeo.ttc";
        fontName = subConfig.font || "Apple SD 산돌고딕 Neo";
      }

      // materials.texts configuration
      materials.texts.push({
        recognize_task_id: "",
        id: textMaterialId,
        name: "",
        recognize_text: "",
        recognize_model: "",
        punc_model: "",
        type: "subtitle",
        content: JSON.stringify({
          text: cleanText,
          styles: [
            {
              fill: {
                content: {
                  render_type: "solid",
                  solid: {
                    color: textColorRgb
                  }
                }
              },
              size: fontSize,
              bold: isBold,
              italic: isItalic,
              useLetterColor: true,
              range: [0, cleanText.length]
            }
          ]
        }),
        base_content: "",
        words: {
          start_time: [],
          end_time: [],
          text: []
        },
        current_words: {
          start_time: [],
          end_time: [],
          text: []
        },
        global_alpha: 1.0,
        combo_info: {
          text_templates: []
        },
        caption_template_info: {
          resource_id: "",
          third_resource_id: "",
          resource_name: "",
          category_id: "",
          category_name: "",
          effect_id: "",
          request_id: "",
          path: "",
          is_new: false,
          source_platform: 0
        },
        layer_weight: 1,
        letter_spacing: 0.03, // Slight letter spacing for premium look
        text_curve: null,
        text_loop_on_path: false,
        offset_on_path: 0,
        enable_path_typesetting: false,
        text_exceeds_path_process_type: 0,
        text_typesetting_paths: null,
        text_typesetting_paths_file: "",
        text_typesetting_path_index: 0,
        line_spacing: 0.05, // Better line spacing
        has_shadow: !!hasShadow,
        shadow_color: shadowColor,
        shadow_alpha: hasShadow ? 0.8999999761581421 : 0.0,
        shadow_smoothing: 0.45000001788139343,
        shadow_distance: shadowDist,
        shadow_point: {
          x: 0.6363961030678928,
          y: -0.6363961030678928
        },
        shadow_angle: -45,
        shadow_thickness_projection_enable: false,
        shadow_thickness_projection_angle: 0,
        shadow_thickness_projection_distance: 0,
        border_alpha: hasOutline ? 1.0 : 0.0,
        border_color: outlineColor,
        border_width: hasOutline ? outlineWidth : 0.0,
        border_mode: 0,
        style_name: "",
        text_color: textColorHex,
        text_alpha: 1.0,
        font_name: fontName,
        font_title: fontName,
        font_size: fontSize,
        font_path: fontPath,
        font_id: "",
        font_resource_id: "",
        initial_scale: 1.0,
        font_url: "",
        typesetting: 0,
        alignment: alignment,
        line_feed: 1,
        use_effect_default_color: true,
        is_rich_text: false,
        shape_clip_x: false,
        shape_clip_y: false,
        ktv_color: "",
        text_to_audio_ids: [],
        bold_width: 0.008,
        italic_degree: 0,
        underline: false,
        underline_width: 0.05,
        underline_offset: 0.22,
        sub_type: 0,
        check_flag: 47,
        text_size: 30,
        font_category_name: "",
        font_source_platform: 1,
        font_third_resource_id: "",
        font_category_id: "",
        add_type: 2, // Subtitle
        operation_type: 0,
        recognize_type: 0,
        fonts: [],
        background_color: boxColor,
        background_alpha: boxAlpha,
        background_style: useBox ? 1 : 0,
        background_round_radius: 0.15, // Smooth rounded corners
        background_width: 0.15, // Well-padded width
        background_height: 0.15, // Well-padded height
        background_vertical_offset: 0,
        background_horizontal_offset: 0,
        background_fill: "",
        single_char_bg_enable: false,
        single_char_bg_color: "",
        single_char_bg_alpha: 1.0,
        single_char_bg_round_radius: 0.3,
        single_char_bg_width: 0,
        single_char_bg_height: 0,
        single_char_bg_vertical_offset: 0,
        single_char_bg_horizontal_offset: 0,
        font_team_id: "",
        tts_auto_update: false,
        text_preset_resource_id: "",
        group_id: `import_${Math.floor(Date.now() / 1000)}`,
        preset_id: "",
        preset_name: "",
        preset_category: "",
        preset_category_id: "",
        preset_index: 0,
        preset_has_set_alignment: false,
        force_apply_line_max_width: false,
        language: "",
        relevance_segment: [],
        original_size: [],
        fixed_width: -1,
        fixed_height: -1,
        line_max_width: 0.82,
        oneline_cutoff: false,
        cutoff_postfix: "",
        subtitle_template_original_fontsize: 0,
        subtitle_keywords: null,
        inner_padding: -1,
        multi_language_current: "none",
        source_from: "",
        is_lyric_effect: false,
        lyric_group_id: "",
        lyrics_template: {
          resource_id: "",
          resource_name: "",
          panel: "",
          effect_id: "",
          path: "",
          category_id: "",
          category_name: "",
          request_id: ""
        },
        is_batch_replace: false,
        is_words_linear: false,
        ssml_content: "",
        subtitle_keywords_config: null,
        sub_template_id: -1,
        translate_original_text: ""
      });

      // textTrack segment configuration
          textTrack.segments.push({
            id: textSegmentId,
            source_timerange: null,
            target_timerange: {
              start: toMicros(chunkStart),
              duration: toMicros(chunkDuration)
            },
        render_timerange: {
          start: 0,
          duration: 0
        },
        desc: "",
        state: 0,
        speed: 1,
        is_loop: false,
        is_tone_modify: false,
        reverse: false,
        intensifies_audio: false,
        cartoon: false,
        volume: 1.0,
        last_nonzero_volume: 1.0,
        clip: {
          scale: {
            x: 1.0,
            y: 1.0
          },
          rotation: 0.0,
          transform: {
            x: 0.0,
            y: transformY
          },
          flip: {
            vertical: false,
            horizontal: false
          },
          alpha: 1.0
        },
        uniform_scale: {
          on: true,
          value: 1.0
        },
        material_id: textMaterialId,
        extra_material_refs: [],
        render_index: 14000 + index + cIdx,
        keyframe_refs: [],
        enable_lut: false,
        enable_adjust: false,
        enable_hsl: false,
        visible: true,
        group_id: "",
        enable_color_curves: true,
        enable_hsl_curves: true,
        track_render_index: 1,
        hdr_settings: null,
        enable_color_wheels: true,
        track_attribute: 0,
        is_placeholder: false,
        template_id: "",
        enable_smart_color_adjust: false,
        template_scene: "default",
        common_keyframes: [],
        caption_info: null,
        responsive_layout: {
          enable: false,
          target_follow: "",
          size_layout: 0,
          horizontal_pos_layout: 0,
          vertical_pos_layout: 0
        },
        enable_color_match_adjust: false,
        enable_color_correct_adjust: false,
        enable_adjust_mask: false,
        raw_segment_id: "",
        lyric_keyframes: null,
        enable_video_mask: true,
        digital_human_template_group_id: "",
        color_correct_alg_result: "",
        source: "segmentsourcenormal",
        enable_mask_stroke: false,
        enable_mask_shadow: false,
        enable_color_adjust_pro: false
      });
        } // end for loop over chunks
      } // end if chunks > 0
    } // end if subtitleText

    cumulativeTime += duration;
  }

  // ── 오디오 패키지 (성우 대사, 풀 나레이션, SFX) 타임라인 조립 및 트랙 빌드 ──
  if (audioPackage) {
    console.log('[CapCut Local Generator] Processing audio package for CapCut timelines with Safe Sequential Alignment...');

    // 1. 풀 나레이션 오디오 트랙은 대본 개별 음성과의 중복 및 겹침 혼선을 방지하기 위해 생성하지 않고 개별 성우/나레이터 파일로 단일화합니다.

    // 2. 인물별 성우 대사 (Voices) - 나레이션 통합 및 대사 겹침 발생 시에만 트랙 동적 분화
    let voiceIndex = 0;
    for (const character of (audioPackage.voices || [])) {
      const charName = character.character.toLowerCase();
      
      // 폴더명이나 캐릭터 이름에 'narrator' 혹은 'sophie'가 나레이션일 수도 있으나 기본 'narrator'를 나레이션으로 지정
      const isNarrator = charName.includes('narrator');

      for (const file of character.files) {
        const materialId = generateId();
        const segmentId = generateId();
        const filename = file.filename || `voice_${character.character}.mp3`;
        const ext = filename.split('.').pop() || 'mp3';
        const targetName = `Resources/voice_${character.character}_${materialId}.${ext}`;
        const absoluteTargetFilePath = `${targetPath}/${targetName}`.replace(/\\/g, '/');

        mediaFilesToCopy.push({
          source: file.path,
          isBase64: false,
          targetName: targetName
        });

        // mp3 parser로 읽어온 정확한 재생 시간(durationMs)을 100% 신뢰하여 반영
        const durationMs = file.durationMs || 3000;
        const timecodeMs = file.timecodeMs || 0;

        materials.audios.push({
          id: materialId,
          path: absoluteTargetFilePath,
          type: "music",
          duration: durationMs * 1000,
          import_time: Math.floor(Date.now() / 1000),
          source_platform: 0,
          category_name: "local",
          category_id: "local",
          material_name: filename
        });

        const segment = {
          id: segmentId,
          material_id: materialId,
          source_timerange: { start: 0, duration: durationMs * 1000 },
          target_timerange: { start: timecodeMs * 1000, duration: durationMs * 1000 },
          render_index: 22000 + voiceIndex,
          volume: 1.0,
          last_nonzero_volume: 1.0,
          extra_material_refs: [materialId]
        };

        if (isNarrator) {
          // 나레이션도 시작 타임코드(timecodeMs)를 절대 억지로 변경하여 밀어내지 않고 원래 값에 자석 고정!
          // 대사 겹침이 감지될 때만 NARRATOR 트랙을 동적으로 늘려 얹어주는 완벽한 안전 충돌 분할
          let assigned = false;
          let trackIdx = 0;
          
          while (!assigned) {
            const currentTrack = getOrCreateNarratorTrack(trackIdx);
            let overlapFound = false;
            for (const existing of currentTrack.segments) {
              if (checkOverlap(existing, segment)) {
                overlapFound = true;
                break;
              }
            }

            if (!overlapFound) {
              segment.render_index = 22000 + voiceIndex;
              currentTrack.segments.push(segment);
              assigned = true;
            } else {
              trackIdx++;
            }
          }
        } else {
          // 일반 성우 캐릭터들은 겹치지 않는 경우 첫 번째 Voice - CHARACTERS 트랙에 모두 병합!
          // 대사들이 재생 상에서 겹칠 때만 두 번째, 세 번째 트랙을 새로 동적 개설하여 안전하게 분할 매핑!
          let assigned = false;
          let trackIdx = 0;
          
          while (!assigned) {
            const currentTrack = getOrCreateCharTrack(trackIdx);
            let overlapFound = false;
            for (const existing of currentTrack.segments) {
              if (checkOverlap(existing, segment)) {
                overlapFound = true;
                break;
              }
            }

            if (!overlapFound) {
              segment.render_index = 22000 + voiceIndex;
              currentTrack.segments.push(segment);
              assigned = true;
            } else {
              trackIdx++; // 겹치면 다음 트랙으로 이동
            }
          }
        }
        voiceIndex++;
      }
    }
    console.log('[CapCut Local Generator] Mapped character voices count:', voiceIndex);

    // 3. 효과음 (SFX) - 평소에는 1개 트랙에 완전 병합, 재생 시점 겹칠 때만 트랙 동적 분화
    let sfxIndex = 0;
    for (const sfxCat of (audioPackage.sfx || [])) {
      for (const file of sfxCat.files) {
        if (file.timecodeMs == null) continue; // 타임코드가 지정되지 않은 이펙트는 배제

        const materialId = generateId();
        const segmentId = generateId();
        const filename = file.filename || `sfx_${sfxCat.category}.mp3`;
        const ext = filename.split('.').pop() || 'mp3';
        const targetName = `Resources/sfx_${sfxCat.category}_${materialId}.${ext}`;
        const absoluteTargetFilePath = `${targetPath}/${targetName}`.replace(/\\/g, '/');

        mediaFilesToCopy.push({
          source: file.path,
          isBase64: false,
          targetName: targetName
        });

        // mp3 parser로 읽어온 정확한 재생 시간(durationMs)을 100% 신뢰하여 반영
        const durationMs = file.durationMs || 3000;
        const timecodeMs = file.timecodeMs;

        materials.audios.push({
          id: materialId,
          path: absoluteTargetFilePath,
          type: "music",
          duration: durationMs * 1000,
          import_time: Math.floor(Date.now() / 1000),
          source_platform: 0,
          category_name: "local",
          category_id: "local",
          material_name: filename
        });

        const segment = {
          id: segmentId,
          material_id: materialId,
          source_timerange: { start: 0, duration: durationMs * 1000 },
          target_timerange: { start: timecodeMs * 1000, duration: durationMs * 1000 },
          render_index: 25000 + sfxIndex,
          volume: 1.0,
          last_nonzero_volume: 1.0,
          extra_material_refs: [materialId]
        };

        // SFX 겹침 방지 동적 트랙 분산 배치
        let assigned = false;
        let trackIdx = 0;
        
        while (!assigned) {
          const currentTrack = getOrCreateSfxTrack(trackIdx);
          let overlapFound = false;
          for (const existing of currentTrack.segments) {
            if (checkOverlap(existing, segment)) {
              overlapFound = true;
              break;
            }
          }

          if (!overlapFound) {
            segment.render_index = 25000 + sfxIndex;
            currentTrack.segments.push(segment);
            assigned = true;
          } else {
            trackIdx++;
          }
        }
        sfxIndex++;
      }
    }
    console.log('[CapCut Local Generator] Mapped SFX count:', sfxIndex);
  }

  const draftContent = {
    id: projectId,
    version: 360000,
    new_version: "167.0.0",
    name: "",
    duration: toMicros(cumulativeTime),
    create_time: 0,
    update_time: 0,
    fps: 30.0,
    is_drop_frame_timecode: false,
    color_space: -1,
    config: {
      video_mute: false,
      record_audio_last_index: 1,
      extract_audio_last_index: 1,
      original_sound_last_index: 1,
      subtitle_recognition_id: "",
      subtitle_taskinfo: [],
      lyrics_recognition_id: "",
      lyrics_taskinfo: [],
      subtitle_sync: true,
      lyrics_sync: true,
      voice_change_sync: false,
      sticker_max_index: 1,
      adjust_max_index: 1,
      material_save_mode: 0,
      export_range: null,
      maintrack_adsorb: true,
      combination_max_index: 1,
      attachment_info: [],
      zoom_info_params: null,
      system_font_list: [],
      multi_language_mode: "none",
      multi_language_main: "none",
      multi_language_current: "none",
      multi_language_list: [],
      subtitle_keywords_config: null,
      use_float_render: false
    },
    canvas_config: {
      ratio: canvasRatio === '9:16' ? '9:16' : (canvasRatio === '16:9' ? '16:9' : 'original'),
      width: canvasWidth,
      height: canvasHeight,
      background: null
    },
    tracks: [
      videoTrack.segments.length > 0 ? videoTrack : null,
      textTrack.segments.length > 0 ? textTrack : null,
      // 1순위 오디오: 나레이션 전용 트랙들 (겹치지 않으면 1개만 노출)
      ...narratorTracks.filter(t => t.segments.length > 0),
      // 2순위 오디오: 일반 캐릭터들의 동적 분할 트랙들
      ...characterTracks.filter(t => t.segments.length > 0),
      // 3순위 오디오: 효과음들의 동적 분할 트랙들
      ...sfxTracksList.filter(t => t.segments.length > 0)
    ].filter(Boolean),
    group_container: null,
    materials: materials,
    keyframes: {
      videos: globalVideoKeyframes,
      audios: [],
      texts: [],
      stickers: [],
      filters: [],
      adjusts: [],
      handwrites: [],
      effects: []
    },
    keyframe_graph_list: [],
    platform: {
      os: "windows",
      os_version: "10.0.26200",
      app_id: 359289,
      app_version: "8.5.0",
      app_source: "cc",
      device_id: "1ff0978a9f844b91c7edbe6fa21a1b43",
      hard_disk_id: "",
      mac_address: "172ce154d044e20c675046a2a34d03a6,7707ff6986fb6a5748578eac985b13f5"
    },
    last_modified_platform: {
      os: "windows",
      os_version: "10.0.26200",
      app_id: 359289,
      app_version: "8.5.0",
      app_source: "cc",
      device_id: "1ff0978a9f844b91c7edbe6fa21a1b43",
      hard_disk_id: "",
      mac_address: "172ce154d044e20c675046a2a34d03a6"
    },
    mutable_config: null,
    cover: null,
    retouch_cover: null,
    extra_info: null,
    relationships: [],
    render_index_track_mode_on: true,
    free_render_index_mode_on: false,
    static_cover_image_path: "",
    source: "default",
    time_marks: null,
    path: "",
    lyrics_effects: [],
    uneven_animation_template_info: {
      composition: "",
      content: "",
      order: "",
      sub_template_info_list: []
    },
    draft_type: "video",
    smart_ads_info: {
      page_from: "",
      routine: "",
      draft_url: ""
    },
    function_assistant_info: {
      smart_rec_applied: false,
      fixed_rec_applied: false,
      auto_adjust: false,
      auto_adjust_segid_list: [],
      color_correction: false,
      color_correction_segid_list: [],
      enhance_quality: false,
      smooth_slow_motion: false,
      deflicker_segid_list: [],
      video_noise_segid_list: [],
      enhance_quality_segid_list: [],
      smart_segid_list: [],
      retouch: false,
      retouch_segid_list: [],
      enhande_voice: false,
      enhance_voice_segid_list: [],
      audio_noise_segid_list: [],
      auto_caption: false,
      auto_caption_segid_list: [],
      auto_caption_template_id: "",
      caption_opt: false,
      caption_opt_segid_list: [],
      eye_correction: false,
      eye_correction_segid_list: [],
      normalize_loudness: false,
      normalize_loudness_segid_list: [],
      normalize_loudness_audio_denoise_segid_list: [],
      auto_adjust_fixed: false,
      auto_adjust_fixed_value: 50.0,
      color_correction_fixed: false,
      color_correction_fixed_value: 50.0,
      normalize_loudness_fixed: false,
      enhande_voice_fixed: false,
      retouch_fixed: false,
      enhance_quality_fixed: false,
      smooth_slow_motion_fixed: false,
      fps: {
        num: 0,
        den: 1
      }
    }
  };

  // Derive precise paths
  const posixPath = targetPath.replace(/\\/g, '/');
  const pathParts = posixPath.split('/');
  const draftFoldPath = posixPath;
  const draftRootPath = pathParts.slice(0, -1).join('/');

  // Precise INI formatted settings file
  const draftSettingsINI = `[General]
draft_create_time=${Math.floor(Date.now() / 1000)}
draft_last_edit_time=${Math.floor(Date.now() / 1000)}
real_edit_seconds=0
real_edit_keys=0
cloud_last_modify_platform=windows
`;

  // Meticulous draft_meta_info.json configuration matching exact properties of standard working project
  const draftMetaInfo = {
    cloud_draft_cover: false,
    cloud_draft_sync: false,
    cloud_package_completed_time: "",
    draft_cloud_capcut_purchase_info: "",
    draft_cloud_last_action_download: false,
    draft_cloud_package_type: "",
    draft_cloud_purchase_info: "",
    draft_cloud_template_id: "",
    draft_cloud_tutorial_info: "",
    draft_cloud_videocut_purchase_info: "",
    draft_cover: "draft_cover.jpg",
    draft_deeplink_url: "",
    draft_enterprise_info: {
      draft_enterprise_extra: "",
      draft_enterprise_id: "",
      draft_enterprise_name: "",
      enterprise_material: []
    },
    draft_fold_path: draftFoldPath,
    draft_id: projectId,
    draft_is_ae_produce: false,
    draft_is_ai_packaging_used: false,
    draft_is_ai_shorts: false,
    draft_is_ai_translate: false,
    draft_is_article_video_draft: false,
    draft_is_cloud_temp_draft: false,
    draft_is_from_deeplink: "false",
    draft_is_invisible: false,
    draft_is_web_article_video: false,
    draft_materials: [
      {
        type: 0,
        value: materials.videos.map((v, idx) => ({
          ai_group_type: "",
          create_time: 0,
          duration: v.duration,
          enter_from: 0,
          extra_info: v.material_name,
          file_Path: v.path,
          height: v.height,
          id: v.id,
          import_time: v.import_time,
          import_time_ms: -1,
          item_source: 1,
          md5: "",
          metetype: "photo",
          roughcut_time_range: {
            duration: v.duration,
            start: 0
          },
          sub_time_range: {
            duration: -1,
            start: -1
          },
          type: 0,
          width: v.width
        }))
      },
      { type: 1, value: [] },
      { type: 2, value: [] },
      { type: 3, value: [] },
      { type: 6, value: [] },
      { type: 7, value: [] },
      { type: 8, value: [] }
    ], 
    draft_materials_copied_info: [],
    draft_name: options.projectName || 'ViraLoop_Project',
    draft_need_rename_folder: false,
    draft_new_version: "",
    draft_removable_storage_device: "",
    draft_root_path: draftRootPath,
    draft_segment_extra_info: [],
    draft_timeline_materials_size_: 100000, // Non-zero mock size
    draft_type: "",
    draft_web_article_video_enter_from: "",
    tm_draft_cloud_completed: "",
    tm_draft_cloud_entry_id: -1,
    tm_draft_cloud_modified: 0,
    tm_draft_cloud_parent_entry_id: -1,
    tm_draft_cloud_space_id: -1,
    tm_draft_cloud_user_id: -1,
    tm_draft_create: Date.now() * 1000,
    tm_draft_modified: Date.now() * 1000,
    tm_draft_removed: 0,
    tm_duration: toMicros(cumulativeTime)
  };

  const timelineLayout = {
    dockItems: [
      {
        dockIndex: 0,
        ratio: 1,
        timelineIds: [projectId],
        timelineNames: ["타임라인 01"]
      }
    ],
    layoutOrientation: 1
  };

  return {
    draftContent,
    draftMetaInfo,
    timelineLayout,
    mediaFiles: mediaFilesToCopy,
    extraFiles: {
      'draft_settings': draftSettingsINI,
      'draft_biz_config.json': "", // 0-byte completely empty file
      'draft_agency_config.json': {
        "is_auto_agency_enabled": false,
        "is_auto_agency_popup": false,
        "is_single_agency_mode": false,
        "marterials": null,
        "use_converter": false,
        "video_resolution": 720
      },
      'draft_content.json.bak': draftContent,
      'draft_virtual_store.json': {
        "draft_materials": [],
        "draft_virtual_store": [
          { "type": 0, "value": [] },
          { "type": 1, "value": [] },
          { "type": 2, "value": [] }
        ]
      },
      'attachment_pc_common.json': {
        "ai_packaging_infos": [],
        "ai_packaging_report_info": {
          "caption_id_list": [],
          "commercial_material": "",
          "material_source": "",
          "method": "",
          "page_from": "",
          "style": "",
          "task_id": "",
          "text_style": "",
          "tos_id": "",
          "video_category": ""
        },
        "broll": {
          "ai_packaging_infos": [],
          "ai_packaging_report_info": {
            "caption_id_list": [],
            "commercial_material": "",
            "material_source": "",
            "method": "",
            "page_from": "",
            "style": "",
            "task_id": "",
            "text_style": "",
            "tos_id": "",
            "video_category": ""
          }
        },
        "commercial_music_category_ids": [],
        "pc_feature_flag": 0,
        "recognize_tasks": [],
        "reference_lines_config": {
          "horizontal_lines": [],
          "is_lock": false,
          "is_visible": false,
          "vertical_lines": []
        },
        "safe_area_type": 0,
        "template_item_infos": [],
        "unlock_template_ids": []
      },
      'performance_opt_info.json': {
        "manual_cancle_precombine_segs": null,
        "need_auto_precombine_segs": null
      },
      'attachment_editing.json': { "attachment_info": [] },
      'template-2.tmp': draftContent
    }
  };
}
