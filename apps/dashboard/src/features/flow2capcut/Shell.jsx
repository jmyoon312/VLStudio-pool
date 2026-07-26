/**
 * Shell - Electron Desktop 외부 쉘
 *
 * 레이아웃 모드 (Split only — Tab 모드 제거):
 * - split-left: Flow 왼쪽 / App 오른쪽 (기본값)
 * - split-right: Flow 오른쪽 / App 왼쪽
 * - split-top: Flow 상단 / App 하단
 * - split-bottom: Flow 하단 / App 상단
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { resetModalCount } from '../../lib/utils'

const DEFAULT_LAYOUT = 'split-left'
const DEFAULT_RATIO = 0.5

// 수평 분할인지 판별
function isHorizontalSplit(mode) {
  return mode === 'split-left' || mode === 'split-right'
}

function ShellContent({ children }) {
  const [layoutMode, setLayoutMode] = useState(() => {
    try {
      const saved = localStorage.getItem('layoutSettings')
      if (saved) {
        const { mode } = JSON.parse(saved)
        if (mode && mode !== 'tab' && mode !== 'none') return mode
      }
    } catch (e) { }
    return DEFAULT_LAYOUT
  })
  const [splitRatio, setSplitRatio] = useState(() => {
    try {
      const saved = localStorage.getItem('layoutSettings')
      if (saved) {
        const { ratio } = JSON.parse(saved)
        if (ratio !== undefined) return ratio
      }
    } catch (e) { }
    return DEFAULT_RATIO
  })
  const [isDragging, setIsDragging] = useState(false)
  const shellRef = useRef(null)

  // Multi-View & Profile States
  const [profileConfig, setProfileConfig] = useState({ activeProfileId: 'default', profiles: [] })
  const [activeViews, setActiveViews] = useState([])

  // 로컬 프로필 및 활성 뷰 실시간 로딩/동기화
  const loadProfilesAndViews = useCallback(async () => {
    try {
      const config = await window.electronAPI?.loadProfiles?.()
      if (config) setProfileConfig(config)
      const viewsRes = await window.electronAPI?.getActiveViews?.()
      if (viewsRes && Array.isArray(viewsRes.views)) {
        setActiveViews(viewsRes.views.map(v => v.profileId))
      }

      // Failsafe: if any modals/dialogs are actually visible in the DOM, ensure the flow views are hidden; otherwise make them visible.
      // NOTE: [role="listbox"] and [role="menu"] are intentionally excluded because Radix UI
      // mounts these in the DOM even when closed (hidden state), causing false positives.
      // We only check for dialog/alertdialog with data-state="open" to detect truly open overlays.
      const hasOpenDialogInDOM = document.querySelectorAll(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], .export-modal-overlay, .auth-modal-overlay, .modal-overlay, .paywall-overlay, .drawer-overlay'
      ).length > 0
      if (hasOpenDialogInDOM) {
        window.electronAPI?.setModalVisible?.({ visible: true })
      } else {
        resetModalCount()
      }
    } catch (e) {
      // Silent catch to avoid console spam
    }
  }, [])

  useEffect(() => {
    // flow 뷰 가시성 복원
    window.electronAPI?.setModalVisible?.({ visible: false })

    loadProfilesAndViews()

    let unsubFlowStatus
    let unsubLayoutChanged

    if (window.electronAPI?.onFlowStatus) {
      unsubFlowStatus = window.electronAPI.onFlowStatus(() => loadProfilesAndViews())
    }
    if (window.electronAPI?.onLayoutChanged) {
      unsubLayoutChanged = window.electronAPI.onLayoutChanged(({ mode, splitRatio: ratio }) => {
        if (mode && mode !== 'none') {
          setLayoutMode(mode)
        }
        if (ratio !== undefined) {
          setSplitRatio(ratio)
        }
      })
    }

    return () => {
      if (unsubFlowStatus) unsubFlowStatus()
      if (unsubLayoutChanged) unsubLayoutChanged()
    }
  }, [loadProfilesAndViews])

  // 레이아웃 변경 시 localStorage 저장 및 Electron IPC 동기화
  useEffect(() => {
    if (layoutMode && layoutMode !== 'none') {
      localStorage.setItem('layoutSettings', JSON.stringify({ mode: layoutMode, ratio: splitRatio }))
    }
    window.electronAPI?.setLayout?.({ mode: layoutMode, ratio: splitRatio })
  }, [layoutMode, splitRatio])

  // 드래그 리사이저
  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  // 더블클릭 → 50:50 리셋
  const handleDoubleClick = useCallback(() => {
    setSplitRatio(DEFAULT_RATIO)
    window.electronAPI?.updateSplit?.({ ratio: DEFAULT_RATIO })
  }, [])

  useEffect(() => {
    if (!isDragging) return
    const horizontal = isHorizontalSplit(layoutMode)

    const handleMouseMove = (e) => {
      if (!shellRef.current) return
      const rect = shellRef.current.getBoundingClientRect()
      const total = horizontal ? rect.width : rect.height
      let rawPos
      if (horizontal) {
        rawPos = e.clientX - rect.left
      } else {
        rawPos = e.clientY - rect.top
      }
      const isReversed = layoutMode === 'split-right' || layoutMode === 'split-bottom'
      const newRatio = isReversed
        ? Math.max(0.2, Math.min(0.8, (total - rawPos) / total))
        : Math.max(0.2, Math.min(0.8, rawPos / total))

      window.electronAPI?.updateSplit?.({ ratio: newRatio })
      setSplitRatio(newRatio)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, layoutMode])

  const horizontal = isHorizontalSplit(layoutMode)

  // 리사이저 스타일 — shell 전체 기준 absolute 포지션
  const getResizerStyle = () => {
    const flowPctVal = splitRatio * 100
    const appPctVal = (1 - splitRatio) * 100
    if (layoutMode === 'split-left') {
      return {
        position: 'absolute', top: 0, left: `${flowPctVal}%`,
        width: '6px', height: '100%', transform: 'translateX(-3px)',
        cursor: 'col-resize', zIndex: 100
      }
    }
    if (layoutMode === 'split-right') {
      return {
        position: 'absolute', top: 0, left: `${appPctVal}%`,
        width: '6px', height: '100%', transform: 'translateX(-3px)',
        cursor: 'col-resize', zIndex: 100
      }
    }
    if (layoutMode === 'split-top') {
      return {
        position: 'absolute', top: `${flowPctVal}%`, left: 0,
        width: '100%', height: '6px', transform: 'translateY(-3px)',
        cursor: 'row-resize', zIndex: 100
      }
    }
    if (layoutMode === 'split-bottom') {
      return {
        position: 'absolute', top: `${appPctVal}%`, left: 0,
        width: '100%', height: '6px', transform: 'translateY(-3px)',
        cursor: 'row-resize', zIndex: 100
      }
    }
    return {}
  }

  // 뷰 클릭 시 활성 스위칭
  const handleViewClick = async (profileId) => {
    try {
      await window.electronAPI?.switchProfile?.({ profileId })
      loadProfilesAndViews()
    } catch (e) {
      console.warn("Failed to switch profile in Shell:", e)
    }
  }

  // 뷰 안전 파기 요청
  const handleDestroyView = async (profileId) => {
    const profile = profileConfig.profiles.find(p => p.id === profileId)
    const name = profile?.name || profileId
    const confirmClose = window.confirm(`정말 "${name}" 창을 닫으시겠습니까?\n메인 뷰 레이아웃에서 제거됩니다.`)
    if (!confirmClose) return
    try {
      const res = await window.electronAPI?.destroyFlowView?.({ profileId })
      if (res?.success) {
        loadProfilesAndViews()
      }
    } catch (e) {
      console.warn("Failed to destroy flow view:", e)
    }
  }

  // 다중 뷰 헤더 바인더 및 그리드 플레이스홀더 렌더링
  const renderFlowPlaceholders = () => {
    const count = activeViews.length
    if (count === 0) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', width: '100%', background: '#FFFFFF', borderRight: '1px solid #E5E7EB',
          color: '#9CA3AF', fontFamily: 'system-ui, sans-serif', padding: '24px', textAlign: 'center'
        }}>
          <span style={{ fontSize: '32px', marginBottom: '8px' }}>🔲</span>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#374151' }}>활성화된 Flow 창이 없습니다.</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6B7280' }}>우측 상단의 프로필 드롭다운에서 계정을 선택해 활성화하세요.</p>
        </div>
      )
    }

    const gridStyle = {
      display: 'grid',
      width: '100%',
      height: '100%',
      background: '#F3F4F6',
      gap: '3px',
      padding: '3px',
      boxSizing: 'border-box',
    }

    if (count === 1) {
      gridStyle.gridTemplateColumns = '1fr'
      gridStyle.gridTemplateRows = '1fr'
    } else if (count === 2) {
      gridStyle.gridTemplateColumns = '1fr 1fr'
      gridStyle.gridTemplateRows = '1fr'
    } else {
      gridStyle.gridTemplateColumns = '1fr 1fr'
      gridStyle.gridTemplateRows = '1fr 1fr'
    }

    return (
      <div style={gridStyle}>
        {activeViews.map((id) => {
          const profile = profileConfig.profiles.find(p => p.id === id)
          const name = profile?.name || (id === 'default' ? '기본 프로필' : id)
          const isFocused = profileConfig.activeProfileId === id
          const isYT = id.startsWith('yt_') // 유튜브 전용 계정 식별

          return (
            <div
              key={id}
              onClick={() => handleViewClick(id)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                background: '#FFFFFF',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: isFocused 
                  ? 'inset 0 0 0 2px #3B82F6, 0 10px 15px -3px rgba(59, 130, 246, 0.1)' 
                  : 'inset 0 0 0 1px #E5E7EB',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
              }}
            >
              {/* Header overlay for visual grid control */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '30px',
                padding: '0 10px',
                background: isFocused ? 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)' : '#F9FAFB',
                borderBottom: '1px solid #E5E7EB',
                zIndex: 10,
                userSelect: 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: isFocused ? '#3B82F6' : '#9CA3AF'
                  }} />
                  <span style={{
                    fontSize: '11px', fontWeight: 600,
                    color: isFocused ? '#1E3A8A' : '#374151',
                    maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {name}
                  </span>
                  <span style={{
                    fontSize: '9px', padding: '1px 5px', borderRadius: '4px',
                    background: isYT ? '#FEF3C7' : '#E0F2FE',
                    color: isYT ? '#D97706' : '#0284C7',
                    fontWeight: 700,
                    letterSpacing: '-0.3px'
                  }}>
                    {isYT ? '🔵 LTE 격리' : '🟢 Wi-Fi'}
                  </span>
                </div>
                {id !== 'default' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDestroyView(id)
                    }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '14px', color: '#9CA3AF', padding: '0 4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => e.target.style.color = '#EF4444'}
                    onMouseLeave={(e) => e.target.style.color = '#9CA3AF'}
                  >
                    ✕
                  </button>
                )}
              </div>
              
              {/* Native WebView covers this entire area. Bounds calculated below the overlay header. */}
              <div style={{ flex: 1, background: 'transparent' }} />
            </div>
          )
        })}
      </div>
    )
  }

  if (activeViews.length === 0 || layoutMode === 'none' || layoutMode === 'tab' || !layoutMode.startsWith('split-')) {
    return <div style={{ width: '100%', height: '100vh', overflow: 'hidden' }}>{children}</div>
  }

  const flowPct = `${splitRatio * 100}%`
  const appPct = `${(1 - splitRatio) * 100}%`

  if (horizontal) {
    const isLeft = layoutMode === 'split-left'
    return (
      <div
        className="shell-root split-mode"
        ref={shellRef}
        style={{ display: 'flex', flexDirection: 'row', height: '100vh', width: '100%', overflow: 'hidden', position: 'relative' }}
      >
        {/* Flow placeholders */}
        {isLeft && <div style={{ width: flowPct, flexShrink: 0, height: '100%' }}>{renderFlowPlaceholders()}</div>}

        {/* React App Content */}
        <div className="app-content-split" style={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative' }}>
          {children}
        </div>

        {/* Flow placeholders (right side) */}
        {!isLeft && <div style={{ width: flowPct, flexShrink: 0, height: '100%' }}>{renderFlowPlaceholders()}</div>}

        {/* Drag Resizer */}
        <div
          className="split-resizer"
          style={getResizerStyle()}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
        >
          <div className="split-resizer-handle" />
        </div>

        {isDragging && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99, cursor: 'col-resize' }} />
        )}
      </div>
    )
  }

  const isTop = layoutMode === 'split-top'
  return (
    <div
      className="shell-root split-mode"
      ref={shellRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', overflow: 'hidden', position: 'relative' }}
    >
      {isTop && <div style={{ height: flowPct, flexShrink: 0, width: '100%' }}>{renderFlowPlaceholders()}</div>}

      <div className="app-content-split" style={{ flex: 1, width: '100%', overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>

      {!isTop && <div style={{ height: flowPct, flexShrink: 0, width: '100%' }}>{renderFlowPlaceholders()}</div>}

      {/* Drag Resizer */}
      <div
        className="split-resizer"
        style={getResizerStyle()}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        <div className="split-resizer-handle" />
      </div>

      {isDragging && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99, cursor: 'row-resize' }} />
      )}
    </div>
  )
}

export default function Shell({ children }) {
  return <ShellContent>{children}</ShellContent>
}
