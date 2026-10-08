import { liftTarget, findWrapping } from './vendor.js'
import { UI_CONFIG } from './config.js'
import { convertTextToTable } from './table-actions.js'

// 인용문(blockquote), 리스트(bulletList/orderedList), 제목(heading)의 상호작용 규칙:
// - 인용문과 리스트는 양방향으로 자유롭게 중첩 가능해야 합니다 (인용문 안에 리스트,
//   리스트 안에 인용문 모두 허용). 한쪽을 껐다 켜도 다른 쪽 구조는 그대로 남아야 합니다.
// - 제목과 리스트는 마크다운 구조상 공존 불가하므로 서로 배타적입니다.
//
// 주의: Tiptap의 editor.commands.lift(typeOrName)은 이름만으로 대상을 찾는 것처럼
// 보이지만, 실제로는 해당 타입이 현재 selection 안에 있는지만 확인(isNodeActive)한
// 뒤 내부적으로 prosemirror-commands의 범용 lift()를 그대로 호출합니다. 이 범용
// lift()는 selection의 기본 blockRange, 즉 "가장 가까운 조상"을 lift 대상으로
// 삼기 때문에, blockquote > bulletList > listItem처럼 리스트가 인용문보다 더
// 안쪽에 있으면 리스트가, 반대로 리스트가 더 바깥쪽이면 엉뚱한 쪽이 lift되어
// 버립니다. 그래서 인용문을 해제할 때는 "blockquote 타입까지의 range"를 직접
// 계산해서 lift해야 리스트 등 다른 구조를 건드리지 않습니다(liftListItem이
// listItem 타입을 명시적으로 지정하는 것과 동일한 원리).

export function isInList(editor) {
  return editor.isActive('bulletList') || editor.isActive('orderedList')
}

// selection을 포함하는 가장 가까운 조상 중 주어진 타입 이름을 가진 노드까지의
// range를 계산합니다. 없으면 null.
function rangeForAncestorType(state, typeName) {
  const { $from, $to } = state.selection
  let found = false
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === typeName) { found = true; break }
  }
  if (!found) return null
  return $from.blockRange($to, node => node.type.name === typeName)
}

// selection 안에 실제로 blockquote가 있는지와 무관하게, 해당 타입만 정확히
// lift합니다. liftListItem과 동일한 패턴으로, 다른 조상 구조는 건드리지 않습니다.
function liftAncestorType(editor, typeName) {
  const { state, dispatch } = editor.view
  const range = rangeForAncestorType(state, typeName)
  if (!range) return false
  const target = liftTarget(range)
  if (target == null) return false
  if (dispatch) dispatch(state.tr.lift(range, target).scrollIntoView())
  editor.view.focus()
  return true
}

// selection이 걸친 블록만 정확히 blockquote로 감쌉니다. 드래그 선택의 끝(또는 시작)
// 지점이 실제로는 아무 글자도 선택하지 않은 채 인접한 빈 문단의 내부(오프셋 0)에
// 걸쳐 있을 수 있습니다. 실제 콘텐츠 위치를 기준으로 계산하면 selection의 끝이
// "빈 문단 내부"로 스냅되어(TextSelection.between이 그렇게 만듦) 그 빈 문단까지
// 함께 감싸지는데, 사용자 눈에는 아무것도 선택하지 않은 것처럼 보이므로 이는
// 의도한 동작이 아닙니다. 그래서 selection 경계가 "내용 없는 문단의 시작 지점"과
// 정확히 겹치면 그 빈 문단 앞(뒤)으로 경계를 한 칸 당겨서, 실제로 텍스트가 선택된
// 블록만 감싸지도록 보정합니다.
function wrapSelectionInBlockquote(editor) {
  const { state, dispatch } = editor.view
  const { doc } = state
  let { from, to } = state.selection

  if (from !== to) {
    // to 보정: to가 (내용이 없는) 문단의 맨 시작이면, 그 문단은 선택되지
    // 않은 것으로 보고 경계를 한 칸 앞으로 당깁니다.
    const $to = doc.resolve(to)
    if ($to.parentOffset === 0 && $to.parent.content.size === 0 && to > from) {
      to = to - 1
    }
    // from 보정(대칭): from이 (내용이 없는) 문단의 맨 끝이면 (즉 그 문단
    // 안에서는 아무 것도 선택하지 않고 바로 다음 문단부터 선택이 시작된
    // 경우), 경계를 한 칸 뒤로 밉니다.
    const $from0 = doc.resolve(from)
    if ($from0.parent.content.size === 0 && $from0.parentOffset === 0 && to > from) {
      from = from + 1
    }
  }

  const $from = doc.resolve(from)
  const $to = doc.resolve(to)
  const range = $from.blockRange($to)
  if (!range) return false

  const wrapping = findWrapping(range, state.schema.nodes.blockquote)
  if (!wrapping) return false

  if (dispatch) dispatch(state.tr.wrap(range, wrapping).scrollIntoView())
  editor.view.focus()
  return true
}

export function toggleBlockquoteIndependent(editor) {
  editor.chain().focus().run()
  if (editor.isActive('blockquote')) {
    liftAncestorType(editor, 'blockquote')
  } else {
    wrapSelectionInBlockquote(editor)
  }
}

export function toggleList(editor, listType) {
  const otherType = listType === 'bulletList' ? 'orderedList' : 'bulletList'
  const chain = editor.chain().focus()

  if (editor.isActive('heading')) {
    // 헤딩+리스트는 공존 불가 -> 헤딩을 문단으로 되돌린 뒤 리스트 적용
    chain.setParagraph()
  }

  if (editor.isActive(listType)) {
    // 같은 타입의 리스트가 이미 적용된 상태 -> 리스트 해제(항목만 벗기고 인용문 등 바깥 구조는 유지)
    chain.liftListItem('listItem')
  } else if (editor.isActive(otherType)) {
    // 다른 타입의 리스트가 적용된 상태 -> 먼저 해제 후 새 타입으로 적용
    chain.liftListItem('listItem')
    chain.wrapInList(listType)
  } else {
    // 리스트가 없는 상태 -> 새로 적용 (인용문 등 바깥 구조는 그대로 유지됨)
    chain.wrapInList(listType)
  }
  chain.run()
}

export function toggleHeading(editor, level) {
  const chain = editor.chain().focus()
  if (isInList(editor)) chain.liftListItem('listItem')
  chain.toggleHeading({ level }).run()
}

export function buildBubbleActions(editor) {
  const ids = UI_CONFIG.bubbleButtons
  return {
    [ids.bold]: () => editor.chain().focus().toggleBold().run(),
    [ids.italic]: () => editor.chain().focus().toggleItalic().run(),
    [ids.strike]: () => editor.chain().focus().toggleStrike().run(),
    [ids.code]: () => editor.chain().focus().toggleCode().run(),
    [ids.h1]: () => toggleHeading(editor, 1),
    [ids.h2]: () => toggleHeading(editor, 2),
    [ids.h3]: () => toggleHeading(editor, 3),
    [ids.quote]: () => toggleBlockquoteIndependent(editor),
    [ids.bullet]: () => toggleList(editor, 'bulletList'),
    [ids.ordered]: () => toggleList(editor, 'orderedList'),
    [ids.convertTable]: () => convertTextToTable(editor),
  }
}
