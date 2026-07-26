/**
 * Header Component - 상단 바
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useI18n, LANGUAGES } from '../hooks/useI18n'
import { TIMING } from '../config/defaults'
import { fileSystemAPI } from '../hooks/useFileSystem'
import { UserMenu } from './UserMenu'
import { SideDrawer } from './SideDrawer'
import Modal from './Modal'
import './Header.css'

// ============================================================
// LayoutPicker — 헤더 인라인 레이아웃 컨트롤
// 방향(좌/우/상/하) + 비율 슬라이더를 드롭다운으로 표시
// ============================================================
const LAYOUT_MODES = [
  { value: 'split-left',   icon: '⬅', label: 'Flow 좌측' },
  { value: 'split-right',  icon: '➡', label: 'Flow 우측' },
  { value: 'split-top',    icon: '⬆', label: 'Flow 상단' },
  { value: 'split-bottom', icon: '⬇', label: 'Flow 하단' },
]

function LayoutPicker() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState(() => {
    try { return JSON.parse(localStorage.getItem('layoutSettings') || '{}').mode || 'split-left' } catch { return 'split-left' }
  })
  const [ratio, setRatio] = useState(() => {
    try { return Math.round((JSON.parse(localStorage.getItem('layoutSettings') || '{}').ratio || 0.5) * 100) } catch { return 50 }
  })
  const ref = useRef(null)

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 외부에서 layout-changed 이벤트 수신 시 동기화
  useEffect(() => {
    const handler = window.electronAPI?.onLayoutChanged
    if (handler) {
      return handler(({ mode: m, splitRatio: r }) => {
        setMode(m)
        setRatio(Math.round((r || 0.5) * 100))
      })
    }
  }, [])

  const applyLayout = useCallback((newMode, newRatioInt) => {
    const r = newRatioInt / 100
    localStorage.setItem('layoutSettings', JSON.stringify({ mode: newMode, ratio: r }))
    window.electronAPI?.setLayout?.({ mode: newMode, ratio: r })
  }, [])

  const handleModeChange = (newMode) => {
    setMode(newMode)
    applyLayout(newMode, ratio)
  }

  const handleRatioChange = (e) => {
    const v = parseInt(e.target.value)
    setRatio(v)
    // 슬라이더는 드래그 중에도 실시간 적용
    const r = v / 100
    localStorage.setItem('layoutSettings', JSON.stringify({ mode, ratio: r }))
    window.electronAPI?.updateSplit?.({ ratio: r })
  }

  const currentMode = LAYOUT_MODES.find(m => m.value === mode) || LAYOUT_MODES[0]

  return (
    <div className="layout-picker" ref={ref}>
      <button
        type="button"
        className="layout-picker-btn"
        onClick={() => setOpen(v => !v)}
        title="화면 레이아웃 변경"
      >
        <span className="layout-picker-icon">{currentMode.icon}</span>
        <span className="layout-picker-label">{ratio}%</span>
        <svg className="layout-picker-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="layout-picker-menu">
          <div className="layout-picker-title">📐 화면 배치</div>
          {/* 방향 버튼 */}
          <div className="layout-mode-grid">
            {LAYOUT_MODES.map(m => (
              <button
                key={m.value}
                type="button"
                className={`layout-mode-btn ${mode === m.value ? 'active' : ''}`}
                onClick={() => handleModeChange(m.value)}
                title={m.label}
              >
                <span className="lm-icon">{m.icon}</span>
                <span className="lm-label">{m.label}</span>
              </button>
            ))}
          </div>
          {/* 비율 슬라이더 */}
          <div className="layout-ratio-row">
            <span className="layout-ratio-label">Flow 크기</span>
            <div className="layout-ratio-slider-wrap">
              <span className="layout-ratio-edge">20%</span>
              <input
                type="range"
                min="20" max="80" step="5"
                value={ratio}
                onChange={handleRatioChange}
                className="layout-ratio-slider"
              />
              <span className="layout-ratio-edge">80%</span>
            </div>
            <span className="layout-ratio-val">{ratio}%</span>
          </div>
          {/* 더블클릭 힌트 */}
          <div className="layout-picker-hint">💡 경계선 더블클릭 → 50:50 리셋</div>
        </div>
      )}
    </div>
  )
}

