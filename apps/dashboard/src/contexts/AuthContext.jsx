/**
 * Authentication Context
 *
 * Firebase 인증 상태를 앱 전체에서 사용할 수 있도록 제공
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import {
  signInWithGoogle,
  signOut,
  onAuthChange,
  initializeUser
} from '../firebase'
import {
  getAppDoc,
  calculateTrialStatus
} from '../firebase/firestore'

const IS_DEV = import.meta.env.DEV
const VITE_DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

const DEV_MOCK_USER = Object.freeze({
  uid: 'dev-bypass-user',
  email: 'dev@viraloop.local',
  displayName: 'Dev User',
  photoURL: '',
  emailVerified: true,
  isAnonymous: false,
  getIdToken: async () => 'dev-mock-token',
  toJSON: () => ({ uid: 'dev-bypass-user' }),
})

const DUMMY_USER_DATA = Object.freeze({
  id: 'viraloop',
  createdAt: new Date().toISOString(),
})

const DEV_SUBSCRIPTION = Object.freeze({
  isActive: true,
  canExport: true,
  exportsRemaining: Infinity,
  daysRemaining: Infinity,
  isExpired: false,
  status: 'active',
})

const AuthContext = createContext(null)

// 사용자 미인증/사인아웃 상태
const SUBSCRIPTION_NONE = Object.freeze({
  isActive: false,
  canExport: false,
  exportsRemaining: 0,
  daysRemaining: 0,
  isExpired: true,
  status: 'none'
})

// 사용자가 막 바뀌어 Firestore 응답을 기다리는 상태.
// canExport: false 로 강제하여 이전 사용자의 권한이 새 사용자에게 새지 않도록 한다.
// (status='none'으로 두지 않는 이유: UI가 '만료'처럼 보이게 만들지 않기 위함)
const SUBSCRIPTION_LOADING = Object.freeze({
  isActive: false,
  canExport: false,
  exportsRemaining: 0,
  daysRemaining: 0,
  isExpired: false,
  status: 'loading'
})

// Firestore 조회 실패 — terminal 상태.
// loading 에 영구 고정되면 useExport 가 silent return 해서 사용자가 dead-end 에 갇힌다.
// catch 분기에서 이 상태로 전환하여 호출자가 재시도 / 에러 UI 를 띄울 기회를 준다.
// (isExpired: true — 'error' 분기를 모르는 옛 UI 가 만료처럼 보이게 해 export 차단은 유지)
const SUBSCRIPTION_ERROR = Object.freeze({
  isActive: false,
  canExport: false,
  exportsRemaining: 0,
  daysRemaining: 0,
  isExpired: true,
  status: 'error'
})

/**
 * AuthProvider - 인증 상태 관리 Provider
 */
