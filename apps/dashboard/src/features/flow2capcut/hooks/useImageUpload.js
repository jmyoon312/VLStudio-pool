/**
 * useImageUpload Hook - 이미지 업로드 공통 로직
 * 
 * 클릭/드래그앤드롭 업로드 + Flow 자동 업로드
 */

import { useState, useRef, useCallback } from 'react'
import { cleanBase64 } from '../utils/urls'

export function useImageUpload(options = {}) {
  const { 
    onUploadComplete,  // (data) => void - 업로드 완료 콜백
    uploadToFlow,     // (base64, category) => Promise - Flow 업로드 함수
    category = 'MEDIA_CATEGORY_SUBJECT'  // 기본 카테고리
  } = options
  
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef(null)
  
  // 파일 처리
  const processFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return null
    
    setIsUploading(true)
    
    try {
      // base64로 변환
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      
      const cleanB64 = cleanBase64(base64)
      
      let result = {
        data: base64,
        mediaId: null,
        caption: null
      }
      
      // Flow에 업로드 (함수가 있으면)
      if (uploadToFlow) {
        try {
          const uploadResult = await uploadToFlow(cleanB64, category)
          if (uploadResult.success) {
            result.mediaId = uploadResult.mediaId
            result.caption = uploadResult.caption || null
          }
        } catch (e) {
          console.warn('Flow upload failed:', e)
        }
      }
      
      // 완료 콜백
      if (onUploadComplete) {
        onUploadComplete(result)
      }
      
      return result
      
    } catch (error) {
      console.error('File processing error:', error)
      return null
    } finally {
      setIsUploading(false)
    }
  }, [uploadToFlow, category, onUploadComplete])
  
  // 파일 선택 핸들러
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
      // input 리셋 (같은 파일 다시 선택 가능하게)
      e.target.value = ''
    }
  }, [processFile])
  
  // 드래그 오버 핸들러
  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])
  
  // 드래그 떠남 핸들러
  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])
  
  // 드롭 핸들러
  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const file = e.dataTransfer.files?.[0]
    if (file) {
      await processFile(file)
    }
  }, [processFile])
  
  // 파일 선택 다이얼로그 열기
  const openFileDialog = useCallback(() => {
    if (!isUploading) {
      fileInputRef.current?.click()
    }
  }, [isUploading])
  
  // 드롭존에 바인딩할 props
  const getDropZoneProps = useCallback(() => ({
    onClick: openFileDialog,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop
  }), [openFileDialog, handleDragOver, handleDragLeave, handleDrop])
  
  // 파일 input에 바인딩할 props
  const getInputProps = useCallback(() => ({
    type: 'file',
    ref: fileInputRef,
    accept: 'image/*',
    onChange: handleFileSelect,
    style: { display: 'none' }
  }), [handleFileSelect])
  
  return {
    // 상태
    isUploading,
    isDragOver,
    
    // refs
    fileInputRef,
    
    // 핸들러
    processFile,
    openFileDialog,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    
    // 편의 함수
    getDropZoneProps,
    getInputProps
  }
}

export default useImageUpload
