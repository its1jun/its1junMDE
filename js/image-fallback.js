import { withApi } from './api.js'

// 원래 src -> 로컬 이미지 서버 주소.
// 한 번 알아낸 주소를 기억해 두면, 이미지를 다시 그릴 때(탭 전환 등) 처음부터 이 주소를 써서
// "로드 실패 -> Python 요청 -> 교체" 과정을 반복하지 않습니다.
// 장시간 세션에서 무한히 커지지 않도록 최대 개수를 두고 가장 오래된 항목부터 제거(LRU)
const MAX_KNOWN_URLS = 500
const knownUrls = new Map()

function rememberUrl(src, url) {
  if (knownUrls.has(src)) knownUrls.delete(src) // 재삽입으로 최신 사용 순서로 갱신
  else if (knownUrls.size >= MAX_KNOWN_URLS) {
    knownUrls.delete(knownUrls.keys().next().value) // 가장 오래된(least recently used) 항목 제거
  }
  knownUrls.set(src, url)
}

export function getKnownImageUrl(src) {
  return knownUrls.get(src)
}

// ---- 이미지 로드 실패 시 대체 표시 ----
// 에디터 페이지가 file://이 아닌 주소(로컬 http 서버)로 열리기 때문에 WebView가 보안상
// file:// 이미지를 직접 불러오지 못해 alt 텍스트만 보입니다. 이때 Python이 로컬 이미지 서버의
// http 주소를 돌려주면 화면에서만 그 주소로 교체합니다. (문서에 저장되는 src는 바뀌지 않음)

export function setupImageFallback(editor) {
  // error 이벤트는 버블링되지 않으므로 캡처 단계에서 받습니다.
  editor.view.dom.addEventListener('error', (e) => {
    const img = e.target
    if (!(img instanceof HTMLImageElement)) return
    if (img.dataset.fallback) return // 한 번만 시도해 무한 반복 방지
    img.dataset.fallback = '1'

    const src = img.getAttribute('src')
    withApi(async (api) => {
      try {
        const result = await api.image_url(src)
        if (result && result.ok) {
          rememberUrl(src, result.url)
          img.src = result.url
        }
        else console.warn('Image load failed:', src, result && result.error)
      } catch (err) {
        console.warn('Image load failed:', src, err)
      }
    })
  }, true)
}
