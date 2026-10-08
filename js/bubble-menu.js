import { buildBubbleActions } from './formatting.js'
import { isTableMarkdownSelection } from './table-actions.js'
import { UI_CONFIG, EDITOR_CONFIG } from './config.js'

// ---- 플로팅 버블 메뉴 (텍스트 선택 시에만 표시) ----
// MarkText/Medium 스타일: 텍스트를 드래그해서 선택했을 때만 나타나고,
// 선택이 풀리면 사라지는 서식 툴바입니다.

export function setupBubbleMenu(editor) {
  const bubbleEl = document.getElementById(UI_CONFIG.bubbleMenuId)
  const ids = UI_CONFIG.bubbleButtons
  const cls = UI_CONFIG.classes
  const convertGroupEl = document.getElementById(UI_CONFIG.convertGroupId)
  // 드래그 중에는 메뉴를 숨겨 마우스 이벤트 간섭(하이라이트 깜빡임)을 방지
  let isDragging = false

  // 서식 버튼 요소는 시작할 때 한 번만 찾아 두고, 선택이 바뀔 때마다 다시 찾지 않음
  const buttonEls = Object.fromEntries(
    Object.entries(ids).map(([name, id]) => [name, bubbleEl.querySelector('#' + id)])
  )

  function updateBubbleMenu() {
    const { from, to, empty } = editor.state.selection

    // 이미지를 클릭하면 NodeSelection이 생겨 empty가 false가 되지만,
    // 텍스트 서식은 이미지에 적용할 수 없으므로 메뉴를 띄우지 않습니다.
    if (empty || isDragging || editor.isActive('image')) {
      bubbleEl.classList.remove(cls.visible)
      return
    }

    // 선택 영역의 화면 좌표를 구해 선택 영역 위쪽 중앙에 메뉴를 띄웁니다.
    const start = editor.view.coordsAtPos(from)
    const end = editor.view.coordsAtPos(to)
    const centerX = (start.left + end.left) / 2
    const top = Math.min(start.top, end.top)

    bubbleEl.classList.add(cls.visible)

    // 선택 텍스트가 마크다운 표 문법일 때만 변환 버튼 표시 (메뉴 너비에 영향을 주므로 위치 계산 전에 처리)
    convertGroupEl.style.display = isTableMarkdownSelection(editor) ? 'contents' : 'none'

    // 메뉴가 화면 밖으로 나가지 않도록 위치를 보정합니다. (큰 표를 선택하면 좌표가 화면 밖일 수 있음)
    const margin = UI_CONFIG.bubbleMargin
    const halfW = bubbleEl.offsetWidth / 2
    const menuH = bubbleEl.offsetHeight + margin
    const clampedX = Math.min(Math.max(centerX, halfW + margin), window.innerWidth - halfW - margin)
    const clampedTop = Math.min(Math.max(top, menuH + margin), window.innerHeight - margin)

    bubbleEl.style.left = `${clampedX}px`
    bubbleEl.style.top = `${clampedTop}px`

    // 현재 커서 위치의 활성 서식에 맞춰 버튼 활성 표시
    const setActive = (name, active) => buttonEls[name].classList.toggle(cls.active, active)

    setActive('bold', editor.isActive('bold'))
    setActive('italic', editor.isActive('italic'))
    setActive('strike', editor.isActive('strike'))
    setActive('code', editor.isActive('code'))
    setActive('h1', editor.isActive('heading', { level: 1 }))
    setActive('h2', editor.isActive('heading', { level: 2 }))
    setActive('h3', editor.isActive('heading', { level: 3 }))
    setActive('quote', editor.isActive('blockquote'))
    setActive('bullet', editor.isActive('bulletList'))
    setActive('ordered', editor.isActive('orderedList'))
  }

    document.querySelector(EDITOR_CONFIG.selector).addEventListener('scroll', () => {
    bubbleEl.classList.remove(cls.visible)
  })

  // 탭을 전환하면 이전 문서의 선택 기준으로 떠 있던 메뉴를 숨깁니다.
  document.addEventListener('tabchange', () => bubbleEl.classList.remove(cls.visible))

  const bubbleActions = buildBubbleActions(editor)

  for (const [id, action] of Object.entries(bubbleActions)) {
    document.getElementById(id).addEventListener('mousedown', (e) => {
      // mousedown에서 처리 + preventDefault로 에디터의 선택(selection)이
      // 버튼 클릭 때문에 풀리지 않도록 합니다 (click이면 blur가 먼저 발생함).
      e.preventDefault()
      action()
      updateBubbleMenu()
    })
  }

  // 드래그 시작/종료 추적: 드래그가 끝난 시점에 메뉴를 한 번만 갱신
  editor.view.dom.addEventListener('mousedown', () => { isDragging = true })
  document.addEventListener('mouseup', () => {
    if (!isDragging) return
    isDragging = false
    updateBubbleMenu()
  })

  return { updateBubbleMenu }
}
