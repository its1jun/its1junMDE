import { UI_CONFIG } from './config.js'
import { createContextMenu } from './context-menu.js'

// ---- 링크 우클릭 컨텍스트 메뉴 ----
// 링크 위에서 우클릭하면 Edit Link / Delete Link 메뉴를 띄웁니다.

export function setupLinkMenu(editor, insertActions) {
  const menu = createContextMenu(document.getElementById(UI_CONFIG.linkMenuId))

  editor.view.dom.addEventListener('contextmenu', (e) => {
    const anchor = e.target.closest('a[href]')
    if (!anchor) {
      menu.hide()
      return
    }
    e.preventDefault()

    // 우클릭한 링크 위로 커서를 옮겨, Edit/Delete가 정확히 이 링크를 대상으로 하도록 함
    const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
    if (pos) editor.commands.setTextSelection(pos.pos)

    menu.show(e.clientX, e.clientY)
  })

  menu.bindActions({
    [UI_CONFIG.linkMenuButtons.editLink]: () => {
      insertActions.editLink()
    },
    [UI_CONFIG.linkMenuButtons.deleteLink]: () => {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    },
  })
}