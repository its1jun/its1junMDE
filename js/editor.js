import { Editor, Extension, Plugin, PluginKey, Selection, StarterKit, ListItem, Table, TableRow, TableCell, TableHeader, Link, Image } from './vendor.js'
import { NoListRejoin } from './no-list-rejoin.js'
import { blockNestedListShortcut } from './no-list-nesting.js'
import { setupBubbleMenu } from './bubble-menu.js'
import { setupFileIO } from './file-io.js'
import { setupTableMenu } from './table-menu.js'
import { setupTableColwidthFill } from './table-actions.js'
import { setupAppMenu } from './app-menu.js'
import { setupInsertDialog } from './insert-dialog.js'
import { setupLinkClick } from './link-click.js'
import { setupLinkMenu } from './link-menu.js'
import { setupImageFallback } from './image-fallback.js'
import { setupImageMenu } from './image-menu.js'
import { setupFindBar } from './find-bar.js'
import { withResize } from './image-view.js'
import { EDITOR_CONFIG, TABLE_CONFIG, LINK_CONFIG, TRAILING_CONFIG } from './config.js'

// 문서 맨 끝에는 항상 빈 문단 1개를 유지합니다. (열 때/편집할 때 자동 추가, 저장할 때는 제거)
// - 추가: 마지막 블록이 '비어 있는 최상위 문단'이 아니면 그 뒤에 빈 문단을 붙임
// - 제거: 저장 시 htmlToMarkdown / htmlToPlainText가 문서 끝 빈 줄을 잘라내므로 파일에는 남지 않음
const isEmptyParagraph = node => node.type.name === 'paragraph' && node.content.size === 0
const needsTrailingParagraph = doc => !!doc.lastChild && !isEmptyParagraph(doc.lastChild)

// 에디터 생성 직후(시작 문서)에 한 번 호출
function ensureTrailingParagraph(editor) {
  const { state, view } = editor
  if (!needsTrailingParagraph(state.doc)) return
  view.dispatch(
    state.tr
      .insert(state.doc.content.size, state.schema.nodes.paragraph.create())
      .setMeta('addToHistory', false)
      .setMeta('preventUpdate', true) // 자동 추가로 dirty 표시가 켜지지 않게 함
  )
}

const trailingKey = new PluginKey('trailingParagraph')

// priority를 높게 줘서 no-list-rejoin의 Backspace보다 먼저 실행되게 합니다.
const TrailingParagraph = Extension.create({
  name: 'trailingParagraph',
  priority: 1100,
  onCreate() { ensureTrailingParagraph(this.editor) },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: trailingKey,
        // 문서가 바뀐 모든 트랜잭션(타이핑, 파일 열기의 setContent 등) 뒤에 같은 단계에서 빈 문단을 보충.
        // 별도 dispatch가 아니라 appendTransaction이라 실행 취소 기록이 원래 입력과 한 묶음으로 처리됨
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some(tr => tr.docChanged)) return null
          if (!needsTrailingParagraph(newState.doc)) return null
          return newState.tr.insert(newState.doc.content.size, newState.schema.nodes.paragraph.create())
        },
      }),
    ]
  },
  addKeyboardShortcuts() {
    return {
      // 문서 맨 끝의 빈 문단이 표/인용문 바로 뒤에 있으면 Backspace로 지워지지 않게 막음
      Backspace: () => {
        const { state } = this.editor
        const { $from, empty } = state.selection
        if (!empty || $from.depth !== 1) return false // 최상위 문단만 대상
        if ($from.parent.type.name !== 'paragraph' || $from.parent.content.size !== 0) return false
        const index = $from.index(0)
        if (index === 0 || index !== state.doc.childCount - 1) return false // 문서 마지막 문단이 아님
        return TRAILING_CONFIG.blockTypes.includes(state.doc.child(index - 1).type.name)
      },
    }
  },
})

// 문단 맨 끝에서 서식(볼드 등)이 활성 상태일 때 오른쪽 방향키를 누르면
// 커서는 그대로 두고 서식만 해제해, 서식 없는 글자를 이어서 입력할 수 있게 합니다.
const MarkExit = Extension.create({
  name: 'markExit',
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      ArrowRight: () => {
        const { state, view } = this.editor
        const { $from, empty } = state.selection
        if (!empty || !$from.parent.isTextblock) return false
        if ($from.parentOffset !== $from.parent.content.size) return false
        const marks = state.storedMarks ?? $from.marks()
        if (!marks.length) return false
        view.dispatch(state.tr.setStoredMarks([]))
        return true
      },
    }
  },
})

