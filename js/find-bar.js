import { Plugin, PluginKey, Decoration, DecorationSet } from './vendor.js'
import { UI_CONFIG, FIND_CONFIG } from './config.js'

// ---- 찾기(Ctrl+F) ----
// 문서 텍스트를 순회해 검색어와 일치하는 구간을 찾고, 실제 문서는 건드리지
// 않은 채 Decoration으로만 하이라이트합니다. 현재 포커스된 매치는 별도
// 클래스로 구분해 색을 다르게 주고, 그 위치로 스크롤/선택을 이동시킵니다.
//
// bar: setupFindBar()가 반환한 { open, close, toggle } — 단축키(Ctrl+F)와
// 우클릭 메뉴 등에서 이 객체를 통해 열고 닫을 수 있습니다.

const findPluginKey = new PluginKey('find')

// 대소문자 구분 없이, 문서 전체에서 검색어와 일치하는 [from, to] 구간을 모두 찾습니다.
// 특수문자를 이스케이프해 정규식 메타문자로 오동작하지 않게 합니다.
function findMatches(doc, query) {
  const matches = []
  if (!query) return matches
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(escaped, 'gi')

  doc.descendants((node, pos) => {
    if (!node.isText) return
    let m
    re.lastIndex = 0
    while ((m = re.exec(node.text))) {
      matches.push({ from: pos + m.index, to: pos + m.index + m[0].length })
      // 빈 문자열 매치로 인한 무한루프 방지 (검색어가 있으므로 실제로는 발생 안 하지만 안전장치)
      if (m[0].length === 0) re.lastIndex++
    }
  })
  return matches
}

function buildDecorations(doc, matches, activeIndex) {
  const decos = matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class: i === activeIndex ? FIND_CONFIG.activeClass : FIND_CONFIG.matchClass,
    })
  )
  return DecorationSet.create(doc, decos)
}

