import { Selection } from './vendor.js'
import { UI_CONFIG, TABLE_CONFIG } from './config.js'
import { markdownToHtml } from './markdown.js'

// ---- 표 관련 동작 ----
// 표 삽입, 마크다운 표 텍스트 변환, 표 우클릭 메뉴 동작(행/열/헤더/삭제)을 모아 둡니다.

// 표 삽입: Tiptap 표준 insertTable 커맨드 사용
// (열 폭 고정은 아래 setupTableColwidthFill이 표가 생길 때마다 자동으로 처리)
export function insertTable(editor) {
  editor.chain().focus().insertTable({
    rows: TABLE_CONFIG.rows,
    cols: TABLE_CONFIG.cols,
    withHeaderRow: TABLE_CONFIG.withHeaderRow,
  }).run()
}

// ---- 표 열 폭 자동 고정 ----
// 모든 열에 colwidth가 없는 표는 CSS의 width: 100%가 표 폭을 고정해서, 열 하나를 리사이즈하면
// 잡은 열이 아니라 나머지 열이 줄어듭니다. 삽입, 파일 열기, 마크다운 변환 등 어떤 경로로
// 표가 생기든, 렌더링이 끝난 뒤 실제 열 폭을 읽어 모든 열의 colwidth로 채워 이를 막습니다.
// 이미 하나라도 colwidth가 있는 표(사용자가 조절한 표)와 rowspan이 있는 표는 건드리지 않습니다.
export function setupTableColwidthFill(editor) {
  let timerId = null
  const schedule = () => {
    // 디바운스: 연속 편집(빠른 타이핑 등) 중에는 계속 미루다가 멈춘 뒤 한 번만 계산
    clearTimeout(timerId)
    timerId = setTimeout(() => {
      // rAF 2회: 문서 변경이 화면에 그려지고 레이아웃이 확정된 뒤에 폭을 측정
      requestAnimationFrame(() => requestAnimationFrame(() => {
        fillTableColwidths(editor)
      }))
    }, TABLE_CONFIG.colwidthFillDebounceMs)
  }
  editor.on('transaction', ({ transaction }) => {
    if (!transaction.docChanged) return
    if (transaction.getMeta(FILL_META)) return // 폭 채우기가 직접 만든 트랜잭션은 다시 검사할 필요 없음
    if (touchesTable(transaction)) schedule() // 표와 무관한 편집(일반 타이핑 등)은 검사를 건너뜀
  })
  schedule() // 에디터 시작 시 이미 들어 있는 표
}

// 폭 채우기가 만든 트랜잭션을 구분하기 위한 표식
const FILL_META = 'colwidthFill'

// 이번 트랜잭션이 바꾼 범위 안에 표가 있는지 확인
// (삽입, 파일 열기, 표 편집은 표를 포함하므로 걸러지지 않음)
function touchesTable(transaction) {
  const { doc, mapping } = transaction
  const { maps } = mapping
  for (let i = 0; i < maps.length; i++) {
    const rest = mapping.slice(i + 1) // 이후 단계들을 거쳐 최종 문서 기준 위치로 변환하기 위함 (얕은 슬라이스라 비용은 적음)
    let found = false
    maps[i].forEach((oldStart, oldEnd, newStart, newEnd) => {
      if (found) return
      const from = Math.max(0, rest.map(newStart, -1))
      const to = Math.min(doc.content.size, rest.map(newEnd, 1))
      doc.nodesBetween(from, Math.max(from, to), (node) => {
        if (node.type.name === 'table') found = true
        return !found
      })
    })
    if (found) return true
  }
  return false
}

