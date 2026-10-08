// 목록 시작 기호 판별 정규식: 기호(-, +, *) 또는 숫자+점 (예: "-", "1.")
const LIST_MARKER_PATTERN = /^\s*([-+*]|\d+\.)$/

// 리스트 항목 안에서 "- ", "* ", "+ ", "1. " 을 입력해도 리스트가 한 겹 더 만들어지지 않게 합니다.
// 리스트가 항목의 첫 내용이 되면 불렛이 한 줄에 두 개 겹쳐 보이기 때문입니다. (하위 목록은 Tab으로 만듭니다)
// Editor의 editorProps.handleTextInput에 연결하며, 확장보다 먼저 호출되므로 자동 변환 규칙보다 우선합니다.
// true를 반환하면 자동 변환을 건너뛰고 공백만 그대로 입력됩니다.
export function blockNestedListShortcut(view, from, to, text) {
  if (text !== ' ') return false
  const { $from } = view.state.selection
  if ($from.node(-1)?.type.name !== 'listItem') return false // 리스트 항목 밖이면 기존 동작 유지
  const before = $from.parent.textBetween(0, $from.parentOffset)
  if (!LIST_MARKER_PATTERN.test(before)) return false
  view.dispatch(view.state.tr.insertText(text, from, to))
  return true
}