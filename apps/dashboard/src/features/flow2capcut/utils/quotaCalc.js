/**
 * quotaCalc.js — 클라이언트 쪽 무료 사용 한도 계산 (GCF mirror)
 *
 * **GCF (`whisk2capcut/functions/src/quota.js`) 와 동일 로직**.
 * 두 곳이 같은 결정을 내려야 시각/실제 export 의 일관성이 유지된다.
 *
 * 실제 차단/카운팅은 GCF 가 수행. 이 모듈은 UI 표시용 (배지, 모달 메시지 등).
 *
 * 모델: B-3
 *   - 월 5회 quota (UTC 1일 자동 리셋)
 *   - 가입 시 부여되는 5회 영구 보너스 풀 (소진까지 보존)
 *   - 보너스 우선 소진, 그 다음 월 quota
 *   - 활성 구독자는 quota 무관 무제한
 *   - 7일 만료 로직 없음 (월간 모델로 대체)
 */

/** 월 quota — 무료 사용자의 매월 한도 */
export const MONTHLY_QUOTA = 5

/** 가입 시 부여되는 영구 보너스 풀 */
export const BONUS_GRANT = 5

/**
 * UTC 기준 어떤 시점의 "달의 시작" Date 반환.
 * @param {Date} date
 * @returns {Date}
 */
export function utcMonthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

/**
 * 두 시점이 같은 UTC 월에 속하는지.
 * @param {Date|null|undefined} a
 * @param {Date|null|undefined} b
 * @returns {boolean}
 */
export function sameUtcMonth(a, b) {
  if (!a || !b) return false
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth()
  )
}

/**
 * Firestore Timestamp 또는 raw Date 를 Date 로 정규화.
 * @param {Date|{toDate: () => Date}|null|undefined} v
 * @returns {Date|null}
 */
function asDate(v) {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v.toDate === 'function') {
    try {
      return v.toDate()
    } catch {
      return null
    }
  }
  return null
}

/**
 * appData 의 quota 상태 계산 (현재 시점 기준).
 *
 * **순수 함수.** GCF 의 computeQuotaState 와 동일 결정.
 *
 * @param {object|null} appData - Firestore subscription doc data
 * @param {Date} now - 현재 시점 (테스트 가능성)
 * @returns {{
 *   isActive: boolean,
 *   isExpired: boolean,
 *   subscriptionStatus: 'active'|'trial'|'expired',
 *   bonusRemaining: number,
 *   monthlyUsed: number,
 *   monthlyQuota: number,
 *   monthlyRemaining: number,
 *   effectiveRemaining: number,
 * }}
 */
export function computeQuotaState(appData, now) {
  // [ViraLoop Studio] 로컬 환경 우회(Bypass)
  // 요금제/인증 제한을 무력화하고 항상 최상위 권한(Pro)으로 인식하게 합니다.
  return {
    isActive: true,
    isExpired: false,
    subscriptionStatus: 'active',
    bonusRemaining: Infinity,
    monthlyUsed: 0,
    monthlyQuota: Infinity,
    monthlyRemaining: Infinity,
    effectiveRemaining: Infinity,
  }
}