function fillTableColwidths(editor) {
  const { view, state } = editor
  const tr = state.tr

  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return true
    if (node.childCount === 0) return false

    let hasWidth = false
    let hasRowspan = false
    node.firstChild.forEach(cell => { if (cell.attrs.colwidth) hasWidth = true })
    node.forEach(row => row.forEach(cell => { if ((cell.attrs.rowspan || 1) > 1) hasRowspan = true }))
    if (hasWidth || hasRowspan) return false

    const dom = view.nodeDOM(pos)
    const tableEl = dom?.tagName === 'TABLE' ? dom : dom?.querySelector?.('table')
    const firstRowEl = tableEl?.querySelector('tr')
    if (!firstRowEl) return false

const wrapEl = tableEl.closest('.tableWrapper') || tableEl.parentElement
const cells = [...firstRowEl.children]
if (!cells.length) return false

// 셀의 border 두께는 CSS(.ProseMirror th, td)에 정의되어 있으므로, 값을 하드코딩하지
// 않고 실제 계산된 스타일에서 읽어 CSS와 자동으로 동기화되게 함.
const cs = getComputedStyle(cells[0])
const borderPx = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)

const available = (wrapEl?.clientWidth || tableEl.clientWidth) - borderPx * cells.length
const raw = cells.map(c => c.getBoundingClientRect().width)
if (raw.some(w => w <= 0) || available <= 0) return false

const total = raw.reduce((s, w) => s + w, 0)
const widths = raw.map(w => Math.floor(w * available / total))
const sum = widths.reduce((s, w) => s + w, 0)
const remainder = available - sum
if (remainder > 0) widths[widths.length - 1] += remainder

    let rowPos = pos + 1 // 첫 행 시작 위치
    node.forEach(row => {
      let cellPos = rowPos + 1 // 첫 셀 시작 위치
      let col = 0
      row.forEach(cell => {
        const span = cell.attrs.colspan || 1
        const colwidth = widths.slice(col, col + span)
        if (colwidth.length === span) tr.setNodeMarkup(cellPos, undefined, { ...cell.attrs, colwidth })
        col += span
        cellPos += cell.nodeSize
      })
      rowPos += row.nodeSize
    })
    return false
  })

  if (!tr.docChanged) return
  tr
    .setMeta('addToHistory', false) // 실행 취소 기록에 남기지 않음
    .setMeta('preventUpdate', true) // 자동 처리로 문서가 수정됨(dirty)으로 표시되지 않게 함
    .setMeta(FILL_META, true)
  view.dispatch(tr)
}

// 구분선 판별 정규식은 한 번만 컴파일해서 재사용
const dividerRe = new RegExp(TABLE_CONFIG.dividerPattern)

// 텍스트가 마크다운 표 문법의 시작(헤더 행 + 구분선 행)인지 확인 (GFM 표 최소 조건)
function isTableHead(lines) {
  return lines.length >= 2 && lines[0].includes('|') && dividerRe.test(lines[1]) && lines[1].includes('-')
}

// 선택 텍스트가 마크다운 표 문법이면 줄 배열을, 아니면 null 반환
function getTableMarkdownLines(state) {
  const { from, to, empty } = state.selection
  if (empty) return null

  // 블록 사이는 줄바꿈으로 이어 붙여 여러 문단에 걸친 선택도 처리
  const text = state.doc.textBetween(from, to, '\n', '\n').trim()
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  return isTableHead(lines) ? lines : null
}

// 버블 메뉴의 표 변환 버튼 노출 여부 판단용
// 판별에는 앞 두 줄만 필요하므로, 선택 범위가 아무리 커도 앞부분만 읽어 비용을 일정하게 유지
export function isTableMarkdownSelection(editor) {
  const { doc, selection } = editor.state
  const { from, to, empty } = selection
  if (empty) return false

  // 앞 두 줄이 들어갈 만큼만 읽음 (헤더/구분선 행이 아주 길어도 충분한 여유)
  const head = doc.textBetween(from, Math.min(to, from + 2000), '\n', '\n').trim()
  const lines = head.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 2)
  return isTableHead(lines)
}