/**
 * FlagIcon — flag-icons CSS 라이브러리 클래스 사용
 * Vite가 node_modules/flag-icons/flags 의 SVG 자산을 번들링
 */
function FlagIcon({ country, className = 'lang-flag' }) {
  if (!country) return <span className={className} />
  return <span className={`fi fi-${country} ${className}`} aria-hidden="true" />
}

/**
 * LanguagePicker — 커스텀 언어 드롭다운 (인라인 SVG 국기 + 언어코드)
 */
function LanguagePicker({ current, languages, onChange, tooltip }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const currentLang = languages.find((l) => l.code === current) || languages[0]

  return (
    <div className="lang-picker" ref={ref} data-tooltip={tooltip}>
      <button
        type="button"
        className="lang-picker-button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={tooltip}
      >
        <FlagIcon country={currentLang.country} />
        <span className="lang-code">{currentLang.name}</span>
        <svg className="lang-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="lang-picker-menu">
          {languages.map((l) => (
            <button
              type="button"
              key={l.code}
              className={`lang-picker-item ${l.code === current ? 'active' : ''}`}
              onClick={() => {
                onChange(l.code)
                setOpen(false)
              }}
            >
              <FlagIcon country={l.country} />
              <span className="lang-code">{l.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Header({
  onSettings,
  onExport,
  hasImages,
  getAccessToken,
  clearTokenCache,
  authReady,
  setAuthReady,
  projectName,
  onProjectChange,
  onNewProject,
  saveMode,
  onLoginClick,
  onUpgradeClick,
  disabled = false  // 생성 중일 때 프로젝트 전환 비활성화
}) {
  const navigate = useNavigate()
  const { t, lang, changeLang, languages } = useI18n()
  const [authStatus, setAuthStatus] = useState('checking') // 'checking' | 'authenticated' | 'unauthenticated' | 'waiting'
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [projects, setProjects] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null) // Confirm 모달용
  const dropdownRef = useRef(null)
  const pollingRef = useRef(null)
  
  // -------------------------------------------------------------
  // Flow Multi-Profile Manager States & Handlers
  // -------------------------------------------------------------
  const [profileConfig, setProfileConfig] = useState({ activeProfileId: 'default', profiles: [] })
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const [newProfileEmail, setNewProfileEmail] = useState('')
  const profileDropdownRef = useRef(null)
  const loadFlowProfiles = async () => {
    try {
      const config = await window.electronAPI.loadProfiles()
      if (config) {
        setProfileConfig(config)
      }
    } catch (err) {
      console.error('Failed to load flow profiles:', err)
    }
  }

  // 프로필 전환 처리
  const handleProfileSwitch = async (profileId) => {
    setShowProfileDropdown(false)
    try {
      setAuthStatus('checking')
      clearTokenCache?.()
      setAuthReady?.(false)
      const result = await window.electronAPI.switchProfile({ profileId })
      if (result.success) {
        await loadFlowProfiles()
        // 웹뷰 전환 완료 후 로그인 상태 재검증 폴링 대기
        setTimeout(() => checkAuth(true), 2500)
      } else {
        alert(`프로필 전환 실패: ${result.error}`)
      }
    } catch (err) {
      alert(`프로필 전환 에러: ${err.message}`)
    }
  }

  // 기존 프로필 삭제
  const handleDeleteProfile = async (profileId) => {
    const activeProfile = profileConfig.profiles.find(p => p.id === profileId)
    const confirmDelete = window.confirm(
      lang === 'ko'
        ? `정말 "${activeProfile?.name || '선택한'}" 프로필을 삭제하시겠습니까?\n해당 프로필에 연결된 구글 로그인 세션 및 쿠키 정보가 영구 파괴됩니다.`
        : `Are you sure you want to delete "${activeProfile?.name || 'selected'}"?\nAll associated session data and cookies will be permanently lost.`
    )
    if (!confirmDelete) return

    try {
      const result = await window.electronAPI.deleteProfile({ profileId })
      if (result.success) {
        await loadFlowProfiles()
      } else {
        alert(`프로필 삭제 실패: ${result.error}`)
      }
    } catch (err) {
      alert(`프로필 삭제 에러: ${err.message}`)
    }
  }

  // 마운트 시 프로필 설정 로드 및 드롭다운 외부 클릭 클리너
  useEffect(() => {
    loadFlowProfiles()
    
    const handleClickOutsideProfile = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setShowProfileDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutsideProfile)
    return () => document.removeEventListener('mousedown', handleClickOutsideProfile)
  }, [])

  // authReady가 바뀌면 상태 동기화
  useEffect(() => {
    if (authReady) {
      setAuthStatus('authenticated')
      stopPolling()
    } else {
      setAuthStatus('unauthenticated')
    }
  }, [authReady])

  // Flow 지역 제한 감지
  useEffect(() => {
    const handleFlowStatus = (data) => {
      if (data?.unavailable) {
        setAuthStatus('unavailable')
        stopPolling()
      }
    }
    const unsub = window.electronAPI?.onFlowStatus?.(handleFlowStatus)
    return () => {
      if (unsub) unsub()
      stopPolling()
    }
  }, [])
  
  // authReady prop에만 의존 — 독립적인 checkAuth 제거
  // (기존: !authReady일 때 quickCheck → 캐시된 만료 토큰을 유효로 오판하는 경합 조건 발생)
  
  // 드롭다운 열릴 때 프로젝트 목록 로드
  useEffect(() => {
    if (showProjectDropdown && saveMode === 'folder') {
      loadProjects()
    }
  }, [showProjectDropdown])
  
  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowProjectDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const loadProjects = async () => {
    const result = await fileSystemAPI.listProjects()
    if (result.success) {
      let projectList = result.projects
      
      // 현재 projectName이 목록에 없으면 추가 (아직 폴더 생성 전)
      if (projectName && !projectList.includes(projectName)) {
        projectList = [projectName, ...projectList]
      }
      
      setProjects(projectList)
    }
  }
  
  // projectName 변경 시 목록 갱신
  useEffect(() => {
    if (projectName && !projects.includes(projectName)) {
      setProjects(prev => {
        if (prev.includes(projectName)) return prev
        return [projectName, ...prev.filter(p => p !== projectName)]
      })
    }
  }, [projectName])
  
  const checkAuth = async (quickCheck = false) => {
    if (!getAccessToken) {
      setAuthStatus('unauthenticated')
      setAuthReady?.(false)
      return
    }
    
    setAuthStatus('checking')
    try {
      // quickCheck: 탭 열기/대기 없이 빠르게 확인만
      const token = await getAccessToken(false, quickCheck)
      if (token) {
        setAuthStatus('authenticated')
        setAuthReady?.(true)
      } else {
        setAuthStatus('unauthenticated')
        setAuthReady?.(false)
      }
    } catch (e) {
      setAuthStatus('unauthenticated')
      setAuthReady?.(false)
    }
  }
  
  // 폴링 정리
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  // Flow 사이트 열기 + 로그인 대기 폴링
  const openFlow = () => {
    if (window.electronAPI?.switchTab) {
      window.electronAPI.switchTab('flow')
    }
    setAuthStatus('waiting')
    setAuthReady?.(false)
    stopPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const token = await getAccessToken(true)
        if (token) {
          setAuthStatus('authenticated')
          setAuthReady?.(true)
          stopPolling()
        }
      } catch {}
    }, TIMING.AUTH_POLL_INTERVAL || 2000)
  }
  
  const handleProjectSelect = (name) => {
    onProjectChange(name)
    setShowProjectDropdown(false)
  }
  
  const handleNewProject = () => {
    setShowProjectDropdown(false)
    onNewProject()
  }

  const handleDeleteClick = (e, name) => {
    e.stopPropagation()
    setDeleteTarget(name)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const result = await fileSystemAPI.deleteProject(deleteTarget)
    if (result.success) {
      setProjects(prev => prev.filter(p => p !== deleteTarget))
      // 현재 프로젝트를 삭제한 경우 다른 프로젝트로 전환
      if (deleteTarget === projectName) {
        const remaining = projects.filter(p => p !== deleteTarget)
        if (remaining.length > 0) {
          onProjectChange(remaining[0])
        } else {
          onNewProject()
        }
      }
    } else {
      alert(`삭제 실패: ${result.error || 'Unknown error'}`)
    }
    setDeleteTarget(null)
    setShowProjectDropdown(false)
  }

  // 구글/Flow 로그인 세션 강제 초기화 및 청소 (이전 인증 찌꺼기 완벽 박멸)
  const handleFlowReset = async () => {
    const confirmReset = window.confirm(
      lang === 'ko'
        ? '정말 구글/Flow 로그인 세션을 완전히 삭제하고 초기화하시겠습니까?\n이전 계정의 캐시 및 쿠키 정보가 모두 깨끗이 지워지며, 새로운 구글 계정으로 로그인할 수 있게 됩니다.'
        : 'Are you sure you want to completely purge and reset your Google/Flow login session?\nAll cached credentials and cookies will be cleared, allowing you to log in with a fresh Google account.'
    )
    if (!confirmReset) return

    try {
      setAuthStatus('checking')
      clearTokenCache?.()
      const result = await window.electronAPI.clearFlowSession()
      if (result?.success) {
        setAuthStatus('unauthenticated')
        setAuthReady?.(false)
        alert(
          lang === 'ko'
            ? '구글/Flow 세션이 완전히 초기화되었습니다. 새로운 구글 계정으로 로그인해 주세요!'
            : 'Google/Flow session cleared successfully. Please log in with a new Google account!'
        )
      } else {
        setAuthStatus('authenticated')
        alert(`초기화 실패: ${result?.error || 'Unknown error'}`)
      }
    } catch (err) {
      setAuthStatus('authenticated')
      alert(`초기화 에러: ${err.message}`)
    }
  }
  
  return (
    <>
    <header className="header">
      <div className="header-left">
        <button
          className="hamburger-btn"
          onClick={() => setShowDrawer(true)}
          data-tooltip={t('header.menu')}
        >
          <span className="hamburger-icon">☰</span>
        </button>

        <h1 className="logo">
          <span className="logo-text">{t('appName')}</span>
        </h1>
        
        {/* 프로젝트 선택기 (폴더 모드 + 로그인 상태일 때만) */}
        {saveMode === 'folder' && authStatus === 'authenticated' && (
          <div className={`project-selector-header ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
            <button
              className="project-current"
              onClick={() => !disabled && setShowProjectDropdown(!showProjectDropdown)}
              disabled={disabled}
              title={disabled ? t('headerExtra.cannotChangeProject') : ''}
            >
              <span className="project-icon">📁</span>
              <span className="project-name">{projectName || t('settings.noProjects')}</span>
              <span className="dropdown-arrow">{showProjectDropdown ? '▲' : '▼'}</span>
            </button>
            
            {showProjectDropdown && (
              <div className="project-dropdown">
                {projects.length === 0 ? (
                  <div className="project-empty">{t('settings.noProjects')}</div>
                ) : (
                  projects.map(p => (
                    <div
                      key={p}
                      className={`project-option ${p === projectName ? 'active' : ''}`}
                      onClick={() => handleProjectSelect(p)}
                    >
                      <span className="project-option-name">{p}</span>
                      <span className="project-option-actions">
                        {p === projectName && <span className="check">✓</span>}
                        <button
                          className="project-delete-btn"
                          onClick={(e) => handleDeleteClick(e, p)}
                          title={t('settings.deleteProject') || '삭제'}
                        >
                          ✕
                        </button>
                      </span>
                    </div>
                  ))
                )}
                <div className="project-divider"></div>
                <div className="project-option new-project" onClick={handleNewProject}>
                  <span>+</span> {t('settings.createProject')}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="header-right">
        <button
          className="btn-export"
          onClick={onExport}
          disabled={!hasImages}
          data-tooltip={t('header.export')}
        >
          <span className="btn-emoji">📦</span>
          <span className="btn-text">{t('header.export')}</span>
        </button>

        <button
          className="btn-flow-reset"
          onClick={handleFlowReset}
          title={lang === 'ko' ? 'Flow 계정 및 로그인 세션 완전 초기화' : 'Complete Purge & Reset Flow Session'}
        >
          <span className="btn-emoji">♻️</span>
          <span className="btn-text">{lang === 'ko' ? 'Flow 초기화' : 'Reset Flow'}</span>
        </button>

        {/* 👤 Flow Multi-Profile Selector Dropdown */}
        <div className="flow-profile-container" ref={profileDropdownRef}>
          <button
            className={`btn-profile-selector ${showProfileDropdown ? 'active' : ''}`}
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            title={lang === 'ko' ? 'Flow 구글 멀티 프로필 계정 관리' : 'Manage Flow Multi Profiles'}
          >
            <span className="btn-emoji">👤</span>
            <span className="btn-text">
              {profileConfig.profiles.find(p => p.id === profileConfig.activeProfileId)?.name || (lang === 'ko' ? '프로필' : 'Profile')}
            </span>
            <span className="arrow-icon">{showProfileDropdown ? '▲' : '▼'}</span>
          </button>

          {showProfileDropdown && (
            <div className="profile-dropdown-menu">
              <div className="dropdown-title">
                {lang === 'ko' ? '구글 계정 프로필 선택' : 'Google Profiles'}
              </div>
              <div className="profile-list-scroll">
                {profileConfig.profiles.map(prof => (
                  <div
                    key={prof.id}
                    className={`profile-item-option ${prof.id === profileConfig.activeProfileId ? 'active' : ''}`}
                    onClick={() => handleProfileSwitch(prof.id)}
                  >
                    <div className="profile-item-left">
                      <span className="status-dot">🟢</span>
                      <div className="profile-details-text">
                        <span className="profile-item-name">{prof.name}</span>
                        {prof.email && <span className="profile-item-email">{prof.email}</span>}
                        <span className="profile-item-gpu">💻 {prof.hardware.renderer.split('(')[1]?.split(')')[0] || 'GPU'}</span>
                      </div>
                    </div>
                    {prof.id !== 'default' && (
                      <button
                        className="profile-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteProfile(prof.id)
                        }}
                        title={lang === 'ko' ? '프로필 삭제' : 'Delete Profile'}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          className="btn-settings"
          onClick={() => onSettings()}
          data-tooltip={t('header.settings')}
        >
          ⚙️
        </button>
      </div>
    </header>

    {/* 프로젝트 삭제 확인 모달 */}
    <Modal
      isOpen={!!deleteTarget}
      onClose={() => setDeleteTarget(null)}
      title={t('settings.deleteProject') || '프로젝트 삭제'}
      className="modal-confirm-delete"
      footer={
        <div className="modal-confirm-actions">
          <button className="btn-cancel" onClick={() => setDeleteTarget(null)}>
            {t('common.cancel') || '취소'}
          </button>
          <button className="btn-danger" onClick={handleDeleteConfirm}>
            {t('common.delete') || '삭제'}
          </button>
        </div>
      }
    >
      <p className="modal-confirm-msg">
        <strong>"{deleteTarget}"</strong> {t('settings.deleteConfirm') || '프로젝트를 삭제하시겠습니까?\n모든 이미지와 데이터가 삭제됩니다.'}
      </p>
    </Modal>

    {/* 사이드 드로워 */}
    <SideDrawer isOpen={showDrawer} onClose={() => setShowDrawer(false)} />
    </>
  )
}
