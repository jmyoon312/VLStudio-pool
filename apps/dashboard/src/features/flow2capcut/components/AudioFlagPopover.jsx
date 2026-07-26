import { useState, useRef, useEffect } from 'react'
import { useI18n } from '../hooks/useI18n'

export default function AudioFlagPopover({ target, existingReview, onSave, onRemove, onClose }) {
  const { t } = useI18n()
  const [reason, setReason] = useState(existingReview?.reason || '')
  const inputRef = useRef(null)
  const popoverRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="flag-popover-backdrop" onClick={onClose}>
      <div
        ref={popoverRef}
        className="flag-popover"
        onClick={e => e.stopPropagation()}
        style={{ top: target.y + 24, left: Math.min(target.x, window.innerWidth - 340) }}
      >
        <div className="flag-popover-title">
          ⚠️ {target.filename}
        </div>
        <textarea
          ref={inputRef}
          className="flag-reason-input"
          placeholder={t('audioTab.flagReasonPlaceholder') || '부적합 사유 (예: 초인종 소리, 조선시대에 안 맞음)'}
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
        />
        <div className="flag-popover-actions">
          {existingReview && (
            <button className="btn btn-sm btn-danger-outline" onClick={onRemove}>
              {t('audioTab.flagRemove') || '마크 해제'}
            </button>
          )}
          <button className="btn btn-sm" onClick={onClose}>
            {t('audioTab.flagCancel') || '취소'}
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => onSave(reason)} disabled={!reason.trim()}>
            {t('audioTab.flagSave') || '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
