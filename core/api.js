// ---- pywebview API 접근 ----
// pywebview.api는 파이썬 창이 완전히 준비된 뒤 pywebviewready 이벤트로 주입됩니다.
// 여러 모듈이 공통으로 쓰므로 기능 모듈과 분리해 둡니다.

export function withApi(fn) {
  if (window.pywebview && window.pywebview.api) {
    fn(window.pywebview.api)
  } else {
    window.addEventListener('pywebviewready', () => fn(window.pywebview.api), { once: true })
  }
}
