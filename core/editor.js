import { Editor, StarterKit, ListItem, Table, TableRow, TableCell, TableHeader, Link, Image } from './vendor.js'
import { NoListRejoin } from '../features/list-behavior/no-list-rejoin.js'
import { blockNestedListShortcut } from '../features/list-behavior/no-list-nesting.js'
import { setupBubbleMenu } from '../features/formatting/bubble-menu.js'
import { setupFileIO } from '../features/file/file-io.js'
import { setupTableMenu } from '../features/table/table-menu.js'
import { setupTableColwidthFill } from '../features/table/table-actions.js'
import { setupAppMenu } from '../features/app-menu/app-menu.js'
import { setupInsertDialog } from '../features/dialogs/insert-dialog.js'
import { setupLinkClick } from '../features/link/link-click.js'
import { setupLinkMenu } from '../features/link/link-menu.js'
import { setupImageFallback } from '../features/image/image-fallback.js'
import { setupImageMenu } from '../features/image/image-menu.js'
import { setupFindBar } from '../features/find/find-bar.js'
import { setupWelcome } from '../features/welcome/welcome.js'
import { setupCodeCopy } from '../features/code-copy/code-copy.js'
import { withResize } from '../features/image/image-view.js'
import { setupZoom } from '../features/zoom/zoom.js'
import { setupClickAnywhere } from '../features/click-anywhere/click-anywhere.js'

import { TrailingParagraph, MarkExit, TableEntry } from './editor-extensions.js'
import { EDITOR_CONFIG, TABLE_CONFIG, LINK_CONFIG } from './config.js'

let bubbleMenu = { updateBubbleMenu: () => {} }

function initEditor() {
  const editor = new Editor({
    element: document.querySelector(EDITOR_CONFIG.selector),
    extensions: [
      StarterKit.configure({ listItem: false }),
      ListItem.extend({ content: 'block+' }),
      NoListRejoin,
      TrailingParagraph,
      MarkExit,
      TableEntry,
      Table.extend({
        addKeyboardShortcuts() {
          return {
            ...this.parent?.(),
            Tab: () => {
              if (!this.editor.isActive('table')) return false
              this.editor.commands.goToNextCell()
              return true
            },
          }
        },
      }).configure({ resizable: TABLE_CONFIG.resizable }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({ openOnClick: false, autolink: false, HTMLAttributes: { title: LINK_CONFIG.openHint } }),
      withResize(Image).configure({ inline: true, allowBase64: true }),
    ],
    content: EDITOR_CONFIG.initialContent,
    autofocus: true,
    editorProps: { handleTextInput: blockNestedListShortcut },
    onSelectionUpdate: () => bubbleMenu.updateBubbleMenu(),
  })

  bubbleMenu = setupBubbleMenu(editor)
  setupTableMenu(editor)
  setupTableColwidthFill(editor)
  setupLinkClick(editor)
  setupImageFallback(editor)
  setupImageMenu(editor)
  const findBar = setupFindBar(editor)
  const fileActions = setupFileIO(editor, findBar)
  const insertActions = setupInsertDialog(editor)
  setupAppMenu(editor, fileActions, insertActions)
  setupLinkMenu(editor, insertActions)
  setupCodeCopy(editor)
  setupZoom()
  setupWelcome(editor)
  setupClickAnywhere(editor)
}

// pywebview 브릿지가 준비된 뒤에 에디터 초기화
if (window.pywebview && window.pywebview.api) {
  initEditor()
} else {
  window.addEventListener('pywebviewready', initEditor)
}