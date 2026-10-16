import { EDITOR_CONFIG } from '../../core/config.js'

// 에디터의 빈 공간(좌우 여백, 아래 패딩 등)을 클릭해도
// 클릭 좌표에서 가장 가까운 텍스트 위치로 커서를 이동시킴
export function setupClickAnywhere(editor) {
  const editorEl = document.querySelector(EDITOR_CONFIG.selector)
  if (!editorEl) return

  // #editor-wrap은 #editor의 부모. 좌우 바깥 여백까지 클릭을 잡기 위해 여기에 붙임
  const wrap = editorEl.parentElement
  if (!wrap) return

  wrap.addEventListener('mousedown', (e) => {
    // .ProseMirror 안쪽 클릭은 ProseMirror가 알아서 처리
    if (editor.view.dom.contains(e.target)) return
    // 왼쪽 버튼만
    if (e.button !== 0) return

    // 오른쪽 스크롤바 영역은 무시 (스크롤바 드래그 방해 방지)
    const wrapRect = wrap.getBoundingClientRect()
    const scrollbarWidth = wrap.offsetWidth - wrap.clientWidth
    if (e.clientX > wrapRect.right - scrollbarWidth) return

    e.preventDefault()

    // 클릭 좌표를 .ProseMirror 영역 안으로 잘라내어 가장 가까운 위치를 얻음
    const pmRect = editor.view.dom.getBoundingClientRect()
    if (pmRect.width === 0 || pmRect.height === 0) return

    const x = Math.min(Math.max(e.clientX, pmRect.left + 1), pmRect.right - 1)
    const y = Math.min(Math.max(e.clientY, pmRect.top + 1), pmRect.bottom - 1)

    const coords = editor.view.posAtCoords({ left: x, top: y })
    if (!coords) return

    editor.commands.setTextSelection(coords.pos)
    editor.view.focus()
  })
}