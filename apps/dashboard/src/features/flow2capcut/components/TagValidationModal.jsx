/**
 * TagValidationModal - 생성 시작 전 태그 매칭 검증 모달
 * 매칭 실패 씬 목록을 보여주고, 진행/취소 선택
 */

import Modal from './Modal'
import './TagValidationModal.css'

const TYPE_ICONS = {
  character: '👤',
  scene: '🏞️',
  style: '🎨',
}

export default function TagValidationModal({ errors, onProceed, onCancel, t }) {
  if (!errors || errors.length === 0) return null

  const totalUnmatched = errors.reduce(
    (sum, e) => sum + e.errors.reduce((s, err) => s + err.unmatchedTags.length, 0), 0
  )

  const footer = (
    <>
      <button className="btn-secondary" onClick={onCancel}>
        {t('tagValidation.cancel')}
      </button>
      <button className="btn-primary" onClick={onProceed}>
        {t('tagValidation.proceedAnyway')}
      </button>
    </>
  )

  return (
    <Modal
      onClose={onCancel}
      title={t('tagValidation.title')}
      className="tag-validation-modal"
      footer={footer}
    >
      <div className="tag-validation-summary">
        ⚠️ {t('tagValidation.summary', {
          sceneCount: errors.length,
          tagCount: totalUnmatched,
        })}
      </div>

      <div className="tag-validation-list">
        {errors.map(({ sceneIndex, errors: sceneErrors }) => (
          <div key={sceneIndex} className="tag-validation-scene">
            <div className="tag-validation-scene-header">
              #{sceneIndex + 1}
            </div>
            <div className="tag-validation-errors">
              {sceneErrors.map(({ type, unmatchedTags }) => {
                const translationKey = type === 'scene' ? 'background' : type
                return (
                  <div key={type} className="tag-validation-error">
                    <span className="tag-validation-type">
                      {TYPE_ICONS[type]} {t(`sceneList.${translationKey}`)}
                    </span>
                    <span className="tag-validation-tags">
                      {unmatchedTags.join(', ')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
