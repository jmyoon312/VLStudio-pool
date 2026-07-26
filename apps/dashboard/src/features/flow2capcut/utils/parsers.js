/**
 * Parsers - 텍스트/CSV/SRT 파싱 유틸리티
 */

import { DEFAULTS } from '../config/defaults'

// ============================================================
// 기본 유틸
// ============================================================

/**
 * 시간 문자열을 초 단위 숫자로 변환
 * 지원 포맷: "HH:MM:SS.mmm", "HH:MM:SS,mmm", "MM:SS.mmm", "MM:SS", 또는 숫자(초)
 */
export function parseTimeToSeconds(timeStr) {
  if (timeStr === undefined || timeStr === null || timeStr === '') return NaN
  const num = Number(timeStr)
  if (!isNaN(num)) return num
  const str = String(timeStr).trim().replace(',', '.')
  const parts = str.split(':')
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
  }
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
  }
  return NaN
}

/**
 * CSV 라인 파싱 (따옴표 처리)
 */
export function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

/**
 * SRT 시간 파싱 (00:00:00,000 -> 초)
 */
export function parseSRTTime(timeStr) {
  const [time, ms] = timeStr.replace(',', '.').split('.')
  const [hours, minutes, seconds] = time.split(':').map(Number)
  return hours * 3600 + minutes * 60 + seconds + (parseInt(ms) / 1000)
}

// ============================================================
// 씬 파싱
// ============================================================

/**
 * 텍스트에서 씬 파싱 (줄바꿈 구분)
 * @param {string} text - 입력 텍스트
 * @param {number} defaultDuration - 기본 duration (초)
 * @returns {Array} 씬 배열
 */
export function parseTextToScenes(text, defaultDuration = DEFAULTS.scene.duration) {
  const lines = text.trim().split('\n').filter(line => line.trim())
  let currentTime = 0
  
  return lines.map((line, index) => {
    const startTime = currentTime
    const endTime = currentTime + defaultDuration
    currentTime = endTime
    
    return {
      id: `scene_${index + 1}`,
      startTime,
      endTime,
      duration: defaultDuration,
      prompt: line.trim(),
      subtitle: '',
      characters: '',
      scene_tag: '',
      style_tag: '',
      status: 'pending',
      image: null
    }
  })
}

/**
 * CSV에서 씬 파싱
 * @param {string} csvText - CSV 텍스트
 * @param {number} defaultDuration - 기본 duration
 * @returns {Array} 씬 배열
 */
export function parseCSVToScenes(csvText, defaultDuration = DEFAULTS.scene.duration) {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  
  let currentTime = 0
  const scenes = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (!values.length) continue
    
    const row = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx] || ''
    })
    
    const duration = parseFloat(row.duration) || defaultDuration
    const parsedStart = parseTimeToSeconds(row.start_time)
    const startTime = !isNaN(parsedStart) ? parsedStart : currentTime
    const parsedEnd = parseTimeToSeconds(row.end_time)
    const endTime = !isNaN(parsedEnd) ? parsedEnd : startTime + duration
    
    currentTime = endTime
    
    scenes.push({
      id: `scene_${i}`,
      startTime,
      endTime,
      duration: endTime - startTime,
      prompt: row.prompt || row.prompt_en || '',
      prompt_ko: row.prompt_ko || '',
      subtitle: row.subtitle || row.subtitle_ko || '',
      subtitle_en: row.subtitle_en || '',
      characters: row.characters || row.character || '',
      scene_tag: row.scene_tag || row.scene || row.background || '',
      style_tag: row.style_tag || row.style || '',
      status: 'pending',
      image: null
    })
  }
  
  return scenes
}

/**
 * SRT에서 씬 파싱
 * @param {string} srtText - SRT 텍스트
 * @returns {Array} 씬 배열
 */
