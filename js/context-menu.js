import { UI_CONFIG } from './config.js'

// ---- 우클릭 메뉴 공통 동작 ----
// 기본 메뉴(app-menu)와 표 메뉴(table-menu)가 함께 쓰는 표시/숨김/위치 보정/닫기 처리입니다.

export function createContextMenu(menuEl) {
  const visibleCls = UI_CONFIG.classes.visible

  function hide() {
    menuEl.classList.remove(visibleCls)
  }

  function show(x, y) {
    menuEl.classList.add(visibleCls)
    // 화면 밖으로 나가지 않도록 위치 보정
    const left = Math.min(x, window.innerWidth - menuEl.offsetWidth - 4)
    const top = Math.min(y, window.innerHeight - menuEl.offsetHeight - 4)
    menuEl.style.left = `${Math.max(0, left)}px`
    menuEl.style.top = `${Math.max(0, top)}px`
  }

  // { 버튼 ID: 동작 } 형태로 받아 각 버튼에 연결. 동작 전에 메뉴를 먼저 닫음
  function bindActions(actions) {
    for (const [id, action] of Object.entries(actions)) {
      document.getElementById(id).addEventListener('mousedown', (e) => {
        // 에디터 포커스/선택이 풀리지 않도록 mousedown에서 처리
        e.preventDefault()
        hide()
        action()
      })
    }
  }

  // 메뉴 바깥 클릭, ESC, 스크롤, 창 포커스 이탈 시 닫기
  document.addEventListener('mousedown', (e) => {
    if (!menuEl.contains(e.target)) hide()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide()
  })
  document.addEventListener('scroll', hide, true)
  window.addEventListener('blur', hide)

  return { show, hide, bindActions }
}