// 표 바로 아래 문단의 첫 줄에서 위쪽 방향키를 누르면, 표의 마지막 행에서
// 항상 첫 번째 열(첫 칸)로 진입시킵니다. (기본 동작은 가까운 열로 진입함)
const TableEntry = Extension.create({
  name: 'tableEntry',
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      ArrowUp: () => {
        const { state, view } = this.editor
        const { $from, empty } = state.selection
        if (!empty || !$from.parent.isTextblock) return false

        // 바로 앞 형제 노드가 표인지 먼저 확인 (문서 데이터만 보므로 비용이 거의 없음)
        const parentDepth = $from.depth - 1
        const index = $from.index(parentDepth)
        if (index === 0) return false
        const table = $from.node(parentDepth).child(index - 1)
        if (table.type.name !== 'table') return false

        // 화면 좌표를 재느라 레이아웃 계산을 강제하는 호출은 표 바로 아래일 때만 실행
        if (!view.endOfTextblock('up')) return false // 문단 안에 위로 이동할 줄이 남아 있으면 기본 동작

        // 마지막 행의 첫 번째 셀 시작 위치 계산
        const tableStart = $from.before($from.depth) - table.nodeSize
        const lastRow = table.lastChild
        const rowStart = tableStart + 1 + table.content.size - lastRow.nodeSize
        const cellStart = rowStart + 1

        const $pos = state.doc.resolve(cellStart + 1)
        view.dispatch(state.tr.setSelection(Selection.near($pos, 1)).scrollIntoView())
        return true
      },
    }
  },
})

let bubbleMenu = { updateBubbleMenu: () => {} }

const editor = new Editor({
  element: document.querySelector(EDITOR_CONFIG.selector),
  extensions: [
    StarterKit.configure({ listItem: false }),
    // 리스트 항목(listItem) 안에 인용문(blockquote) 등 다른 블록도 자유롭게
    // 감쌀 수 있도록 기본 콘텐츠 규칙('paragraph block*': 첫 자식이 반드시
    // 문단이어야 함)을 'block+'로 완화합니다. 이렇게 해야 리스트 항목의
    // 문단을 인용문으로 감싸는 wrapIn('blockquote')이 성공합니다.
    ListItem.extend({ content: 'block+' }),
    // 빈 리스트 항목에서 Enter로 탈출한 직후 Backspace로 다시 리스트에
    // 합쳐지는 것을 방지 (탈출 자체는 기본 동작 그대로 유지)
    NoListRejoin,
    // 문서 맨 끝이 표이면 뒤에 빈 문단을 유지 (아래 방향키로 표 탈출 가능)
    TrailingParagraph,
    // 문단 끝에서 오른쪽 방향키로 서식(볼드 등) 해제
    MarkExit,
    // 표 아래 문단에서 위쪽 방향키로 진입 시 항상 마지막 행의 첫 칸으로
    TableEntry,
    // 표 익스텐션 (크기 조절 옵션은 config에서 관리)
    // 마지막 셀에서 Tab을 눌러도 새 행이 자동 추가되지 않도록 Tab 동작만 재정의
    Table.extend({
      addKeyboardShortcuts() {
        return {
          ...this.parent?.(),
          Tab: () => {
            if (!this.editor.isActive('table')) return false // 표 밖에서는 기본 동작 유지
            this.editor.commands.goToNextCell()
            return true // 마지막 셀에서도 키 입력을 소비해 행 추가를 막음
          },
        }
      },
    }).configure({ resizable: TABLE_CONFIG.resizable }),
    TableRow,
    TableHeader,
    TableCell,
    // 링크: 에디터 안에서 클릭해도 페이지가 이동하지 않도록 openOnClick 해제
    Link.configure({ openOnClick: false, autolink: false, HTMLAttributes: { title: LINK_CONFIG.openHint } }),
    // 이미지: 문단 안에 인라인으로 유지 (마크다운 ![alt](src) 구조와 일치)
    // 크기 조절이 가능한 인라인 이미지 (마크다운 ![alt](src) 구조와 일치)
    withResize(Image).configure({ inline: true, allowBase64: true }),
  ],
  content: EDITOR_CONFIG.initialContent,
  autofocus: true,
  // 리스트 항목 안에서 "- " 입력 시 리스트가 겹쳐 만들어지는 것을 방지
  editorProps: { handleTextInput: blockNestedListShortcut },
  onSelectionUpdate: () => bubbleMenu.updateBubbleMenu(),
  // 참고: 최신 ProseMirror는 조합(composition) 상태를 자체적으로 관리하며
  // view.composing은 읽기 전용 getter입니다. 별도 처리 없이도
  // 한글 IME 조합이 정상 동작함을 이미 확인했으므로 관련 코드는 넣지 않습니다.
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