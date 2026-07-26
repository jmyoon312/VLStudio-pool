/**
 * @deprecated LEGACY - 사용하지 않음
 *
 * Stripe Checkout Integration (레거시)
 * 현재는 Lemon Squeezy를 사용하며, PaywallModal에서 직접
 * firebase/functions.js의 createCheckoutSession을 호출합니다.
 *
 * 실제 결제 흐름: PaywallModal.jsx → firebase/functions.js → Cloud Function
 */

import { createCheckoutSession } from '../firebase/functions'

// Stripe 가격 ID - 실제 값으로 교체 필요
export const STRIPE_PRICES = {
  monthly: 'price_YOUR_MONTHLY_PRICE_ID',
  yearly: 'price_YOUR_YEARLY_PRICE_ID'
}

/**
 * Stripe 체크아웃 페이지로 이동
 * @param {string} priceId - Stripe 가격 ID
 * @returns {Promise<void>}
 */
export async function redirectToCheckout(priceId = STRIPE_PRICES.monthly) {
  try {
    const { url } = await createCheckoutSession(priceId)

    if (url) {
      // 새 탭에서 Stripe 체크아웃 열기
      window.open(url, '_blank')
      return { success: true, url }
    }

    throw new Error('Checkout URL not received')
  } catch (error) {
    console.error('[Stripe] Checkout redirect failed:', error)
    throw error
  }
}

/**
 * 월간 구독 체크아웃
 */
export async function checkoutMonthly() {
  return redirectToCheckout(STRIPE_PRICES.monthly)
}

/**
 * 연간 구독 체크아웃
 */
export async function checkoutYearly() {
  return redirectToCheckout(STRIPE_PRICES.yearly)
}

export default {
  redirectToCheckout,
  checkoutMonthly,
  checkoutYearly,
  STRIPE_PRICES
}
