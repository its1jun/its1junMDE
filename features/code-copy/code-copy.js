import { CODE_COPY_CONFIG } from '../../core/config.js'

// 아이콘 모양 (SVG 안쪽 도형, 24x24 기준 좌표)
const CODE_COPY_ICONS = {
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  done: '<path d="M5 12l5 5L20 7"/>',
  fail: '<path d="M6 6l12 12M18 6L6 18"/>',
}

// 코드박스 위에 마우스를 올리면 복사 아이콘 버튼을 띄우고, 클릭하면 코드 내용을 클립보드에 복사
// 버튼은 코드박스 안쪽 + 에디터 화면에 보이는 영역 안쪽에서만 움직임
export function setupCodeCopy(editor) {
  const { buttonId, label, copiedLabel, failedLabel, resetMs, offset } = CODE_COPY_CONFIG
  const visibleClass = 'visible'

  // 버튼은 에디터 바깥(body)에 하나만 만들어 재사용
  const button = document.createElement('button')
  button.id = buttonId
  button.type = 'button'
  document.body.appendChild(button)

  // 버튼 안의 아이콘과 마우스 올림 설명(title/aria-label)을 함께 바꿈
  function setIcon(iconKey, text) {
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${CODE_COPY_ICONS[iconKey]}</svg>`
    button.title = text
    button.setAttribute('aria-label', text)
  }
  setIcon('copy', label)

  let currentPre = null
  let resetTimer = null

  // 코드박스와 화면에 보이는 영역이 겹치는 곳 안에 버튼 위치를 맞춤 (단위: px, 화면 기준)
  // 반환값: 버튼을 놓을 공간이 있으면 true, 코드박스가 화면에 거의 안 보이면 false
  function positionButton(pre) {
    const rect = pre.getBoundingClientRect()
    const wrap = document.getElementById('editor-wrap')
    const area = wrap ? wrap.getBoundingClientRect() : null

    // 보이는 영역: 에디터 영역과 브라우저 창이 겹치는 부분
    const viewTop = Math.max(area ? area.top : 0, 0)
    const viewBottom = Math.min(area ? area.bottom : window.innerHeight, window.innerHeight)
    const viewRight = Math.min(area ? area.right : window.innerWidth, window.innerWidth)

    const top = Math.max(rect.top, viewTop) + offset
    const maxTop = Math.min(rect.bottom, viewBottom) - button.offsetHeight - offset
    if (maxTop < top) return false

    const right = Math.min(rect.right, viewRight)
    const left = Math.max(right - button.offsetWidth - offset, rect.left + offset)

    button.style.top = `${top}px`
    button.style.left = `${left}px`
    return true
  }

  function showFor(pre) {
    currentPre = pre
    if (positionButton(pre)) button.classList.add(visibleClass)
    else button.classList.remove(visibleClass)
  }

  function hide() {
    currentPre = null
    button.classList.remove(visibleClass)
  }

  // 스크롤/창 크기 변경 시 현재 코드박스 기준으로 버튼 위치를 다시 계산
  function refreshPosition() {
    if (!currentPre) return
    if (!document.contains(currentPre)) {
      hide()
      return
    }
    if (positionButton(currentPre)) button.classList.add(visibleClass)
    else button.classList.remove(visibleClass)
  }

  // 클립보드에 복사: 기본 방식이 막히면 textarea 방식으로 한 번 더 시도
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (e) {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      editor.commands.focus() // 임시 입력창 때문에 빠진 에디터 포커스 복구
      return ok
    }
  }

  // 마우스가 코드박스 또는 버튼 위에 있을 때만 버튼 표시
  document.addEventListener('mousemove', (e) => {
    if (e.target === button || button.contains(e.target)) return
    const pre = e.target.closest ? e.target.closest('.ProseMirror pre') : null
    if (pre) {
      if (pre !== currentPre) showFor(pre)
    } else if (currentPre) {
      hide()
    }
  })

  document.addEventListener('scroll', refreshPosition, true)
  window.addEventListener('resize', refreshPosition)

  // 버튼을 눌러도 에디터 선택/포커스가 풀리지 않게 막음
  button.addEventListener('mousedown', (e) => e.preventDefault())

  button.addEventListener('click', async () => {
    if (!currentPre) return
    const ok = await copyText(currentPre.textContent)
    if (ok) setIcon('done', copiedLabel)
    else setIcon('fail', failedLabel)
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => { setIcon('copy', label) }, resetMs)
  })
}