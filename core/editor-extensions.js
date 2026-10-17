import { Extension, Plugin, PluginKey, Selection } from './vendor.js'
import { TRAILING_CONFIG } from './config.js'

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
export const TrailingParagraph = Extension.create({
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
export const MarkExit = Extension.create({
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
export const TableEntry = Extension.create({
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
