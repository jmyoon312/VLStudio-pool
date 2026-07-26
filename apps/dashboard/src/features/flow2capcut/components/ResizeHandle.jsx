/**
 * ResizeHandle - 드래그로 패널 크기 조절
 */

import { useCallback, useEffect, useRef } from 'react'
import './ResizeHandle.css'

export function ResizeHandle({ onResize, minTop = 200, minBottom = 100 }) {
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    isDragging.current = true
    startY.current = e.clientY

    // 현재 bottom-panel 높이 저장
    const bottomPanel = document.querySelector('.bottom-panel')
    if (bottomPanel) {
      startHeight.current = bottomPanel.offsetHeight
    }

    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return

    const deltaY = startY.current - e.clientY
    const newHeight = startHeight.current + deltaY

    // 전체 앱 높이
    const appHeight = document.querySelector('.app')?.offsetHeight || window.innerHeight

    // 최소/최대 제한
    const maxHeight = appHeight - minTop
    const clampedHeight = Math.max(minBottom, Math.min(maxHeight, newHeight))

    onResize(clampedHeight)
  }, [onResize, minTop, minBottom])

  const handleMouseUp = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  // 터치 이벤트 지원
  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0]
    isDragging.current = true
    startY.current = touch.clientY

    const bottomPanel = document.querySelector('.bottom-panel')
    if (bottomPanel) {
      startHeight.current = bottomPanel.offsetHeight
    }
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current) return

    const touch = e.touches[0]
    const deltaY = startY.current - touch.clientY
    const newHeight = startHeight.current + deltaY

    const appHeight = document.querySelector('.app')?.offsetHeight || window.innerHeight
    const maxHeight = appHeight - minTop
    const clampedHeight = Math.max(minBottom, Math.min(maxHeight, newHeight))

    onResize(clampedHeight)
  }, [onResize, minTop, minBottom])

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd])

  return (
    <div
      className="resize-handle"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className="resize-handle-bar" />
    </div>
  )
}

export default ResizeHandle
