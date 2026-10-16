import { CODE_COPY_CONFIG } from '../../core/config.js'

// 코드박스 위에 마우스를 올리면 오른쪽 위에 복사 버튼을 띄우고, 클릭하면 코드 내용을 클립보드에 복사
export function setupCodeCopy(editor) {
  const { buttonId, label, copiedLabel, failedLabel, resetMs, offset } = CODE_COPY_CONFIG
  const visibleClass = 'visible'

  // 버튼은 에디터 바깥(body)에 하나만 만들어 재사용
  const button = document.createElement('button')
  button.id = buttonId
  button.type = 'button'
  button.textContent = label
  document.body.appendChild(button)

  let currentPre = null
  let resetTimer = null

  // 현재 코드박스의 오른쪽 위 모서리에 버튼 위치를 맞춤 (단위: px, 화면 기준)
  function showFor(pre) {
    const rect = pre.getBoundingClientRect()
    currentPre = pre
    button.style.top = `${rect.top + offset}px`
    button.style.left = `${rect.right - button.offsetWidth - offset}px`
    button.classList.add(visibleClass)
  }

  function hide() {
    currentPre = null
    button.classList.remove(visibleClass)
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
    if (e.target === button) return
    const pre = e.target.closest ? e.target.closest('.ProseMirror pre') : null
    if (pre) {
      if (pre !== currentPre) showFor(pre)
    } else if (currentPre) {
      hide()
    }
  })

  // 스크롤하면 버튼 위치가 어긋나므로 숨김
  document.addEventListener('scroll', hide, true)

  // 버튼을 눌러도 에디터 선택/포커스가 풀리지 않게 막음
  button.addEventListener('mousedown', (e) => e.preventDefault())

  button.addEventListener('click', async () => {
    if (!currentPre) return
    const ok = await copyText(currentPre.textContent)
    button.textContent = ok ? copiedLabel : failedLabel
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => { button.textContent = label }, resetMs)
  })
}