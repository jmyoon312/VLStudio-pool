/**
 * @deprecated LEGACY - 사용하지 않음
 *
 * Stripe Module Exports (레거시)
 * 현재는 Lemon Squeezy를 사용합니다.
 * 실제 결제: PaywallModal.jsx → firebase/functions.js
 * 실제 포털: UserMenu.jsx → firebase/functions.js
 */

export { redirectToCheckout, checkoutMonthly, checkoutYearly, STRIPE_PRICES } from './checkout'
export { redirectToPortal } from './portal'
