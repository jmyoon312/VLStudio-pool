/**
 * URL/Base64 유틸리티
 */

// ============================================================
// Base64 처리
// ============================================================

/**
 * base64 데이터에서 prefix 제거 (순수 데이터만)
 * @param {string} base64 - data:image/png;base64,xxx 또는 xxx
 * @returns {string} 순수 base64 데이터
 */
export function cleanBase64(base64) {
  if (!base64) return ''
  return base64.replace(/^data:[^;]+;base64,/, '')
}

/**
 * base64 데이터에 data URL prefix 추가
 * @param {string} base64 - 순수 base64 데이터
 * @param {string} mimeType - MIME 타입 (기본: image/png)
 * @returns {string} data:image/png;base64,xxx 형식
 */
export function toDataURL(base64, mimeType = 'image/png') {
  if (!base64) return ''
  if (base64.startsWith('data:')) return base64
  return `data:${mimeType};base64,${base64}`
}

/**
 * base64 이미지인지 확인
 * @param {string} data
 * @returns {boolean}
 */
export function isBase64Image(data) {
  if (!data) return false
  return data.startsWith('data:image/') || /^[A-Za-z0-9+/=]+$/.test(data.slice(0, 100))
}

/**
 * base64 시그니처로 이미지 타입 감지
 * @param {string} base64Data - base64 데이터 (prefix 있어도 됨)
 * @returns {string} 확장자 ('png', 'jpg', 'gif', 'webp')
 */
export function detectImageType(base64Data) {
  if (!base64Data) return 'png'
  
  const clean = cleanBase64(base64Data)
  const signatures = {
    '/9j/': 'jpg',      // JPEG
    'iVBOR': 'png',     // PNG
    'R0lGO': 'gif',     // GIF
    'UklGR': 'webp'     // WebP
  }
  
  for (const [sig, ext] of Object.entries(signatures)) {
    if (clean.startsWith(sig)) return ext
  }
  
  return 'png'
}

/**
 * base64 데이터 크기 추정 (bytes)
 * @param {string} base64Data
 * @returns {number}
 */
export function estimateBase64Size(base64Data) {
  if (!base64Data) return 0
  const clean = cleanBase64(base64Data)
  // base64는 원본의 약 4/3 크기
  return Math.ceil(clean.length * 3 / 4)
}

// ============================================================
// URL 처리
// ============================================================

/**
 * 파일 URL 정규화 (base64, blob, http 모두 처리)
 * @param {string} path - 파일 경로 또는 URL
 * @returns {string|null}
 */
export function getFileUrl(path) {
  if (!path) return null
  // data:, blob:, http: URL은 그대로 반환
  if (path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('http')) {
    return path
  }
  return path
}

/**
 * blob URL을 base64로 변환
 * @param {string} blobUrl
 * @returns {Promise<string>}
 */
export async function blobUrlToBase64(blobUrl) {
  const response = await fetch(blobUrl)
  const blob = await response.blob()
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * File 객체를 base64로 변환
 * @param {File} file
 * @returns {Promise<string>}
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * base64를 Blob으로 변환
 * @param {string} base64 - data URL 형식
 * @returns {Blob}
 */
export function base64ToBlob(base64) {
  const [header, data] = base64.split(',')
  const mimeMatch = header.match(/data:([^;]+)/)
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png'
  
  const binary = atob(data)
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i)
  }
  
  return new Blob([array], { type: mimeType })
}
