/**
 * @deprecated LEGACY - 사용하지 않음
 *
 * Stripe Customer Portal Integration (레거시)
 * 현재는 Lemon Squeezy를 사용하며, UserMenu에서 직접
 * firebase/functions.js의 createPortalSession을 호출합니다.
 */

import { createPortalSession } from '../firebase/functions'

/**
 * Stripe 고객 포털 페이지로 이동
 * @returns {Promise<void>}
 */
export async function redirectToPortal() {
  try {
    const { url } = await createPortalSession()

    if (url) {
      // 새 탭에서 Stripe 포털 열기
      window.open(url, '_blank')
      return { success: true, url }
    }

    throw new Error('Portal URL not received')
  } catch (error) {
    console.error('[Stripe] Portal redirect failed:', error)
    throw error
  }
}

export default {
  redirectToPortal
}