// 선택한 마크다운 표 텍스트를 표 노드로 변환 (표 형식이 아니면 아무 동작 안 함)
export function convertTextToTable(editor) {
  const { state } = editor
  const { from, to } = state.selection
  const lines = getTableMarkdownLines(state)
  if (!lines) return false

  // marked가 만드는 <td>/<th>는 내용을 <p>로 감싸지 않아, Insert Table로 만든
  // 표(Tiptap이 항상 <p>로 감쌈)와 셀 구조가 달라집니다. 이 차이 때문에
  // .ProseMirror th/td > p 에 걸린 여백·배경 CSS가 적용되지 않아 헤더 줄이
  // 비정상적으로 높아지고 회색 배경도 빠질 수 있으므로, 빈 셀이든 내용이 있는
  // 셀이든 모두 <p>로 감싸 Insert Table과 동일한 구조로 맞춥니다.
  // 주의: <(td|th)([^>]*)> 처럼 태그명 뒤 경계를 두지 않으면 <thead>가
  // <th(ead)>로 잘못 매칭되어 표 구조가 깨진다. 반드시 태그명 뒤에 '>' 또는
  // 공백(속성 시작)이 오도록 (\s[^>]*)? 로 경계를 고정해야 한다.
  const html = markdownToHtml(lines.join('\n'))
    .replace(/<(td|th)(\s[^>]*)?>([\s\S]*?)<\/\1>/g, (_, tag, attrs, inner) => {
      const trimmed = inner.trim()
      return `<${tag}${attrs || ''}><p>${trimmed || ''}</p></${tag}>`
    })
  if (!html.includes('<table')) return false

  // 선택 범위를 포함하는 최상위 블록 전체를 교체 (문단 일부만 남는 것 방지)
  const $from = state.doc.resolve(from)
  const $to = state.doc.resolve(to)
  const start = $from.before(1)
  const end = $to.after(1)

  return editor.chain().focus().insertContentAt({ from: start, to: end }, html).run()
}

// 커서가 있는 표 노드와 표 내용 시작 위치를 반환 (표 밖이면 null)
function findTable(editor) {
  const { $from } = editor.state.selection
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'table') return { node: $from.node(d), start: $from.start(d) }
  }
  return null
}

// 주어진 위치에서 가장 가까운 유효한 텍스트 위치로 커서 이동
function moveCursorNear(editor, pos) {
  const $pos = editor.state.doc.resolve(pos)
  editor.commands.setTextSelection(Selection.near($pos).from)
}

// 항상 표의 가장 아래에 행 추가: 마지막 행으로 커서를 옮긴 뒤 표준 addRowAfter 실행
function insertRowAtBottom(editor) {
  const table = findTable(editor)
  if (!table) return
  const lastRow = table.node.lastChild
  const rowPos = table.start + table.node.content.size - lastRow.nodeSize // 마지막 행 시작 위치
  moveCursorNear(editor, rowPos + 2) // 행 내부(+1) -> 첫 셀 내부(+1)
  editor.chain().focus().addRowAfter().run()
}

// 항상 표의 가장 오른쪽에 열 추가: 첫 행의 마지막 셀로 커서를 옮긴 뒤 표준 addColumnAfter 실행
function insertColumnAtRight(editor) {
  const table = findTable(editor)
  if (!table) return
  const firstRow = table.node.firstChild
  const lastCell = firstRow.lastChild
  const cellPos = table.start + 1 + firstRow.content.size - lastCell.nodeSize // 마지막 셀 시작 위치
  moveCursorNear(editor, cellPos + 1) // 셀 내부(+1)
  editor.chain().focus().addColumnAfter().run()
}

// 표 우클릭 컨텍스트 메뉴 동작 (Tiptap 표준 표 커맨드)
export function buildTableActions(editor) {
  const ids = UI_CONFIG.tableMenuButtons
  return {
    [ids.toggleHeader]: () => editor.chain().focus().toggleHeaderRow().run(),
    [ids.insertRow]: () => insertRowAtBottom(editor),
    [ids.insertCol]: () => insertColumnAtRight(editor),
    [ids.deleteRow]: () => editor.chain().focus().deleteRow().run(),
    [ids.deleteCol]: () => editor.chain().focus().deleteColumn().run(),
    [ids.deleteTable]: () => editor.chain().focus().deleteTable().run(),
  }
}
