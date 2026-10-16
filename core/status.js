import { UI_CONFIG, FILE_CONFIG } from './config.js'

// 상태 바에 메시지를 표시하고 일정 시간 후 숨긴다. 여러 기능이 공용으로 사용.
export function setStatus(text, duration = FILE_CONFIG.statusDuration) {
  const statusEl = document.getElementById(UI_CONFIG.statusId)
  const statusBarEl = document.getElementById('status-bar')
  if (!statusEl || !statusBarEl) return

  statusEl.textContent = text
  statusBarEl.classList.toggle('visible', !!text)
  if (text) setTimeout(() => {
    if (statusEl.textContent === text) {
      statusBarEl.classList.remove('visible')
      setTimeout(() => {
        if (!statusBarEl.classList.contains('visible')) statusEl.textContent = ''
      }, 220) // --anim-duration(0.22s)과 맞춘 값
    }
  }, duration)
}