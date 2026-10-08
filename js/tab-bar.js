import { TAB_CONFIG } from './config.js'

// ---- 탭 바 (화면 표시 + 드래그로 순서 변경) ----
// 탭 데이터는 tabs.js가 소유하고, 이 모듈은 탭 바를 그리고 마우스 조작만 처리합니다.
//
// getTabs(): 현재 탭 배열
// getActive(): 활성 탭
// activate(tab) / close(tab): 탭 전환·닫기 요청
// move(from, to): 탭 순서 변경 요청

export function setupTabBar(barEl, { getTabs, getActive, activate, close, move }) {
  const cls = TAB_CONFIG.classes
  let draggingTab = null // 드래그로 순서를 바꾸는 중인 탭

  function render() {
    barEl.textContent = ''
    const active = getActive()

    for (const tab of getTabs()) {
      const el = document.createElement('div')
      el.className = [cls.tab, tab === active && cls.active, tab.dirty && cls.dirty, tab === draggingTab && cls.dragging].filter(Boolean).join(' ')
      el.title = tab.path || tab.title

      const title = document.createElement('span')
      title.className = cls.title
      title.textContent = tab.title

      const closeBtn = document.createElement('button')
      closeBtn.className = cls.close
      closeBtn.textContent = TAB_CONFIG.closeLabel
      closeBtn.title = TAB_CONFIG.closeTitle
      closeBtn.tabIndex = -1 // 에디터에서 Tab을 누를 때 이 버튼으로 포커스가 튀지 않도록
      // 에디터 포커스가 풀리지 않도록 mousedown을 막고, 실제 닫기는 click에서 처리
      closeBtn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation() })
      closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(tab) })

      el.addEventListener('mousedown', (e) => {
        if (e.button === 0) { e.preventDefault(); activate(tab); beginDrag(tab, e.clientX) }
        else if (e.button === 1) { e.preventDefault(); close(tab) } // 가운데 클릭으로 닫기
      })

      el.append(title, closeBtn)
      barEl.appendChild(el)
      if (tab === active) el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }

  // 탭을 좌우로 끌어 순서를 바꿈: 포인터가 이웃 탭의 가운데를 지나면 자리를 맞바꿈
  // (가운데 기준으로 판단해야 폭이 다른 탭 사이에서 자리가 계속 뒤바뀌는 떨림이 없음)
  function beginDrag(tab, startX) {
    let moved = false

    function onMove(ev) {
      if (!moved && Math.abs(ev.clientX - startX) < TAB_CONFIG.dragThreshold) return
      if (!moved) { moved = true; draggingTab = tab; render() }

      const rects = [...barEl.children].map(el => el.getBoundingClientRect())
      const from = getTabs().indexOf(tab)
      let to = rects.findIndex(r => ev.clientX >= r.left && ev.clientX < r.right)
      if (to === -1) to = ev.clientX < rects[0].left ? 0 : rects.length - 1 // 탭 바 양 끝 바깥
      if (to === from) return

      const mid = rects[to].left + rects[to].width / 2
      if ((to > from && ev.clientX < mid) || (to < from && ev.clientX > mid)) return

      move(from, to)
      render()
    }

    function onEnd() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onEnd)
      window.removeEventListener('blur', onEnd)
      if (moved) { draggingTab = null; render() }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onEnd)
    window.addEventListener('blur', onEnd)
  }

  return { render }
}
