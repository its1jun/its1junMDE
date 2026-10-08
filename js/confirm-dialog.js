import { UI_CONFIG, TAB_CONFIG } from './config.js'

// ---- 저장 확인 대화상자 ----
// 저장하지 않은 탭을 닫을 때 Save / Don't Save / Cancel 중 하나를 선택받습니다.
// askSave()는 'save' | 'discard' | 'cancel' 중 하나로 resolve되는 Promise를 반환합니다.

const ids = UI_CONFIG.confirmDialog
const visibleCls = UI_CONFIG.classes.visible
const $ = id => document.getElementById(id)

const backdrop = $(ids.backdropId)
const messageEl = $(ids.messageId)
const saveBtn = $(ids.saveId)
const discardBtn = $(ids.discardId)
const cancelBtn = $(ids.cancelId)

let resolver = null // 열려 있는 동안만 값이 있음

export function isConfirmOpen() {
  return resolver !== null
}

function finish(choice) {
  if (!resolver) return
  const resolve = resolver
  resolver = null
  backdrop.classList.remove(visibleCls)
  resolve(choice)
}

export function askSave(name) {
  return new Promise((resolve) => {
    resolver = resolve
    messageEl.textContent = TAB_CONFIG.confirmMessage(name)
    backdrop.classList.add(visibleCls)
    // visibility/pointer-events가 트랜지션 이후에야 적용되므로,
    // 같은 프레임에 focus()를 호출하면 포커스 링이 보이지 않거나
    // 첫 클릭이 무시되는 경우가 있음. 다음 프레임까지 미룸.
    requestAnimationFrame(() => saveBtn.focus())
  })
}

saveBtn.addEventListener('click', () => finish('save'))
discardBtn.addEventListener('click', () => finish('discard'))
cancelBtn.addEventListener('click', () => finish('cancel'))

// 바깥(배경) 클릭은 취소로 처리
backdrop.addEventListener('mousedown', (e) => {
  if (e.target === backdrop) finish('cancel')
})

// 키보드 조작: ←/→(↑/↓)로 버튼 사이 이동, Enter로 선택, ESC로 취소
// 포커스가 버튼 밖으로 벗어나도 동작하도록 document에서 받음
const buttons = [saveBtn, discardBtn, cancelBtn]
document.addEventListener('keydown', (e) => {
  if (!resolver) return

  if (e.key === 'Escape') {
    e.preventDefault()
    finish('cancel')
  } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault()
    const index = buttons.indexOf(document.activeElement)
    if (index === -1) { saveBtn.focus(); return } // 포커스가 밖에 있으면 첫 버튼부터
    const step = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1
    buttons[(index + step + buttons.length) % buttons.length].focus()
  } else if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault()
    const target = buttons.includes(document.activeElement) ? document.activeElement : saveBtn
    target.click()
  }
})
