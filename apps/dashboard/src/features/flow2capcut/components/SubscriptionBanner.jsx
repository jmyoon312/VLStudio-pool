/**
 * SubscriptionBanner - 구독 상태 배너
 *
 * 체험판 남은 횟수/일수 또는 Pro 상태 표시
 */

import { useAuth } from '@/contexts/AuthContext'
import { useI18n } from '../hooks/useI18n'
import { formatExpiryDate } from '../utils/formatters'
import './SubscriptionBanner.css'

export function SubscriptionBanner({ onUpgradeClick, onLoginClick, hideWhenPro = false }) {
  const { isAuthenticated, subscription, user } = useAuth()
  const { t, lang } = useI18n()

  // 로그인하지 않은 경우 - 숨김 (무료 느낌)
  if (!isAuthenticated) {
    return null
  }

  const { status, exportsRemaining, daysRemaining, expiresAt } = subscription

  // Pro 구독자 - hideWhenPro가 true면 숨김
  if (status === 'active') {
    if (hideWhenPro) return null

    const expiresText = expiresAt
      ? `~${formatExpiryDate(expiresAt, lang)}`
      : ''

    return (
      <div className="subscription-banner subscription-banner--pro">
        <div className="banner-content">
          <span className="banner-icon">⭐</span>
          <span className="banner-text">Pro {expiresText}</span>
        </div>
      </div>
    )
  }

  // 체험 기간 만료
  if (status === 'expired') {
    return (
      <div className="subscription-banner subscription-banner--expired">
        <div className="banner-content">
          <span className="banner-icon">⏰</span>
          <span className="banner-text">{t('subscription.expired')}</span>
        </div>
        <button className="banner-action banner-action--upgrade" onClick={onUpgradeClick}>
          {t('subscription.upgrade')}
        </button>
      </div>
    )
  }

  // 체험판 사용 중 - 숨김 (무료 느낌)
  if (status === 'trial') {
    return null
  }

  return null
}

export default SubscriptionBanner
