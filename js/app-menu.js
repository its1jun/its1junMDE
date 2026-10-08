import { UI_CONFIG } from './config.js'
import { insertTable } from './table-actions.js'
import { createContextMenu } from './context-menu.js'

// ---- 기본 우클릭 메뉴 (파일 동작 + 표/링크/이미지 삽입) ----
// 표 셀 밖에서 우클릭하면 브라우저 기본 메뉴 대신 이 메뉴를 띄웁니다.

export function setupAppMenu(editor, fileActions, insertActions) {
  const menu = createContextMenu(document.getElementById(UI_CONFIG.appMenuId))
  const ids = UI_CONFIG.appMenuButtons

  document.addEventListener('contextmenu', (e) => {
    // 표 메뉴가 이미 처리한 우클릭이면 건너뜀
    if (e.defaultPrevented) return
    e.preventDefault()

    // 에디터 안에서 우클릭했다면 그 위치로 커서를 옮겨 Insert Table의 삽입 위치로 사용
    if (editor.view.dom.contains(e.target) && editor.state.selection.empty) {
      const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
      if (pos) editor.commands.setTextSelection(pos.pos)
    }
    menu.show(e.clientX, e.clientY)
  })

  menu.bindActions({
    [ids.new]: fileActions.newFile,
    [ids.open]: fileActions.openFile,
    [ids.save]: fileActions.saveFile,
    [ids.saveAs]: fileActions.saveFileAs,
    [ids.insertTable]: () => insertTable(editor),
    [ids.insertLink]: insertActions.openLink,
    [ids.insertImage]: insertActions.openImage,
  })
}
