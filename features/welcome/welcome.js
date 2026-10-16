import { WELCOME_CONTENT } from './welcome-content.js'
import { EDITOR_CONFIG, UI_CONFIG } from '../../core/config.js'

// 문서가 비어 있으면 에디터 위에 회색 안내문을 겹쳐 보여주고,
// 내용이 생기면 사라지게 함 (안내문은 문서에 들어가지 않음)

export function setupWelcome(editor) {
  const visibleClass = UI_CONFIG.classes.visible
  const host = document.querySelector(EDITOR_CONFIG.selector)

  if (!host) {
    console.error('Welcome: editor element not found')
    return
  }

  const overlay = document.createElement('div')
  overlay.className = 'welcome-overlay'
  overlay.innerHTML = WELCOME_CONTENT
  host.appendChild(overlay)

  // 문서가 "비어 있다"고 볼 기준:
  // 모든 블록이 빈 문단일 때 (TrailingParagraph가 빈 문단을 하나 더 붙여도 비었다고 판정)
  function isEmpty() {
    const doc = editor.state?.doc
    if (!doc) return false
    if (doc.childCount > 2) return false

    let hasContent = false
    doc.forEach(node => {
      if (node.type.name !== 'paragraph' || node.content.size > 0) {
        hasContent = true
      }
    })
    return !hasContent
  }

  // 현재 문서 상태에 따라 안내문 표시/숨김
  function update() {
    overlay.classList.toggle(visibleClass, isEmpty())
  }

  editor.on('transaction', update)
  editor.on('create', update)
  document.addEventListener('tabchange', update)

  // 첫 표시 (페이드인 효과를 위해 다음 프레임에)
  requestAnimationFrame(update)
}