export function AuthProvider({ children }) {
  // 인증 상태
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const loginInProgressRef = useRef(false)  // 로그인 진행 중 플래그 (onAuthChange에서 loading 리셋 방지)

  // 사용자 데이터 (Firestore)
  const [userData, setUserData] = useState(null)
  const [subscription, setSubscription] = useState(SUBSCRIPTION_NONE)

  // 진행 중인 fetch 의 stale 응답을 가려내기 위한 토큰.
  // 모든 auth 변경(sign-in/out/switch) 즉시 ++ 되어 in-flight 응답을 무효화한다.
  // 추가로 fetchUserData 진입 시점에도 ++ 하여 동일 사용자의 동시 refresh 를 가린다.
  const fetchTokenRef = useRef(0)

  // 현재 사용자의 uid — fetchUserData 응답이 도착했을 때 여전히 같은 사용자인지 확인용.
  // token 만으로도 충분하지만, 동일 token 라이프타임 내 race 를 방어하는 belt-and-suspenders.
  const currentUidRef = useRef(null)

  // Firebase Auth 상태 변화 감지
  useEffect(() => {
    if (IS_DEV && VITE_DEV_BYPASS_AUTH) {
      console.log('[AuthContext] DEV_BYPASS_AUTH: injecting mock user')
      setUser(DEV_MOCK_USER)
      setUserData(DUMMY_USER_DATA)
      setSubscription(DEV_SUBSCRIPTION)
      setLoading(false)
      return
    }

    const unsubscribe = onAuthChange((firebaseUser) => {
      console.log('[AuthContext] Auth state changed:', firebaseUser?.email)

      fetchTokenRef.current += 1
      currentUidRef.current = firebaseUser?.uid ?? null

      setUser(firebaseUser)

      if (!loginInProgressRef.current) {
        setLoading(false)
      }

      if (!firebaseUser) {
        setUserData(null)
        setSubscription(SUBSCRIPTION_NONE)
      }
    })

    return () => unsubscribe()
  }, [])

  // Firestore 1회 fetch — 실시간 리스너 X (read 비용 절감).
  // 변경이 필요한 시점(결제, export 후)엔 refreshSubscription()으로 명시적 재조회.
  //
  // source semantics:
  //   - 'default' (mount/login): 일반 조회 — online 이면 server, offline 이면 cache.
  //   - 'server'  (refresh):     server 강제 조회. export 직후 GCF 가 트랜잭션으로
  //                              갱신한 quota/exportCount 를 정확히 받아오기 위함.
  //                              offline 시 throw 하므로 호출자가 catch 책임.
  const fetchUserData = useCallback(async (uid, { source = 'default' } = {}) => {
    const myToken = ++fetchTokenRef.current
    try {
      const data = await getAppDoc(uid, { source })
      // Stale 응답 폐기 조건 — 둘 중 하나라도 깨지면 무시:
      //   1) auth 변경 / 다른 fetch 시작으로 token 이 바뀌었거나
      //   2) 동일 token 라이프타임 내라도 현재 사용자의 uid 가 바뀌었거나
      if (myToken !== fetchTokenRef.current) return null
      if (uid !== currentUidRef.current) return null
      setUserData(data)
      setSubscription(calculateTrialStatus(data))
      // 이전 fetch 가 실패해 setError 가 살아있을 수 있다 — 성공 시 자동 클리어.
      // (clearError() 가 호출되기 전까지 stale error 가 UI 에 남는 회귀 방지)
      setError(null)
      return data
    } catch (err) {
      if (myToken !== fetchTokenRef.current) return null
      if (uid !== currentUidRef.current) return null
      console.error('[AuthContext] Firestore error:', err)
      setError(err.message)
      // SUBSCRIPTION_LOADING 에 영구 고정되면 useExport 가 silent return 해서 dead-end 가 된다.
      // terminal 상태(SUBSCRIPTION_ERROR)로 전환해 호출자(useExport 등)가 재시도/에러 UI 띄울 수 있게 함.
      setSubscription(SUBSCRIPTION_ERROR)
      throw err
    }
  }, [])

  useEffect(() => {
    if (!user?.uid) return

    if (user.uid === 'dev-bypass-user') return

    setUserData(null)
    setSubscription(SUBSCRIPTION_LOADING)

    fetchUserData(user.uid).catch(() => {
    })

  }, [user?.uid, fetchUserData])

  // Google 로그인
  const login = useCallback(async () => {
    try {
      loginInProgressRef.current = true
      setLoading(true)
      setError(null)

      const result = await signInWithGoogle()

      // 사용자 초기화 (첫 로그인 시 Firestore 문서 생성)
      await initializeUser()

      return result
    } catch (err) {
      console.error('[AuthContext] Login error:', err)
      setError(err.message)
      throw err
    } finally {
      loginInProgressRef.current = false
      setLoading(false)
    }
  }, [])

  // 로그아웃
  const logout = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      await signOut()
    } catch (err) {
      console.error('[AuthContext] Logout error:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // 에러 클리어
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // 구독 정보 새로고침 — server 강제 조회로 export 직후 GCF 갱신값을 정확히 반영.
  // (cache fallback 가능성을 차단하기 위해 source: 'server')
  // await 하면 최신 상태가 반영된 시점이 보장된다.
  const refreshSubscription = useCallback(async () => {
    if (user?.uid) {
      return await fetchUserData(user.uid, { source: 'server' })
    }
    return null
  }, [user?.uid, fetchUserData])

  // 외부 결제/환불/포털 작업 후 앱 복귀 시 자동으로 subscription 재조회.
  // PaywallModal handleUpgrade → window.open(checkout URL, '_blank') → 사용자가 브라우저에서 결제
  // → Lemon Squeezy webhook → Firestore 업데이트 → 사용자 앱 복귀.
  // 이전엔 앱이 fetch를 안 해 stale 상태였음(체험판 뱃지 그대로). focus 이벤트로 자동 fetch.
  // 5초 미만 blur는 alt-tab 등 무의미 — 5초 이상 unfocused 후 복귀 시에만 refresh (read 비용 절감).
  useEffect(() => {
    if (!user?.uid) return
    let lastBlur = 0
    const onBlur = () => { lastBlur = Date.now() }
    const onFocus = () => {
      if (Date.now() - lastBlur > 5000) {
        refreshSubscription().catch(err => console.warn('[AuthContext] focus refresh failed:', err?.message))
      }
    }
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [user?.uid, refreshSubscription])

  const value = {
    // 상태
    user,
    userData,
    subscription,
    loading,
    error,
    isAuthenticated: !!user,

    // 액션
    login,
    logout,
    clearError,
    refreshSubscription
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * useAuth Hook - AuthContext 사용
 */
export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}

export default AuthContext
