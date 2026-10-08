import { UI_CONFIG } from './config.js'
import { isConfirmOpen } from './confirm-dialog.js'

// ---- 전역 단축키 ----
// Ctrl+S 저장, Ctrl+O 열기, Ctrl+N 새 창, Ctrl+T 새 탭, Ctrl+W 탭 닫기,
// Alt+→ 다음 탭, Alt+← 이전 탭
//
// tabs: setupTabs()가 반환한 탭 조작 객체
// actions.save() / open() / newWindow(): 파일 관련 동작 (file-io.js가 제공)

export function setupShortcuts(tabs, { save, open, newWindow }, findBar) {
  const dialogBackdrop = document.getElementById(UI_CONFIG.dialog.backdropId)

  document.addEventListener('keydown', (e) => {
    if (e.isComposing) return
    // 모든 단축키는 Ctrl/Cmd 또는 Alt가 필요하므로, 일반 타이핑은 여기서 바로 반환
    if (!(e.ctrlKey || e.metaKey || e.altKey)) return
    // 대화상자가 열려 있는 동안에는 단축키를 무시
    if (isConfirmOpen() || dialogBackdrop.classList.contains(UI_CONFIG.classes.visible)) return

    const ctrl = e.ctrlKey || e.metaKey
    const key = e.key.toLowerCase()
    // 한글 입력 상태에서도 동작하도록 물리 키 위치(code)도 함께 확인
    const isLetter = (letter) => key === letter || e.code === 'Key' + letter.toUpperCase()
    const plainCtrl = ctrl && !e.altKey && !e.shiftKey
    const plainAlt = e.altKey && !ctrl && !e.shiftKey

    if (plainCtrl && isLetter('s')) { e.preventDefault(); save() }
    else if (plainCtrl && isLetter('o')) { e.preventDefault(); open() }
    else if (plainCtrl && isLetter('f')) { e.preventDefault(); findBar.toggle() }
    else if (plainCtrl && isLetter('n')) { e.preventDefault(); newWindow() }
    else if (plainCtrl && isLetter('t')) { e.preventDefault(); tabs.newTab() }
    else if (plainCtrl && isLetter('w')) { e.preventDefault(); tabs.closeActive() }
    else if (plainAlt && key === 'arrowright') { e.preventDefault(); tabs.switchBy(1) }
    else if (plainAlt && key === 'arrowleft') { e.preventDefault(); tabs.switchBy(-1) }
  })
}