export function parseSRTToScenes(srtText) {
  // Normalize CRLF to LF to prevent parsing issues on Windows
  const normalizedText = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = normalizedText.trim().split(/\n\n+/)
  const scenes = []
  
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 3) continue
    
    // 시간 라인 파싱: 00:00:00,000 --> 00:00:03,000
    const timeLine = lines[1]
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/)
    
    if (!timeMatch) continue
    
    const startTime = parseSRTTime(timeMatch[1])
    const endTime = parseSRTTime(timeMatch[2])
    
    // 자막 텍스트 (3번째 줄 이후)
    const subtitle = lines.slice(2).join('\n').trim()
    
    scenes.push({
      id: `scene_${scenes.length + 1}`,
      startTime,
      endTime,
      duration: endTime - startTime,
      prompt: subtitle, // SRT의 자막을 프롬프트로 사용
      subtitle,
      characters: '',
      scene_tag: '',
      style_tag: '',
      status: 'pending',
      image: null
    })
  }
  
  return scenes
}

// ============================================================
// 파일 타입 감지
// ============================================================

/**
 * 파일 내용을 분석하여 타입 판별
 * @param {string} content - 파일 내용
 * @returns {'text' | 'csv' | 'srt' | 'reference' | 'unknown'} 파일 타입
 */
export function detectFileType(content) {
  const trimmed = content.trim()
  if (!trimmed) return 'unknown'

  // SRT 감지: 타임코드 패턴 (00:00:00,000 --> 00:00:03,000)
  const srtPattern = /\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,\.]\d{3}/
  if (srtPattern.test(trimmed)) {
    return 'srt'
  }

  // CSV 감지: 첫 줄에 콤마가 있고, 헤더처럼 보이는 경우
  const firstLine = trimmed.split('\n')[0]
  if (firstLine.includes(',')) {
    const csvType = detectCSVType(content)
    if (csvType === 'reference') return 'reference'
    if (csvType === 'scene') return 'csv'
    // CSV 형식이지만 타입을 알 수 없는 경우
    if (csvType === 'unknown' && firstLine.split(',').length >= 2) {
      return 'csv' // 기본적으로 씬 CSV로 간주
    }
  }

  // 그 외는 일반 텍스트
  return 'text'
}

/**
 * CSV 헤더를 분석하여 씬 CSV인지 레퍼런스 CSV인지 판별
 * @param {string} csvContent - CSV 텍스트
 * @returns {'scene' | 'reference' | 'unknown'} CSV 타입
 */
export function detectCSVType(csvContent) {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 1) return 'unknown'

  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim())

  // 레퍼런스 CSV 특성: name 컬럼 필수, type 컬럼 있음, prompt 컬럼 없거나 선택적
  // 씬 CSV 특성: prompt 컬럼 필수, subtitle/characters/scene_tag/style_tag/duration 등

  const hasName = header.includes('name')
  const hasType = header.includes('type')
  const hasPrompt = header.includes('prompt') || header.includes('prompt_en') || header.includes('prompt_ko')
  const hasSubtitle = header.includes('subtitle') || header.includes('subtitle_ko') || header.includes('subtitle_en')
  const hasCharacters = header.includes('characters') || header.includes('character')
  const hasSceneTag = header.includes('scene_tag') || header.includes('scene') || header.includes('background')
  const hasStyleTag = header.includes('style_tag') || header.includes('style')
  const hasDuration = header.includes('duration')

  // 레퍼런스 CSV: name + type 있고, 씬 관련 컬럼(subtitle, characters, scene_tag, duration) 없음
  if (hasName && hasType && !hasSubtitle && !hasCharacters && !hasDuration) {
    return 'reference'
  }

  // 씬 CSV: prompt 있고, 씬 관련 컬럼 중 하나라도 있음
  if (hasPrompt && (hasSubtitle || hasCharacters || hasSceneTag || hasStyleTag || hasDuration)) {
    return 'scene'
  }

  // prompt만 있는 경우 씬으로 간주
  if (hasPrompt && !hasName) {
    return 'scene'
  }

  // name만 있고 type도 있으면 레퍼런스
  if (hasName && hasType) {
    return 'reference'
  }

  return 'unknown'
}

// ============================================================
// 레퍼런스 파싱
// ============================================================

