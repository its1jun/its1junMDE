import { Extension, joinTextblockBackward } from './vendor.js'

// 빈 리스트 항목에서 Enter를 누르면 Tiptap의 기본 splitListItem 규칙에 따라
// 그 항목이 리스트 밖으로 탈출해 일반 문단이 됩니다 (이건 표준 동작이라
// 그대로 둡니다).
//
// 문제의 근본 원인: 그 직후 Backspace를 누르면 ProseMirror 기본 keymap의
// joinBackward 커맨드가 실행되는데, 이 커맨드는 "현재 텍스트블록을 앞
// 노드 안으로 옮기면서, 필요하면 wrapper 노드(listItem)를 새로 만들어
// 감싼다"는 전략을 씁니다. 그래서 문단이 리스트 항목으로 승격되어 들어가며
// 마치 "리스트가 복구된 것"처럼 보입니다. (참고:
// https://discuss.prosemirror.net/t/backspace-inside-empty-paragraph-creates-a-new-list-node/3784
// - ProseMirror 개발자 Marijn이 직접 설명한 내용)
//
// 해결책: 이 특정 상황(커서가 리스트 바로 뒤 문단의 맨 앞에 있음)에서만
// joinBackward 대신 prosemirror-commands의 joinTextblockBackward를 씁니다.
// 이 커맨드는 wrapper 승격 전략 없이 "현재 텍스트블록을 앞 텍스트블록에
// 순수 텍스트로만 합치는" 더 저수준의 동작이라, 문단 내용이 리스트
// 마지막 항목의 문단 끝에 그냥 이어붙을 뿐 새 리스트 항목으로 승격되지
// 않습니다. (이 함수는 prosemirror-commands 1.4.0부터 제공되며,
// Tiptap v2의 editor.commands에는 아직 래퍼가 없어 @tiptap/pm/commands에서
// 직접 import합니다 — formatting.js가 @tiptap/pm/transform에서
// liftTarget/findWrapping을 직접 가져오는 것과 동일한 패턴입니다.)
// Backspace 키 자체의 병합 기능은 그대로 살아있고, 다른 모든 상황(리스트
// 아닌 문단끼리 병합, 텍스트 삭제 등)은 전혀 건드리지 않고 기본 동작에
// 그대로 맡깁니다.
export const NoListRejoin = Extension.create({
  name: 'noListRejoin',
  // StarterKit 내부 확장들의 기본 Backspace 처리보다 반드시 먼저 실행되도록
  // 명시적으로 높은 priority를 부여합니다 (기본값은 100).
  priority: 1000,
    addKeyboardShortcuts() {
    return {
      // 문단 맨 앞에서 Backspace: 구조(리스트/인용문)가 새로 만들어지거나 늘어나지 않게 글자만 합침
      Backspace: () => {
        const { state, view } = this.editor
        const { $from, empty } = state.selection
        if (!empty) return false // 선택 범위가 있으면 기본 동작(선택 삭제)에 맡김
        if ($from.parentOffset !== 0) return false // 문단 맨 앞이 아니면 기본 동작

        const parentDepth = $from.depth - 1 // 문단의 실제 부모
        const parentNode = $from.node(parentDepth)
        const index = $from.index(parentDepth)

        // 경우 1) 리스트 항목의 첫 문단 맨 앞
        if (parentNode.type.name === 'listItem') {
          if (index !== 0) return false // 항목 안의 둘째 이후 블록은 기본 동작
          const listDepth = parentDepth - 1

          if ($from.index(listDepth) === 0) {
            // 첫 항목: 리스트 바로 앞이 인용문이면 기본 동작이 리스트 전체를 인용문 안으로 끌어들이므로
            // 그 항목만 리스트에서 꺼내 일반 문단으로 만듦. 그 외에는 기본 동작에 맡김
            const listIndex = $from.index(listDepth - 1)
            if (listIndex === 0) return false
            const before = $from.node(listDepth - 1).child(listIndex - 1)
            if (before.type.name !== 'blockquote') return false
            return this.editor.commands.liftListItem('listItem')
          }

          // 두 번째 이후 항목: 앞 항목 끝에 이어 붙임
          // (기본 동작은 항목을 합치면서 앞 항목 안에 빈 문단을 남겨 리스트가 꼬임)
          return joinTextblockBackward(view.state, view.dispatch, view)
        }

        // 경우 2) 리스트/인용문 바로 뒤 문단 맨 앞: 감싸는 노드로 승격시키지 않고 텍스트만 합침
        if (index === 0) return false
        const prevType = parentNode.child(index - 1).type.name
        const isPrevWrapper = ['bulletList', 'orderedList', 'blockquote'].includes(prevType)
        if (!isPrevWrapper) return false
        return joinTextblockBackward(view.state, view.dispatch, view)
      },
    }
  },
})
