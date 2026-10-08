import { withApi } from './api.js'

// ---- 링크 열기 ----
// 일반 클릭은 편집(커서 이동)에 쓰이므로, Ctrl(macOS는 Cmd)+클릭일 때만
// 시스템 기본 브라우저로 링크를 엽니다. (에디터 창 자체가 이동하지 않도록 기본 동작은 막음)

export function setupLinkClick(editor) {
  editor.view.dom.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href]')
    if (!anchor) return
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    withApi(api => api.open_external(anchor.getAttribute('href')))
  })
}