const TYPE_TO_CATEGORY = {
  'character': 'MEDIA_CATEGORY_SUBJECT',
  'scene': 'MEDIA_CATEGORY_SCENE',
  'background': 'MEDIA_CATEGORY_SCENE',  // background도 scene으로 매핑
  'style': 'MEDIA_CATEGORY_STYLE'
}

/**
 * CSV에서 레퍼런스 파싱
 * @param {string} csvContent - CSV 텍스트
 * @returns {Array|null} 레퍼런스 배열 또는 null
 */
export function parseReferencesCSV(csvContent) {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) return null

  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim())
  const nameIdx = header.indexOf('name')
  const typeIdx = header.indexOf('type')
  // prompt 또는 description 컬럼 지원
  let promptIdx = header.indexOf('prompt')
  if (promptIdx === -1) promptIdx = header.indexOf('description')
  // image_path 또는 image 컬럼 지원
  let imagePathIdx = header.indexOf('image_path')
  if (imagePathIdx === -1) imagePathIdx = header.indexOf('image')

  if (nameIdx === -1) {
    console.warn('Reference CSV: name column required')
    return null
  }

  const refs = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseCSVLine(line)
    const name = values[nameIdx]?.trim()
    if (!name) continue

    const type = typeIdx !== -1 ? values[typeIdx]?.trim().toLowerCase() : 'character'
    const prompt = promptIdx !== -1 ? values[promptIdx]?.trim() : ''
    const imagePath = imagePathIdx !== -1 ? values[imagePathIdx]?.trim() : ''
    const category = TYPE_TO_CATEGORY[type] || 'MEDIA_CATEGORY_SUBJECT'

    // type value 매핑 (background -> scene)
    const typeValue = (type === 'scene' || type === 'background') ? 'scene'
      : type === 'style' ? 'style'
      : 'character'

    refs.push({
      name,
      type: typeValue,
      category,
      prompt,
      imagePath  // 이미지 경로 추가
    })
  }
  
  return refs.length > 0 ? refs : null
}

/**
 * 기존 레퍼런스와 새 레퍼런스 병합
 * @param {Array} existing - 기존 레퍼런스 배열
 * @param {Array} newRefs - 새 레퍼런스 배열
 * @param {boolean} updateExisting - 중복 시 업데이트 여부
 * @returns {Array} 병합된 레퍼런스 배열
 */
export function mergeReferences(existing, newRefs, updateExisting = true) {
  const updated = [...existing]

  for (const newRef of newRefs) {
    const existingIdx = updated.findIndex(r => r.name === newRef.name)

    if (existingIdx !== -1) {
      if (updateExisting) {
        // 기존 레퍼런스 업데이트 (mediaId 유지, 새 이미지가 있으면 덮어쓰기)
        updated[existingIdx] = {
          ...updated[existingIdx],
          type: newRef.type,
          category: newRef.category,
          prompt: newRef.prompt,
          imagePath: newRef.imagePath || updated[existingIdx].imagePath,
          // 새 레퍼런스에 이미지 데이터가 있으면 사용
          data: newRef.data || updated[existingIdx].data
        }
      }
      // updateExisting이 false면 건너뜀
    } else {
      // 새 레퍼런스 추가
      updated.push({
        id: Date.now() + updated.length,
        name: newRef.name,
        type: newRef.type,
        category: newRef.category,
        prompt: newRef.prompt,
        imagePath: newRef.imagePath || '',
        data: newRef.data || null,  // CSV에서 로드한 이미지 데이터
        mediaId: null,
        caption: ''
      })
    }
  }

  return updated
}

/**
 * 중복 레퍼런스 이름 찾기
 * @param {Array} existing - 기존 레퍼런스 배열
 * @param {Array} newRefs - 새 레퍼런스 배열
 * @returns {Array} 중복 이름 배열
 */
export function findDuplicateReferenceNames(existing, newRefs) {
  return newRefs
    .filter(newRef => existing.some(r => r.name === newRef.name))
    .map(r => r.name)
}
