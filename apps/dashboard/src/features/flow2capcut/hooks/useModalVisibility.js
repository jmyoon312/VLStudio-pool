/**
 * useModalVisibility — 모달 열릴 때 Flow WebContentsView를 숨기고, 닫힐 때 복원
 *
 * Electron WebContentsView는 네이티브 레이어라 CSS z-index로 가릴 수 없어서
 * 모달이 열릴 때 IPC로 숨겨야 함.
 *
 * [FIX] ref로 실제 증가 여부를 추적해서, 증가하지 않은 경우에는 cleanup이
 * adjustModalCount(-1)을 호출하지 않도록 방어. 탭 전환 시 컴포넌트가
 * 언마운트될 때 카운트가 잘못 감소하여 Flow 창이 깜빡이는 버그를 수정.
 *
 * @param {boolean} isOpen - 모달 열림 상태
 */

import { useEffect, useRef } from 'react'
import { adjustModalCount } from '../../../lib/utils'

export function useModalVisibility(isOpen) {
  const didIncrementRef = useRef(false)

  useEffect(() => {
    if (isOpen) {
      adjustModalCount(1)
      didIncrementRef.current = true
    }

    return () => {
      if (didIncrementRef.current) {
        adjustModalCount(-1)
        didIncrementRef.current = false
      }
    }
  }, [isOpen])
}
