import { UI_CONFIG, IMAGE_CONFIG } from './config.js'
import { createContextMenu } from './context-menu.js'

// ---- 이미지 우클릭 컨텍스트 메뉴 ----
// 이미지 위에서 우클릭하면 Delete Image 메뉴를 띄웁니다.

export function setupImageMenu(editor) {
  const menu = createContextMenu(document.getElementById(UI_CONFIG.imageMenuId))
  const wrapClass = IMAGE_CONFIG.classes.wrap

  editor.view.dom.addEventListener('contextmenu', (e) => {
    const wrap = e.target.closest(`.${wrapClass}`)
    if (!wrap) {
      menu.hide()
      return
    }
    e.preventDefault()

    // 우클릭한 이미지를 선택 상태로 만들어, 삭제 시 정확히 이 이미지를 지우도록 함
    const pos = editor.view.posAtDOM(wrap, 0)
    if (typeof pos === 'number') {
      editor.commands.setNodeSelection(pos)
    }
    menu.show(e.clientX, e.clientY)
  })

  menu.bindActions({
    [UI_CONFIG.imageMenuButtons.deleteImage]: () => {
      editor.chain().focus().deleteSelection().run()
    },
  })
}