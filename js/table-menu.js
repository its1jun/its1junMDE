import { UI_CONFIG } from './config.js'
import { buildTableActions } from './table-actions.js'
import { createContextMenu } from './context-menu.js'

// ---- 표 우클릭 컨텍스트 메뉴 ----
// 표 셀 안에서 우클릭하면 행/열 추가·삭제 등 표 제어 메뉴를 띄웁니다.

export function setupTableMenu(editor) {
  const menu = createContextMenu(document.getElementById(UI_CONFIG.tableMenuId))

  editor.view.dom.addEventListener('contextmenu', (e) => {
    // 표 셀 밖이면 기본 우클릭 메뉴를 그대로 사용
    if (!e.target.closest('td, th')) {
      menu.hide()
      return
    }
    e.preventDefault()

    // 커서만 있거나 선택이 표 밖이면, 우클릭한 위치로 커서를 옮겨 해당 셀 기준으로 동작하게 함
    if (editor.state.selection.empty || !editor.isActive('table')) {
      const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
      if (pos) editor.commands.setTextSelection(pos.pos)
    }
    menu.show(e.clientX, e.clientY)
  })

  menu.bindActions(buildTableActions(editor))
}
