import { ZOOM_CONFIG } from '../../core/config.js'
import { setStatus } from '../../core/status.js'

// Ctrl+휠로 에디터 폰트 크기를 확대/축소
// Ctrl+0 으로 100% 복원, 변경 시 상태 바에 현재 배율 표시

export function setupZoom() {
  let zoom = 1

  function apply() {
    const size = (ZOOM_CONFIG.baseFontSize * zoom).toFixed(2) + 'px'
    document.documentElement.style.setProperty('--editor-font-size', size)
  }

  function setZoom(next) {
    zoom = Math.min(ZOOM_CONFIG.max, Math.max(ZOOM_CONFIG.min, next))
    apply()
    setStatus(`Zoom: ${Math.round(zoom * 100)}%`, 1000)
  }

  document.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    setZoom(zoom + (e.deltaY < 0 ? ZOOM_CONFIG.step : -ZOOM_CONFIG.step))
  }, { passive: false })

  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey) return
    if (e.key === '0') {
      e.preventDefault()
      setZoom(1)
    }
  })

  apply()
}