export function setupFindBar(editor) {
  const ids = UI_CONFIG.findBar
  const visibleCls = UI_CONFIG.classes.visible
  const $ = id => document.getElementById(id)

  const bar = $(ids.barId)
  const input = $(ids.inputId)
  const countEl = $(ids.countId)

  let matches = []
  let activeIndex = -1
  let lastQuery = ''

  // 검색 상태를 담는 플러그인. query/matches/activeIndex가 바뀔 때마다
  // updateDecorations()에서 새 트랜잭션을 디스패치해 이 상태를 갱신합니다.
  const findPlugin = new Plugin({
    key: findPluginKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, old) {
        const meta = tr.getMeta(findPluginKey)
        if (meta) return meta.decorations
        // 문서가 바뀌었는데 검색어가 남아 있으면 기존 데코레이션 위치를 매핑
        return tr.docChanged ? old.map(tr.mapping, tr.doc) : old
      },
    },
    props: {
      decorations(state) {
        return findPluginKey.getState(state)
      },
    },
  })
  editor.registerPlugin(findPlugin)

  function updateDecorations() {
    const decorations = buildDecorations(editor.state.doc, matches, activeIndex)
    editor.view.dispatch(editor.state.tr.setMeta(findPluginKey, { decorations }))
  }

  function updateCount() {
    countEl.textContent = matches.length === 0
      ? (input.value ? FIND_CONFIG.noResultsLabel : '')
      : `${activeIndex + 1}/${matches.length}`
  }

  // 문서 수정으로 매치 목록이 재계산될 때, 이전에 보고 있던 매치와 같은 인덱스
  // 번호가 아니라 같은 "위치"에 가장 가까운 매치를 새 activeIndex로 삼습니다.
  // (앞쪽에서 매치가 추가/삭제되면 인덱스 번호만으로는 전혀 다른 위치를 가리키게 됨)
  function closestMatchIndex(newMatches, anchorFrom) {
    if (anchorFrom == null || newMatches.length === 0) return 0
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < newMatches.length; i++) {
      const dist = Math.abs(newMatches[i].from - anchorFrom)
      if (dist < bestDist) { bestDist = dist; best = i }
    }
    return best
  }

  function runSearch(query, { keepIndex = false } = {}) {
    // keepIndex일 때만, 재계산 전 활성 매치의 위치를 앵커로 남겨둠
    const anchorFrom = (keepIndex && activeIndex >= 0 && matches[activeIndex])
      ? matches[activeIndex].from
      : null

    lastQuery = query
    matches = findMatches(editor.state.doc, query)
    if (matches.length === 0) {
      activeIndex = -1
    } else if (!keepIndex) {
      activeIndex = 0
    } else {
      activeIndex = closestMatchIndex(matches, anchorFrom)
    }
    updateDecorations()
    updateCount()
    if (activeIndex >= 0) scrollToActive()
  }

  // 진행 중인 스크롤 애니메이션의 frame id. 매치를 빠르게 넘길 때(Enter 연타 등)
  // 이전 애니메이션과 겹쳐서 덜컹거리지 않도록, 새로 시작하기 전에 취소합니다.
  let scrollAnimId = null

  // quadratic ease-in-out: 시작도 끝도 부드러운 감속 곡선
  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }

  // window가 아니라 실제로 스크롤되는 가장 가까운 조상 요소를 찾습니다.
  // (이 에디터에서는 #editor-wrap이 overflow-y: auto인 스크롤 컨테이너)
  function findScrollParent(el) {
    let node = el.parentElement
    while (node) {
      const style = getComputedStyle(node)
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
        return node
      }
      node = node.parentElement
    }
    return document.scrollingElement || document.documentElement
  }

  function animateScrollTo(container, targetTop, { duration = 400, easing = easeInOutQuad } = {}) {
    if (scrollAnimId !== null) cancelAnimationFrame(scrollAnimId)

    const startTop = container.scrollTop
    const delta = targetTop - startTop
    if (Math.abs(delta) < 1) { scrollAnimId = null; return }

    const startTime = performance.now()

    function step(now) {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      container.scrollTop = startTop + delta * easing(t)
      scrollAnimId = t < 1 ? requestAnimationFrame(step) : null
    }
    scrollAnimId = requestAnimationFrame(step)
  }

  function scrollToActive() {
    const m = matches[activeIndex]
    if (!m) return
    // 문서 선택은 옮기지 않고(입력 포커스를 검색창에 유지) 해당 위치만 화면에 보이도록 스크롤
    const dom = editor.view.domAtPos(m.from)
    const el = dom.node.nodeType === 3 ? dom.node.parentElement : dom.node
    if (!el) return

    const container = findScrollParent(el)
    const containerRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()

    // el을 컨테이너 뷰포트 중앙에 오도록 목표 scrollTop 계산
    const targetTop = container.scrollTop
      + (elRect.top - containerRect.top)
      - (container.clientHeight / 2)
      + (elRect.height / 2)

    animateScrollTo(container, targetTop)
  }

  function step(delta) {
    if (matches.length === 0) return
    activeIndex = (activeIndex + delta + matches.length) % matches.length
    updateDecorations()
    updateCount()
    scrollToActive()
  }

  function clearHighlights() {
    matches = []
    activeIndex = -1
    lastQuery = ''
    updateDecorations()
    updateCount()
  }

  function open() {
    bar.classList.add(visibleCls)
    // 에디터에 선택된 텍스트가 있으면 검색창 초기값으로 채워줌
    const { from, to, empty } = editor.state.selection
    if (!empty) {
      const selected = editor.state.doc.textBetween(from, to, ' ')
      if (selected && !selected.includes('\n')) input.value = selected
    }
    input.focus()
    input.select()
    if (input.value) runSearch(input.value)
  }

  function close() {
    bar.classList.remove(visibleCls)
    clearHighlights()
    editor.commands.focus()
  }

  function toggle() {
    if (bar.classList.contains(visibleCls)) close()
    else open()
  }

  input.addEventListener('input', () => runSearch(input.value))

  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1) }
  })

  // 문서가 바뀌었을 때(타이핑 등) 매치 위치/개수를 다시 계산
  editor.on('update', () => {
    if (bar.classList.contains(visibleCls) && lastQuery) {
      runSearch(lastQuery, { keepIndex: true })
    }
  })

  // 탭을 전환하면(setContent라 'update' 이벤트가 발생하지 않음) 검색 상태를 정리
  // (다른 문서 기준으로 계산된 매치/하이라이트가 새 탭에 남아있지 않도록)
  document.addEventListener('tabchange', () => {
    if (bar.classList.contains(visibleCls)) clearHighlights()
  })

  return { open, close, toggle }
}